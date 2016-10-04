'use strict'
const fork     = require('child_process').fork;
const util     = require('util');
const async    = require('async');
const _        = require('lodash');
const fs       = require('fs');
const random   = require('../../utils').random;
const logger   = require('../../utils').logger;
const syslog   = require('../../utils').syslog;
const redis    = require('../../utils').redis;
const settings = require('../../settings');

const API     = require('../../models/API');
const List    = require('../../models/List');
const User    = require('../../models/User');
const Snippet = require('../../models/Snippet');
const Version = require('../../models/Version');

const abuseLimit = 3; // 3 timeouts within 15 seconds = timeout for 30 seconds
let abuseCache   = {};
let timeout      = {};

const EventEmitter = require('events').EventEmitter;

const GeneratorForker = function(options) {
  let self = this;

  this.info = {
    execTime: options.execTime,
    results:  options.results
  };

  this.silent       = true;
  this.name         = options.name;
  this.guid         = random(1, 8);
  this.startTime    = new Date().getTime();
  this.jobCount     = 0;
  this.memory       = 0;
  this.listCache    = 0;
  this.attempted    = false;
  this.snippetCache = 0;

  this.lastJobTime  = new Date().getTime();

  // Reset abuse cache every 15 seconds
  setInterval(() => {
    abuseCache = {};
  }, 15000);

  setInterval(checkTimeout, 30000);

  // Queue to push generate requests into
  this.initQueue();

  this.fork();

  // See if child process is alive during 5 second check
  setInterval(generatorChecks, 5000);

  function generatorChecks() {
    self.childReplied = false;
    setTimeout(() => {
      if (new Date().getTime()/1000 - self.lastReplied > 10 && !self.attempted) {
        self.generator = null;
        logger(`[generator ${self.guid} ${self.name}]: Generator crashed...attempting to restart`);
        self.initQueue();
        self.guid = random(1, 8);
        self.fork();
        self.attempted = true;
      }
    }, 5000)
    try {
      self.send({type: 'ping'});
    } catch(e) {}
    self.once(`pong${self.guid}`, () => {
      self.lastReplied = new Date().getTime()/1000;
      self.attempted = false;
    });

    self.send({
      type: 'cmd',
      mode: 'getMemory'
    });

    var statTimeouts = setTimeout(() => {
      self.memory = 0;
      self.listCache = 0;
      self.snippetCache = 0;
    }, 10000);

    self.once(`memComplete${self.guid}`, data => {
      self.memory = Math.floor(data/1024/1024);
      clearTimeout(statTimeouts);
    });

    self.send({
      type: 'cmd',
      mode: 'getListCache'
    });

    self.once(`listCacheComplete${self.guid}`, data => {
      self.listCache = Math.floor(data/1024/1024);
      clearTimeout(statTimeouts);
    });

    self.send({
      type: 'cmd',
      mode: 'getSnippetCache'
    });

    self.once(`snippetCacheComplete${self.guid}`, data => {
      self.snippetCache = Math.floor(data/1024/1024);
      clearTimeout(statTimeouts);
    });

    if (
      new Date().getTime() - self.lastJobTime > self.info.execTime*1000 + 5000 &&
      self.queueLength() !== 0
    ) {
      logger(`[generator ${self.name}]: Generator appears hung on task...attempting to purge queue`);
      self.killQueue();
    }
  }
};

util.inherits(GeneratorForker, EventEmitter);

GeneratorForker.prototype.fork = function() {
  let self = this;

  // Fork new Generator with provided info
  this.generator = fork(__dirname + '/Generator', [this.name, this.guid, JSON.stringify(this.info)], {silent: this.silent});

  // Handle all events
  // {type, mode, data}
  this.generator.on(`message`, msg => {

    if (msg.type === 'lookup') {
      if (msg.mode === 'api') {
        API.getCond({ref: msg.data}).then(doc => {
          this.generator.send({type: 'response', mode: 'api', data: doc});
        });

      } else if (msg.mode === 'user') {
        User.getCond({["u.id"]: msg.data}).then(doc => {
          this.generator.send({type: 'response', mode: 'user', data: doc});
        });

      } else if (msg.mode === 'list') {
        // Check if list exists in the cache
        redis.exists("list:" + msg.data.ref, (err, result) => {

          // List exists in the cache
          if (result === 1) {

            // Update TTL
            redis.expire("list:" + msg.data.ref, settings.generators[this.name].redisTTL);
            redis.expire("list:" + msg.data.ref + ":contents", settings.generators[this.name].redisTTL);

            redis.hgetall("list:" + msg.data.ref, (err, obj) => {

              // Update lastUsed time
              redis.hset("list:" + obj.ref, "lastUsed", new Date().getTime());

              this.generator.send({
                type: 'response',
                mode: 'list',
                data: Number(obj.owner) === msg.data.user.id // Verify user has permission to access this list
              });
            });

          // Add list to cache if user has permission
          } else {

            List.getCond({ref: msg.data.ref, owner: msg.data.user.id}).then(doc => {

              if (doc === null) {
                this.generator.send({type: 'response', mode: 'list', data: false});

              } else {
                fs.readFile(process.cwd() + '/data/lists/' + doc.id + '.list', 'utf8', (err, file) => {
                  redis.hmset("list:" + doc.ref, {
                    added: new Date().getTime(),
                    size: file.length,
                    owner: doc.owner,
                    lastUsed: new Date().getTime()
                  }, (err, res) => {
                    redis.set("list:" + doc.ref + ":contents", file, () => {

                      // Add TTL
                      redis.expire("list:" + doc.ref, settings.generators[this.name].redisTTL);
                      redis.expire("list:" + doc.ref + ":contents", settings.generators[this.name].redisTTL);

                      this.generator.send({type: 'response', mode: 'list', data: true});
                    });
                  });
                });
              }
            });
          }
        });
      } else if (msg.mode === 'snippet') {
        let obj, tmp = msg.data.signature.split('/');

        // No version supplied
        if (tmp.length === 2) {
          obj = `snippet:${tmp[0]}/${tmp[1]}`;
        } else {
          obj = `snippet:${tmp[0]}/${tmp[1]}/${tmp[2]}`;
        }

        // Check if snippet exists in the cache
        redis.exists(obj, (err, result) => {

          // Snippet exists in the cache
          if (result === 1) {

            redis.hgetall(obj, (err, ret) => {
              // Check if user is authorized to use this snippet
              if (Number(ret.published) !== 1 && Number(ret.owner) !== msg.data.user.id) {
                return this.generator.send({
                  type: 'response',
                  mode: 'snippet',
                  data: {
                    signature: msg.data.signature,
                    status: false
                  },
                });
              } else {

                // Update TTL
                redis.expire(obj, settings.generators[this.name].redisSnippetTTL);
                redis.expire(`${obj}:contents`, settings.generators[this.name].redisSnippetTTL);

                // Update lastUsed time
                redis.hset(obj, "lastUsed", new Date().getTime());

                this.generator.send({
                  type: 'response',
                  mode: 'snippet',
                  data: {
                    signature: msg.data.signature,
                    status: true
                  },
                });
              }
            });

          // Add snippet to cache if user has permission
          } else {
            msg.data.user = msg.data.user || {username: null};
            User.getCond({username: msg.data.user.username}).then(user => {
              if (user === null) user = {id: -1};
              let query = {username: tmp[0], name: tmp[1]};
              Snippet.getCond(query).then(doc => {

                // No matching snippet found
                if (doc === null) {
                  return this.generator.send({
                    type: 'response',
                    mode: 'snippet',
                    data: {
                      signature: msg.data.signature,
                      status: false
                    },
                  });
                }

                // If not published and no version number specified, use version 1
                let version = doc.published === 0 && tmp[2] === undefined ? 1 : Number(tmp[2]);

                // Published snippets require version number
                if (doc.published && version === undefined || isNaN(version)) {
                  this.generator.send({
                    type: 'response',
                    mode: 'snippet',
                    data: {
                      signature: msg.data.signature,
                      status: false,
                      msg: "missing_version"
                    },
                  });
                  return;
                }
                Version.getVersion(doc.ref, version).then(ver => {

                  if (ver === null) {
                    this.generator.send({
                      type: 'response',
                      mode: 'snippet',
                      data: {
                        signature: msg.data.signature,
                        status: false,
                        msg: "invalid_version"
                      },
                    });
                  }

                  // If snippet isn't published and this is a demo user OR the user doesn't own snippet
                  else if ((!ver.published && user === null) || (!ver.published && user.id !== doc.owner)) {
                    this.generator.send({
                      type: 'response',
                      mode: 'snippet',
                      data: {
                        signature: msg.data.signature,
                        status: false
                      },
                    });

                  } else {
                    fs.readFile(process.cwd() + '/data/snippets/' + doc.id + '-' + ver.version + '.snippet', 'utf8', (err, file) => {
                      // prepend and append
                      file = `(function() {
  let snippet = {};
  ${file}
  return snippet;
})()`;
                      redis.hmset(obj, {
                        added: new Date().getTime(),
                        size: file.length,
                        owner: Number(doc.owner),
                        published: Number(ver.published),
                        lastUsed: new Date().getTime()
                      }, (err, res) => {
                        redis.SET(`${obj}:contents`, file, (a, b) => {

                          // Add TTL
                          redis.expire(obj, settings.generators[this.name].redisSnippetTTL);
                          redis.expire(`${obj}:contents`, settings.generators[this.name].redisSnippetTTL);
                          this.generator.send({
                            type: 'response',
                            mode: 'snippet',
                            data: {
                              signature: msg.data.signature,
                              status: true
                            },
                          });
                        });
                      });
                    });
                  }
                });
              });
            });
          }
        });
      }

    } else if (msg.type === 'done') {
      this.emit(`taskFinished${this.guid}`, {error: msg.data.error, results: msg.data.results, fmt: msg.data.fmt, logs: msg.data.logs});

    } else if (msg.type === 'cmdComplete') {
      if (msg.mode === 'memory') {
        this.emit(`memComplete${this.guid}`, msg.content);

      } else if (msg.mode === 'lists') {
        this.emit(`listsComplete${this.guid}`, msg.content);

      } else if (msg.mode === 'listCache') {
        this.emit(`listCacheComplete${this.guid}`, msg.content);

      } else if (msg.mode === 'snippetCache') {
        this.emit(`snippetCacheComplete${this.guid}`, msg.content);

      }

    } else if (msg.type === 'pong') {
      this.emit(`pong${this.guid}`);

    } else if (msg.type === 'ping') {
      this.send({
        type: 'pong'
      });
    }
  });
};

GeneratorForker.prototype.initQueue = function() {
  this.queue = async.queue((task, callback) => {
    this.jobCount++;
    this.lastJobTime  = new Date().getTime();

    // Linter, Demo, or normal request?
    if (task.socket !== undefined) {
      if (task.data.type === "snippet") {
        var options = {key: null, src: task.data.src, ref: null};

        if (checkAbuse(null, task.socket.id)) {
          task.socket.emit('abuse');
          return callback();
        }

        this.generate({mode: 'snippet', options}, (error, results, fmt, logs) => {
          checkAbuse(error, task.socket.id);

          results = JSON.stringify(JSON.parse(results).results[0], null, 2);
          if (results.length > 65535) {
            results = "Warning: Output has been truncated\n----------\n" + results.slice(0, 65535) + "\n----------";
          }
          task.socket.emit('codeLinted', {error, results, fmt, logs});
          callback();
        });

      } else {
        // Check to see if we are linting a logged in user or guest trying out the linter
        var options;
        if (task.data.owner === null) {
          options = {key: null, src: task.data.src, ref: null};
        } else {
          options = {key: task.data.owner.apikey, src: task.data.src, ref: task.data.ref};
        }

        if (checkAbuse(null, task.socket.id)) {
          task.socket.emit('abuse');
          return callback();
        }

        this.generate({mode: 'lint', options}, (error, results, fmt, logs) => {
          checkAbuse(error, task.socket.id);

          results = JSON.stringify(JSON.parse(results).results[0], null, 2);

          // Don't know what is causing this...try and catch the problem for debugging
          try {
            if (results.length > 65535) {
              results = "Warning: Output has been truncated\n----------\n" + results.slice(0, 65535) + "\n----------";
            }
          } catch (e) {
            syslog(e);
            syslog(results);
            results = "";
          }

          task.socket.emit('codeLinted', {error, results, fmt, logs});
          callback();
        });
      }
    } else {
      let ref;
      if (task.req.params.ref === undefined) {
        ref = task.req.query.ref;
      } else {
        ref = task.req.params.ref;
      }
      _.merge(task.req.query, {ref});

      this.generate({mode: 'generate', options: task.req.query}, (error, results, fmt) => {
        if (fmt === 'json') {
          task.res.setHeader('Content-Type', 'application/json');
        } else if (fmt === 'xml') {
          task.res.setHeader('Content-Type', 'text/xml');
        } else if (fmt === 'yaml') {
          task.res.setHeader('Content-Type', 'text/x-yaml');
        } else if (fmt === 'csv') {
          task.res.setHeader('Content-Type', 'text/csv');
        } else {
          task.res.setHeader('Content-Type', 'text/plain');
        }
        if (error !== null) {
          if (error === "INVALID_API") {
            task.res.status(404).send({error});
          } else if (error === "UNAUTHORIZED_USER") {
            task.res.status(401).send({error});
          } else {
            task.res.status(403).send(error.formatted);
          }
        } else {
          task.res.status(200).send(results);
        }

        callback();
      });
    }
  }, 1);
};

// Opts contains options and mode
GeneratorForker.prototype.generate = function(opts, cb) {

  // Send generator a new task using the given mode and options
  this.send({
    type: 'task',
    mode: opts.mode,
    data: opts.options
  });

  // Wait for the task to finish and then send err, results, and fmt to cb.
  this.once(`taskFinished${this.guid}`, data => {
    cb(data.error, data.results, data.fmt, data.logs);
  });
};

// Get current task queue length
GeneratorForker.prototype.queueLength = function() {
  return this.queue.length();
};

GeneratorForker.prototype.killQueue = function() {
  this.queue.kill();
  this.initQueue();
};

GeneratorForker.prototype.totalJobs = function() {
  return this.jobCount;
};

GeneratorForker.prototype.memUsage = function() {
  return this.memory;
};

GeneratorForker.prototype.listCacheUsage = function() {
  return this.listCache;
};

GeneratorForker.prototype.snippetCacheUsage = function() {
  return this.listCache;
};

GeneratorForker.prototype.gc = function() {
  this.send({
    type: 'cmd',
    mode: 'gc'
  });
};

GeneratorForker.prototype.emptyListCache = function() {
  this.send({
    type: 'cmd',
    mode: 'emptyListCache'
  });
};

GeneratorForker.prototype.emptySnippetCache = function() {
  this.send({
    type: 'cmd',
    mode: 'emptySnippetCache'
  });
};

GeneratorForker.prototype.removeList = function(ref) {
  this.send({
    type: 'cmd',
    mode: 'removeList',
    data: ref
  });
};

GeneratorForker.prototype.removeAPI = function(ref) {
  this.send({
    type: 'cmd',
    mode: 'removeAPI',
    data: ref
  });
};

GeneratorForker.prototype.removeSnippet = function(ref) {
  this.send({
    type: 'cmd',
    mode: 'removeSnippet',
    data: ref
  });
};

GeneratorForker.prototype.send = function(obj) {
  // Prevent crashes if the Generator is in the middle of restarting
  try {
    this.generator.send(obj);
  } catch(e) {}
}

function checkAbuse(error, id) {
  // abuse is considered <abuseLimit> requests per second
  // Block further requests until until 30 seconds have passed without another barrage
  if (id in timeout) return true;
  else if (error === null || error.error !== "Error: Script execution timed out.") return false;

  if (!(id in abuseCache)) {
    abuseCache[id] = {
      firstAccess: new Date().getTime(),
      lastAccess:  new Date().getTime(),
      total: 1
    };

  // Update current stats
  } else {
    abuseCache[id].lastAccess = new Date().getTime();
    abuseCache[id].total++;
  }

  // Check for abuse
  if (abuseCache[id] && abuseCache[id].total > abuseLimit && abuseCache[id].lastAccess - abuseCache[id].firstAccess < 15000) {
    timeout[id] = new Date().getTime(); // time they were placed into time out
    return true;
  }
  return false;
}

function checkTimeout() {
  _.each(timeout, (a, b) => {
    if (new Date().getTime() - a > 30000) {
      delete timeout[b];
    }
  });
}

module.exports = GeneratorForker;

'use strict'
const fork     = require('child_process').fork;
const util     = require('util');
const async    = require('async');
const _        = require('lodash');
const EventEmitter = require('events').EventEmitter;
const logger   = require('../../utils').logger;
const redis    = require('../../utils').redis;
const settings = require('../../settings');
const fs       = require('fs');

const API  = require('../../models/API');
const List = require('../../models/List');
const User = require('../../models/User');
const Snippet = require('../../models/Snippet');

const GeneratorForker = function(options) {
  let self = this;

  this.info = {
    execTime: options.execTime,
    results:  options.results
  };

  this.name      = options.name;
  this.startTime = new Date().getTime();
  this.jobCount  = 0;
  this.memory    = 0;
  this.listCache = 0;
  this.snippetCache = 0;

  // Queue to push generate requests into
  this.queue = async.queue((task, callback) => {
    this.jobCount++;

    // Realtime or Speedtest
    if (task.socket !== undefined) {
      if (task.data.type === "snippet") {
        var options = {key: null, src: task.data.src, ref: null};

        this.generate({mode: 'snippet', options}, (error, results, fmt) => {
          results = JSON.stringify(JSON.parse(results).results[0], null, 2);
          if (results.length > 65535) {
            results = "Warning: Output has been truncated\n----------\n" + results.slice(0, 65535) + "\n----------";
          }
          task.socket.emit('codeLinted', {error, results, fmt});
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
        this.generate({mode: 'lint', options}, (error, results, fmt) => {
          results = JSON.stringify(JSON.parse(results).results[0], null, 2);
          if (results.length > 65535) {
            results = "Warning: Output has been truncated\n----------\n" + results.slice(0, 65535) + "\n----------";
          }
          task.socket.emit('codeLinted', {error, results, fmt});
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

  this.fork();

  generatorChecks();

  // See if child process is alive during 5 second check
  setInterval(generatorChecks, 5000);

  function generatorChecks() {
    self.childReplied = false;
    setTimeout(() => {
      if (!self.childReplied) {
        self.generator = null;
        self.fork();
      }
    }, 5000)
    try {
      self.send({type: 'ping'});
    } catch(e) {}
    self.once('pong', () => {
      self.childReplied = true;
    });

    self.send({
      type: 'cmd',
      data: 'getMemory'
    });

    self.once('memComplete', data => {
      self.memory = Math.floor(data/1024/1024);
    });

    self.send({
      type: 'cmd',
      data: 'getListCache'
    });

    self.send({
      type: 'cmd',
      data: 'getSnippetCache'
    });

    self.once('listCacheComplete', data => {
      self.listCache = Math.floor(data/1024/1024);
    });

    self.once('snippetCacheComplete', data => {
      self.snippetCache = Math.floor(data/1024/1024);
    });
  }
};

util.inherits(GeneratorForker, EventEmitter);

GeneratorForker.prototype.fork = function() {
  // Fork new Generator with provided info
  this.generator = fork(__dirname + '/Generator', [this.name, JSON.stringify(this.info)]);

  // Handle all events
  // {type, mode, data}
  this.generator.on('message', msg => {
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

              // Verify user has permission to access this list
              if (Number(obj.owner) === msg.data.user.id) {

                // Update lastUsed time
                if (obj.ref !== undefined) {
                  redis.hset("list:" + obj.ref, "lastUsed", new Date().getTime());
                }

                this.generator.send({type: 'response', mode: 'list', data: true});
              } else {
                this.generator.send({type: 'response', mode: 'list', data: false});
              }
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
                    redis.SADD("list:" + doc.ref + ":contents", file.split('\n').slice(0, -1), () => {

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
        let obj = `snippet:${msg.data.user}/${msg.data.name}/${msg.data.version}`;

        // Check if snippet exists in the cache
        redis.exists(obj, (err, result) => {

          // Snippet exists in the cache
          if (result === 1) {

            // Update TTL
            redis.expire(obj, settings.generators[this.name].redisSnippetTTL);
            redis.expire(`${obj}:contents`, settings.generators[this.name].redisSnippetTTL);

            redis.hgetall(obj, (err, obj) => {

              // Update lastUsed time
              if (obj.ref !== undefined) {
                redis.hset(obj, "lastUsed", new Date().getTime());
              }

              this.generator.send({type: 'response', mode: 'snippet', data: true});
            });

          // Add snippet to cache if user has permission
          } else {
            Snippet.getCond({username: msg.data.user, name: msg.data.name, version: msg.data.version}).then(doc => {
              if (doc === null) {
                this.generator.send({type: 'response', mode: 'snippet', data: false});
              } else {
                fs.readFile(process.cwd() + '/data/snippets/' + doc.id + '.snippet', 'utf8', (err, file) => {
                  // prepend and append
                  file = `(function() {
  let snippet = {};
  ${file}
  return snippet;
})();`;
                  redis.hmset(obj, {
                    added: new Date().getTime(),
                    owner: doc.owner,
                    lastUsed: new Date().getTime()
                  }, (err, res) => {
                    redis.SET(`${obj}:contents`, file, (a, b) => {

                      // Add TTL
                      redis.expire(obj, settings.generators[this.name].redisSnippetTTL);
                      redis.expire(`${obj}:contents`, settings.generators[this.name].redisSnippetTTL);

                      this.generator.send({type: 'response', mode: 'snippet', data: true});
                    });
                  });
                });
              }
            });
          }
        });
      }
    } else if (msg.type === 'done') {
      this.emit('taskFinished', {error: msg.data.error, results: msg.data.results, fmt: msg.data.fmt});
    } else if (msg.type === 'cmdComplete') {
      if (msg.mode === 'memory') {
        this.emit('memComplete', msg.content);
      } else if (msg.mode === 'lists') {
        this.emit('listsComplete', msg.content);
      } else if (msg.mode === 'listCache') {
        this.emit('listCacheComplete', msg.content);
      } else if (msg.mode === 'snippetCache') {
        this.emit('snippetCacheComplete', msg.content);
      }
    } else if (msg.type === 'pong') {
      this.emit('pong');
    } else if (msg.type === 'ping') {
      this.send({
        type: 'pong'
      });
    }
  });
};

// Opts contains options and mode
// cb(err, results, fmt)
GeneratorForker.prototype.generate = function(opts, cb) {
  // Send generator a new task using the given mode and options
  this.send({
    type: 'task',
    mode: opts.mode,
    data: opts.options
  });

  // Wait for the task to finish and then send err, results, and fmt to cb.
  this.once('taskFinished', data => {
    cb(data.error, data.results, data.fmt);
  });
};

// Get current task queue length
GeneratorForker.prototype.queueLength = function() {
  return this.queue.length();
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
    data: 'gc'
  });
};

GeneratorForker.prototype.emptyListCache = function() {
  this.send({
    type: 'cmd',
    data: 'emptyListCache'
  });
};

GeneratorForker.prototype.emptySnippetCache = function() {
  this.send({
    type: 'cmd',
    data: 'emptySnippetCache'
  });
};

GeneratorForker.prototype.send = function(obj) {
  // Prevent crashes if the Generator is in the middle of restarting
  try {
    this.generator.send(obj);
  } catch(e) {}
}

module.exports = GeneratorForker;

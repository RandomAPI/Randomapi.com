// Base modules
const crypto       = require('crypto');
const fs           = require('fs');
const vm           = require('vm');
const async        = require('async');
const util         = require('util');
const EventEmitter = require('events').EventEmitter;

// Requires
const Promise      = require('bluebird').Promise;
const mersenne     = new (require('mersenne-twister'));
const _            = require('lodash');
const numeral      = require('numeral')
const logger       = require('../../utils').logger;
const redis        = require('../../utils').redis;
const settings     = require('../../utils').settings;

// Formatting tools
const YAML         = require('yamljs');
const js2xmlparser = require('js2xmlparser');
const converter    = require('json-2-csv');

const Generator = function(name, guid, options) {
  this.version  = '0.1';
  this.name     = name || 'generator';
  this.guid     = guid;
  process.title = 'RandomAPI_Generator ' + this.guid + ' ' + this.name;

  options   = JSON.parse(options);
  this.info = {
    execTime: options.execTime,
    results:  options.results
  };

  this.cache = {
    api: {
      size: 0,
      objects: {}
    },
    list: {
      size: 0,
      objects: {}
    },
    snippet: {
      size: 0,
      objects: {}
    },
    timeout: {}
  };

  this.times = {};
  this.globs = {};

  this.times = {};  // Duration for different sections
  this.globs = {};  // Holds all of the global snippets
  this.globRequires = [
    'faker',
    'deity',
    'moment'
  ];

  // immutablify globs/allow specific props to be mutable
  this.configureGlobs();

  // Create context for sandbox with proxied functions
  this.context = vm.createContext(this.availableFuncs());

  // Default context to compare against for global variable removal
  this.originalContext = [
    'random', 'list', 'hash', 'timestamp',
    'require', '_APIgetVars', '_APIresults',
    '_APIstack', '_APIerror', 'getVar', 'stacktrace', 'prng'
  ];

  // Built in objects
  this.reservedObjects = {
    Array, Boolean, Date, decodeURI, decodeURIComponent, encodeURI,
    encodeURIComponent, Error, EvalError, Function, isFinite, isNaN,
    Math, Number, Object, parseInt, parseFloat, RangeError,
    ReferenceError, RegExp, String, SyntaxError, TypeError, URIError,
    JSON, Proxy, Reflect, Symbol, WeakMap, WeakSet,
    escape, unescape
  };

  // Checks to see if parent server/child process is alive
  this.parentReplied = true;

  // Handle all IPC messages
  process.on(`message`, msg => {

    if (msg.type === 'task') {

      if (msg.mode === 'generate') {
        this.instruct(msg.data, error => {
          if (error) {
            process.send({type: 'done', data: {error, results: null, fmt: null}});
          } else {
            this.generate((error, results, fmt, logs) => {
              process.send({type: 'done', data: {error, results, fmt, logs}});
            });
          }
        });

      } else {
        this.seed   = String(msg.mode + ~~(Math.random() * 100));
        this.format = 'pretty';
        this.noinfo = true;
        this.sole   = false;
        this.page   = 1;
        this.mode   = msg.mode;
        this.src    = msg.data.src;
        delete msg.data.src;

        this.instruct(msg.data, err => {
          this.generate((error, results, fmt, logs) => {
            process.send({type: 'done', data: {error, results, fmt, logs}});
          });
        });
      }

    } else if (msg.type === 'response') {
      if (msg.mode === 'api') {
        this.emit(`apiResponse${this.guid}`, msg.data);

      } else if (msg.mode === 'user') {
        this.emit(`userResponse${this.guid}`, msg.data);

      } else if (msg.mode === 'list') {
        this.emit(`listResponse${this.guid}`, msg.data);

      } else if (msg.mode === 'snippet') {
        this.emit(`snippetResponse:${msg.data.signature}${this.guid}`, msg.data);
      }

    } else if (msg.type === 'cmd') {

      if (msg.mode === 'getMemory') {
        process.send({type: 'cmdComplete', mode: 'memory', content: process.memoryUsage().heapUsed});

      } else if (msg.mode === 'gc') {
        global.gc();

      } else if (msg.mode === 'emptyListCache') {
        this.emptyListCache();

      } else if (msg.mode === 'getListCache') {
        this.cache.list.size = 0;
        _.each(this.cache.list, item => {
          this.cache.list.size += Number(item.size);
        });
        process.send({type: 'cmdComplete', mode: 'listCache', content: this.cache.list.size});

      } else if (msg.mode === 'emptyAPICache') {
        this.emptyAPICache();

      } else if (msg.mode === 'getAPICache') {
        this.cache.api.size = 0;
        _.each(this.cache.api, item => {
          this.cache.api.size += Number(item.size);
        });
        process.send({type: 'cmdComplete', mode: 'apiCache', content: this.cache.api.size});

      } else if (msg.mode === 'emptySnippetCache') {
        this.emptySnippetCache();

      } else if (msg.mode === 'getSnippetCache') {
        this.cache.snippet.size = 0;
        _.each(this.cache.snippet.objects, item => {
          this.cache.snippet.size += Number(item.size);
        });
        process.send({type: 'cmdComplete', mode: 'snippetCache', content: this.cache.snippet.size});

      } else if (msg.mode === 'removeList') {
        let ref = msg.data;

        if (ref in this.cache.list.objects) {
          // Update cache size and delete list from cache
          this.cache.list.size -= this.cache.list.objects[ref].size;
          delete this.cache.list.objects[ref];
        }

        // Delete keys from Redis
        redis.del(`list:${ref}`)
        redis.del(`list:${ref}:contents`);

      } else if (msg.mode === 'removeAPI') {
        let ref = msg.data;

        if (ref in this.cache.api.objects) {
          // Update cache size and delete list from cache
          this.cache.api.size -= this.cache.api.objects[ref].size;
          delete this.cache.api.objects[ref];
        }

      } else if (msg.mode === 'removeSnippet') {
        let ref = msg.data;

        if (ref in this.cache.snippet.objects) {

          // Update cache size and delete snippet from cache
          this.cache.snippet.size -= this.cache.snippet.objects[ref].size;
          delete this.cache.snippet.objects[ref];
        }

        // Delete keys from Redis
        redis.del(`snippet:${ref}`)
        redis.del(`snippet:${ref}:contents`);
      }
    } else if (msg.type === 'pong') {
      this.emit(`pong${this.guid}`);

    } else if (msg.type === 'ping') {
      process.send({
        type: 'pong'
      });
    }
  });

  // Commit sudoku if parent process doesn't reply during 5 second check
  setInterval(() => {
    this.parentReplied = false;
    setTimeout(() => {
      if (!this.parentReplied) {
        process.exit();
      }
    }, 5000)
    try {
      process.send({type: 'ping'});
    } catch(e) {}
    this.once(`pong${this.guid}`, () => {
      this.parentReplied = true;
    });

    // See if any lists have expired or if over the max size limit
    this.checkListCache();

    // See if any apis have expired or if over the max size limit
    this.checkAPICache();

    // See if any snippets have expired
    this.checkSnippetCache();
  }, 5000)
};

util.inherits(Generator, EventEmitter);

// Receives the query which contains API, owner, and reqest data
Generator.prototype.instruct = function(options, done) {
  this.times.instruct = {
    start: new Date().getTime()
  };

  this.options = options || {};
  this.results = Number(this.options.results);
  this.seed    = this.options.seed || '';
  this.format  = (this.options.format || this.options.fmt || 'json').toLowerCase();
  this.noInfo  = typeof this.options.noinfo !== 'undefined';
  this.sole    = typeof this.options.sole !== 'undefined' || typeof this.options.onlyone !== 'undefined';
  this.page    = Number(this.options.page) || 1;

  this.hideuserinfo = typeof this.options.hideuserinfo !== 'undefined';

  if (this.mode === undefined) this.mode = options.mode || "generator";

  // Sanitize values
  if (isNaN(this.results) || this.results < 0 || this.results > this.info.results || this.results === '' || this.sole) this.results = 1;
  if (this.seed === '') this.defaultSeed();
  if (this.page < 0 || this.page > 10000) this.page = 1;
  ///////////////////

  this.seedRNG();

  async.series([
    cb => {
      process.send({type: 'lookup', mode: 'api', data: options.ref});

      this.once(`apiResponse${this.guid}`, data => {
        this.doc = data;

        if (!this.doc) {
          cb('INVALID_API');
        } else {
          cb(null);
        }
      });
    },
    cb => {
      process.send({type: 'lookup', mode: 'user', data: this.doc.owner});

      this.once(`userResponse${this.guid}`, data => {
        this.user = data;
        this.options.userID  = data.id;

        if (data.apikey.toLowerCase() !== this.options.key.toLowerCase()) {
          cb('UNAUTHORIZED_USER');
        } else {
          cb(null);
        }

      });
    },
    cb => {
      if (this.mode !== "lint" && this.mode !== "snippet") {

        // Get API src
        if (this.doc.ref in this.cache.api.objects) {
          this.src = this.cache.api.objects[this.doc.ref];
        } else {
          this.cache.api.objects[this.doc.ref] = fs.readFileSync('./data/apis/' + this.doc.id + '.api', 'utf8');
          this.src = this.cache.api.objects[this.doc.ref]
        }
      }
      cb(null);
    }
  ], (err, results) => {
    // Make sure user is populated with dummy user if no real user provided
    this.user = this.user || {id: -1, apikey: ''};
    this.times.instruct = new Date().getTime() - this.times.instruct.start;
    done(err);
  });
};

Generator.prototype.generate = function(cb) {
  this.times.generate = {
    start: new Date().getTime()
  };

  this.results = this.results || 1;
  let output   = [];

  // Get md5sum of source code contents for timeout causing scripts
  let hash = crypto.createHash('md5').update(this.src).digest('hex');

  // Check if src code causes timeout
  if (hash in this.cache.timeout) {
    return this.returnResults({error: "Error: Script execution timed out."}, [{}], cb);
  }

  // Replaces requires with the src code so that they can run in sandbox
  this.updateRequires().then(() => {

    try {
      if (this.mode !== 'snippet') {
        this.sandBox = new vm.Script(`
          'use strict'
          var _APIgetVars = ${JSON.stringify(_.defaults(this.options, {seed: this.seed, numericSeed: this.numericSeed}))};
          var _APIresults = [];
          var _APIlogs = [];
          var _APIerror = null;
          var _APIstack = null;
          var console = {
            log: (...args) => _APIlogs.push(...args)
          };
          (function() {
            for (var _APIi = 0; _APIi < ${this.results}; _APIi++) {
              var api = {};
              try {
${this.src}
              } catch (e) {
                api = {};
                _APIerror = e.toString();
                _APIstack = e.stack;
              }
              _APIresults.push(api);
            }
          })();
          function getVar(key) {
            return key in _APIgetVars ? _APIgetVars[key] : null;
          }
        `);
      } else {
        this.sandBox = new vm.Script(`
          'use strict'
          var _APIgetVars = ${JSON.stringify(_.defaults(this.options, {seed: this.seed, numericSeed: this.numericSeed}))};
          var _APIresults = [];
          var _APIlogs = [];
          var _APIerror = null;
          var _APIstack = null;
          var console = {
            log: (...args) => _APIlogs.push(...args)
          };
          (function() {
            var snippet = {};
            try {
${this.src}
var _APISnippetKeys = Object.keys(snippet);
// Assume default function
if (_APISnippetKeys.length === 0) {
  if (typeof snippet === 'function') {
    snippet = snippet();
  }
} else {
  for (var _APIi = 0; _APIi < _APISnippetKeys.length; _APIi++) {
    if (typeof snippet[_APISnippetKeys[_APIi]] !== 'function') {
      throw new Error("Snippet " + _APISnippetKeys[_APIi] + " is not a function");
    } else {
      snippet[_APISnippetKeys[_APIi]] = snippet[_APISnippetKeys[_APIi]]();
    }
  }
}
            } catch (e) {
              snippet = {};
              _APIerror = e.toString();
              _APIstack = e.stack;
            }
            _APIresults.push({snippet});
          })();
          function getVar(key) {
            return key in _APIgetVars ? _APIgetVars[key] : null;
          }
        `);
      }

      this.sandBox.runInContext(this.context, {
        displayErrors: true,
        timeout: this.info.execTime * 1000
      });

      if (this.context._APIerror === null && this.context._APIstack === null) {
        this.returnResults(null, this.context._APIresults, this.context._APIlogs, cb);
      } else {
        this.returnResults({error: this.context._APIerror, stack: this.context._APIstack}, [{}], this.context._APIlogs, cb);
      }
    } catch(e) {
      if (e.toString().indexOf('Script execution timed out') !== -1) {
        this.cache.timeout[hash] = true;
      }
      this.returnResults({error: e.toString(), stack: e.stack}, [{}], this.context._APIlogs, cb);
    }

    // Remove user defined globals
    let diff = Object.keys(this.context);
    diff.filter(each => this.originalContext.indexOf(each) === -1).forEach(each => delete this.context[each]);

    // Restore reservedObjects if tampered with
    _.each(this.reservedObjects, (object, val) => {
      const a = object;
      this.context[val] = a;
    });

    _.each(this.reservedObjects, (object, val) => {
      immutablify(this.context[val]);
    });

  }, e => {
    this.returnResults({error: e.toString(), stack: e.stack}, [{}], this.context._APIlogs, cb);
  });
};

Generator.prototype.seedRNG = function() {
  let seed = this.page !== 1 ? this.seed + String(this.page) : this.seed;

  this.numericSeed = parseInt(crypto.createHash('md5').update(seed).digest('hex').substring(0, 8), 16);
  mersenne.init_seed(this.numericSeed);
};

Generator.prototype.defaultSeed = function() {
  this.seed = random(1, 16);
};

Generator.prototype.availableFuncs = function() {
  let self = this;

  // Actual logic
  const funcs = {
    random: {
      numeric: (min = 1, max = 100) => {
        return range(min, max);
      },
      special: (mode, length) => {
        if (length > 65535) length = 1;
        return random(mode, length);
      },
      custom: (charset, length) => {
        if (length > 65535) length = 1;
        return random(-1, length, charset);
      }
    },
    list: (obj, num) => {
      if (num !== '' && num !== undefined) num = Number(num); // Convert string to num if it isn't undefined
      if (num === '') num = undefined;
      if (obj === '' || obj === undefined) throw new Error(`Empty list value provided`);

      else if (Array.isArray(obj)) {
        if (num < 0 || num > obj.length-1) {
          throw new Error(`Index ${num} is out of range for array.`);
        } else {
          if (num !== undefined) {
            return obj[num];
          } else {
            return obj[range(0, obj.length-1)];
          }
        }
      } else if (typeof obj === "object") {
        let keys = Object.keys(obj);

        if (num < 0 || num > keys.length-1) {
          throw new Error(`Index ${num} is out of range for object.`);
        } else {
          if (num !== undefined) {
            return keys[num];
          } else {
            return keys[range(0, keys.length-1)];
          }
        }
      } else if (typeof obj === "string") {
        if (this.mode === 'snippet') throw new Error(`Lists are not available in Snippets; only inline lists are allowed`);
        // Check if list is in local generator list cache
        // If not, fetch from redis cache and add it to the local list cache
        if (obj in this.cache.list.objects) {

          // Update local listCache lastUsed date
          // Also update redis listCache lastUsed date
          this.cache.list.objects[obj].lastUsed = new Date().getTime();

          if (num !== undefined) {
            if (num < 1 || num > this.cache.list.objects[obj].contents.length) {
              throw new Error(`Line ${num} is out of range for list ${obj}`);
            } else {
              item = this.cache.list.objects[obj].contents[num-1];
            }
          } else {
            item = randomItem(this.cache.list.objects[obj].contents);
          }
          return item;

        } else {
          process.send({type: 'lookup', mode: 'list', data: {ref: obj, user: {id: this.options.userID, tier: this.options.userTier}}});

          let done = false;
          let item = null;

          this.once(`listResponse${this.guid}`, result => {

            if (result === false) {
              throw new Error(`You aren't authorized to access list ${obj}`);
              done = true;
            } else {
              redis.get("list:" + obj + ":contents", (err, file) => {
                file = file.split('\n').slice(0, -1);

                // Fetch metadata for list and store in local generator listCache
                redis.hgetall("list:" + obj, (err, info) => {
                  this.cache.list.objects[obj] = {
                    added: new Date().getTime(),
                    contents: file,
                    size: Number(info.size),
                    owner: Number(info.owner),
                    lastUsed: new Date().getTime(),
                  };

                  if (num !== undefined) {
                    if (num < 1 || num > file.length) {
                      throw new Error(`Line ${num} is out of range for list ${obj}`);
                    } else {
                      item = file[num-1];
                    }
                  } else {
                    item = randomItem(file);
                  }
                  done = true;
                });
              });
            }
          });
          require('deasync').loopWhile(function(){return !done;});
          return item;
        }
      } else {
        throw new Error(`Invalid argument sent in for list.`);
      }
    },
    hash: {
      md5: val => {
        return crypto.createHash('md5').update(String(val)).digest('hex');
      },
      sha1: val => {
        return crypto.createHash('sha1').update(String(val)).digest('hex');
      },
      sha256: val => {
        return crypto.createHash('sha256').update(String(val)).digest('hex');
      }
    },
    timestamp: () => {
      return Math.floor(new Date().getTime()/1000);
    },
    stacktrace: () => {
      try {
        var obj = {};
        Error.captureStackTrace(obj, this.availableFuncs.a);

        let parseStack = obj.stack.toString().match(/evalmachine.*?:(\d+)(?::(\d+))?/);
        let line = parseStack[1]-14;
        let col  = parseStack[2];
        return `Stack trace called from line ${line}${col === undefined ? "." : " column " + col}`;
      } catch (e) {
        return 'Error calling stack trace';
      }
    },

    // Hardcoded native requires
    require: function(lib) {
      if (lib === undefined || lib.toString().length === 0) {
        throw new Error(`No snippet signature provided`);
        return;
      }

      lib = lib.toString().trim();
      if (lib === undefined || lib.length === 0) throw new Error(`No snippet signature provided`);

      // Make sure valid glob
      if (self.globRequires.indexOf(lib) !== -1) {

        switch(lib) {
          case 'faker':
            // Reset faker back to en locale
            self.globs.faker.locale = 'en';
            self.globs.faker.seed(Math.floor(self.numericSeed*prng())%2147483648);
            break;
          case 'deity':
            break;
          case 'moment':
            self.globs.moment.locale('en');
            break;
        };
        return self.globs[lib];
      } else {
        throw new Error(`Global snippet ${lib} was not found`);
      }
    }
  };

  // Proxy to hide logic
  const proxy =  {
    random: {
      numeric: (min, max)       => funcs.random.numeric(min, max),
      special: (mode, length)   => funcs.random.special(mode, length),
      custom: (charset, length) => funcs.random.custom(charset, length)
    },
    list: (obj, num) => funcs.list(obj, num),
    hash: {
      md5: val    => funcs.hash.md5(val),
      sha1: val   => funcs.hash.sha1(val),
      sha256: val => funcs.hash.sha256(val)
    },
    timestamp: () => funcs.timestamp(),
    stacktrace: () => funcs.stacktrace(),
    require: lib => funcs.require(lib),
    prng
  };

  _.each(proxy, object => {
    immutablify(object);
  });

  return proxy;
};

Generator.prototype.require = function(signature) {
  if (signature === undefined || signature.length === 0) {
    throw new Error(`No snippet signature provided`);
    return;
  }

  let tmp = signature.split('/');

  // No version supplied
  if (tmp.length === 2) {
    obj = `${tmp[0]}/${tmp[1]}`;
  } else {
    obj = `${tmp[0]}/${tmp[1]}/${tmp[2]}`;
  }

  // Check if snippet is in local snippet cache
  // If not, fetch from redis snippet cache and add it to the local snippet cache
  if (obj in this.cache.snippet.objects) {

    if (this.cache.snippet.objects[obj].published === 1 || this.cache.snippet.objects[obj].owner === this.user.id) {

      // Update local snippet cache lastUsed date
      this.cache.snippet.objects[obj].lastUsed = new Date().getTime();
      return this.cache.snippet.objects[obj].snippet;
    } else {
      throw new Error(`Snippet signature ${obj} wasn't recognized`);
    }
  } else {
    process.send({
      type: 'lookup',
      mode: 'snippet',
      data: {signature, user: this.user}
    });

    let done = false;
    let contents = null;

    this.once(`snippetResponse:${signature}${this.guid}`, result => {
      // Generic unrecognized snippet
      if (result.status === false && result.msg === undefined) {
        done = true;
        throw new Error(`Snippet signature ${obj} wasn't recognized`);

      } else if (result.msg === "missing_version") {
        done = true;
        throw new Error(`Version number is missing`);

      } else if (result.msg === "invalid_version") {
        done = true;
        throw new Error(`Invalid version number`);

      } else if (!done) {
        redis.GET(`snippet:${obj}:contents`, (err, snippet) => {

          // Fetch metadata for snippet and store in local generator snippet cache
          redis.hgetall(`snippet:${obj}`, (err, info) => {
            this.cache.snippet.objects[obj] = {
              added: new Date().getTime(),
              snippet,
              size: info.size,
              owner: Number(info.owner),
              published: Number(info.published),
              lastUsed: new Date().getTime()
            };
            contents = snippet;
            done = true;
          });
        });
      }
    });
    require('deasync').loopWhile(function(){return !done;});
    return contents;
  }
};

Generator.prototype.checkListCache = function() {
  let sizes = {};
  _.each(this.cache.list, (obj, ref) => {
    sizes[ref] = obj.size;
    if (new Date().getTime() - obj.lastUsed > settings.generators[this.name].localTTL * 1000) {
      delete this.cache.list.objects[ref];
    }
  });

  sizes = _.toPairs(sizes);
  sizes.sort((a, b) => ~~b[1] - ~~a[1]);

  while (this.cache.list.size > settings.generators[this.name].localCache * 1024 * 1024) {
    let toRemove = sizes.shift();
    delete this.cache.list.objects[toRemove[0]];
    this.cache.list.size -= toRemove[1];
  }
};

Generator.prototype.checkAPICache = function() {
  let sizes = {};
  _.each(this.cache.api, (obj, ref) => {
    sizes[ref] = obj.size;
    if (new Date().getTime() - obj.lastUsed > settings.generators[this.name].localTTL * 1000) {
      delete this.cache.api.objects[ref];
    }
  });

  sizes = _.toPairs(sizes);
  sizes.sort((a, b) => ~~b[1] - ~~a[1]);

  while (this.cache.api.size > settings.generators[this.name].localCache * 1024 * 1024) {
    let toRemove = sizes.shift();
    delete this.cache.api.objects[toRemove[0]];
    this.cache.api.size -= toRemove[1];
  }
};

Generator.prototype.checkSnippetCache = function() {
  let sizes = {};

  _.each(this.cache.snippet.objects, (obj, ref) => {
    if (new Date().getTime() - obj.lastUsed > settings.generators[this.name].localSnippetTTL * 1000) {
      delete this.cache.snippet.objects[ref];
    }
  });
};

Generator.prototype.emptyListCache = function() {
  this.cache.list.objects = {};
};

Generator.prototype.emptySnippetCache = function() {
  this.cache.snippet.objects = {};
};

// Only global snippets can be required in other snippets
Generator.prototype.updateRequires = function() {

  return new Promise((resolve, reject) => {
    // Don't let snippets include other snippets
    if (this.mode === 'snippet') resolve();
    else {
      let rawMatches = this.src.match(/require\((?:["'`]([A-z0-9]*\/[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]*(?:\/[0-9]*?)?|~.[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]*(?:\/[0-9]*?)?)["'`]\))/g);
      let index = 0;

      try {
        // There are matches
        if (rawMatches !== null) {
          let reg = new RegExp(/require\((?:["'`]([A-z0-9]*\/[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]*(?:\/[0-9]*?)?|~.[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]*(?:\/[0-9]*?)?)["'`]\))/g);
          let match = reg.exec(this.src);
          while (match !== null) {
            let result = (match[1] || match[2]).trim();
            if (result.indexOf('~') === 0) {
              if (this.user.id !== -1) {
                result = this.user.username + '/' + result.slice(1);
              } else {
                reject("Shorthand user requires can not be used in demo mode.");
                return;
              }
            }
            this.src = this.src.replace(rawMatches[index++], this.require(result));
            match = reg.exec(this.src);
          }
        }
      } catch(e) {
        reject(e);
      }
      resolve();
    }
  });
};

Generator.prototype.returnResults = function(err, output, logs, cb) {
  this.times.generate = new Date().getTime() - this.times.generate.start;
  if (err === null) {
    let json = {
      results: output,
      info: {
        seed: String(this.seed),
        results: numeral(this.results).format('0,0'),
        page: numeral(this.page).format('0,0'),
        version: this.version,
        time: this.times
      }
    };

    if (this.user !== undefined) {
      json.info.user = {
        username: this.user.username,
        tier: this.user.tierName + ` [${this.user.tierID}]`,
        results: numeral(this.user.results).format('0,0') + " / " + String(this.user.tierResults !== 0 ? numeral(this.user.tierResults).format('0,0') : "unlimited"),
        remaining: this.user.tierResults !== 0 ? numeral(this.user.tierResults - this.user.results).format('0,0') : "unlimited"
      };
    }

    if (this.noInfo) delete json.info;
    if (this.hideuserinfo && !this.noInfo) delete json.info.user;
    if (this.sole) json.results = json.results[0];

    if (this.format === 'yaml') {
      cb(null, YAML.stringify(json, 4), 'yaml', logs);
    } else if (this.format === 'xml') {
      cb(null, js2xmlparser('user', json), 'xml', logs);
    } else if (this.format === 'prettyjson' || this.format === 'pretty') {
      cb(null, JSON.stringify(json, null, 2), 'json', logs);
    } else if (this.format === 'csv') {
      converter.json2csv(json.results, (err, csv) => {
        cb(null, csv, 'csv', logs);
      });
    } else if (this.format === 'raw') {
      cb(null, JSON.stringify(json.results), 'json', logs);
    } else if (this.format === 'prettyraw') {
      cb(null, JSON.stringify(json.results, null, 2), 'json', logs);
    } else {
      cb(null, JSON.stringify(json), 'json', logs);
    }
  } else {
    // Errors caused by code wrapped around broken api code
    // which is basically unexpected end of input and more clear
    // to the user
    if ([
      "SyntaxError: Unexpected token }",
      "SyntaxError: Unexpected token catch",
      "SyntaxError: Unexpected token var",
      "SyntaxError: Missing catch or finally after try"
    ].indexOf(err.error) !== -1) {
      err.error = "SyntaxError: Unexpected end of input";
    }

    // Attempt to extract line/col number of error
    try {
      parseStack = err.stack.split('\n').slice(0, 2).join('').match(/evalmachine.*?:(\d+)(?::(\d+))?/);
      let line = parseStack[1]-14;
      let col  = parseStack[2];
      if (line <= 0) {
        err.error = "SyntaxError: Unexpected end of input";
      }

      parseStack = `${err.error.toString().split(':').join(':\n-')} near line ${line}${col === undefined ? "." : " column " + col}`;
    } catch(e) {
      parseStack = err.error;
    }
    err.formatted = parseStack;
    delete err.stack;
    cb(err, JSON.stringify({results: [{}]}), null, logs);
  }
}

Generator.prototype.configureGlobs = function() {
  // Make sure valid glob
  this.globRequires.forEach(lib => {
    switch(lib) {
      case 'faker':
        // Only allow locale to changed
        this.globs.faker = require('faker');
        this.globs.faker.seed(this.numericSeed);
        immutablify(this.globs.faker, {seal: [], writable: ['locale', 'seedValue']});
        break;
      case 'deity':
        this.globs.deity = require('deity');
        immutablify(this.globs.deity, {seal: [], writable: ['locale']});
        break;
      case 'moment':
        this.globs.moment = require('moment');
        immutablify(this.globs.moment, {seal: [], writable: []});
        break;
    };
  });
}

const random = (mode = 1, length = 10, charset = "") => {
  if (!Number.isInteger(mode) || !Number.isInteger(length)) throw new TypeError('Non numeric arguments provided');

  let result = '';
  let chars;

  if (mode === 1) {
    chars = 'abcdef1234567890';
  } else if (mode === 2) {
    chars = 'ABCDEF1234567890';
  } else if (mode === 3) {
    chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  } else if (mode === 4) {
    chars = '0123456789';
  } else if (mode === 5) {
    chars = 'abcdefghijklmnopqrstuvwxyz';
  } else if (mode === 6) {
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  } else if (mode === 7) {
    chars = 'abcdefghijklmnopqrstuvwxyz1234567890';
  } else if (mode === 8) {
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  } else if (mode === -1) {
    if ((typeof charset !== 'string' && !(charset instanceof String)) || charset.length === 0) throw new TypeError('Provided charset is invalid');
    chars = charset;
  }

  for (let i = 0; i < length; i++) {
      result += chars[range(0, chars.length - 1)];
  }

  return result;
};

const randomItem = arr => {
  return arr[range(0, arr.length-1)];
};

const range = (min, max) => {
  if (!Number.isInteger(min) || !Number.isInteger(max)) throw new TypeError('Non numeric arguments provided');
  if (max < min) throw new RangeError('min is greater than max');
  return Math.floor(mersenne.random() * (max - min + 1)) + min;
};

function prng() {
  return mersenne.random();
}

function immutablify(obj, exclude={seal: [], writable: []}, depth=0) {
  if (typeof obj !== "object" && depth !== 0 || obj === null) return;

  Object.getOwnPropertyNames(obj).forEach(prop => {

    // Not in exclusion list
    if (exclude.seal.indexOf(prop) === -1) {
      Object.seal(obj[prop]);
    }

    if (exclude.writable.indexOf(prop) === -1) {
      try {
        Object.defineProperty(obj, prop, {writable: false});
      } catch(e) {}
    }

    immutablify(obj[prop], exclude, ++depth); // Recursively run on props of props
  });
  Object.seal(obj); // seal self
}

const log = msg => {
  process.send({type: 'logger', content: String(msg)});
}

new Generator(process.argv[2], process.argv[3], process.argv[4]);

const mersenne     = require('mersenne');
const crypto       = require('crypto');
const YAML         = require('yamljs');
const js2xmlparser = require('js2xmlparser');
const converter    = require('json-2-csv');
const fs           = require('fs');
const vm           = require('vm');
const async        = require('async');
const util         = require('util');
const _            = require('lodash');
const logger       = require('../../utils').logger;
const redis        = require('../../utils').redis;
const settings     = require('../../utils').settings;
const numeral      = require('numeral')
const EventEmitter = require('events').EventEmitter;

const Generator = function(name, options) {
  this.name     = name || 'generator';
  process.title = 'RandomAPI_Generator ' + this.name;
  this.parentReplied = true;

  options      = JSON.parse(options);
  this.version = '0.1';
  this.info    = {
    execTime: options.execTime,
    results:  options.results
  };
  this.cache = {};
  this.context = vm.createContext(this.availableFuncs());
  this.originalContext = [
    'random', 'list', 'hash', 'timestamp',
    'require', '_APIgetVars', '_APIresults',
    '_APIstack', '_APIerror', 'getVar'
  ];

  process.on('message', msg => {
    if (msg.type === 'task') {
      if (msg.mode === 'generate') {
        this.instruct(msg.data, error => {
          if (error) {
            process.send({type: 'done', data: {error, results: null, fmt: null}});
          } else {
            this.generate((error, results, fmt) => {
              process.send({type: 'done', data: {error, results, fmt}});
            });
          }
        });
      } else if (msg.mode === 'lint') {
        // Inject linter settings
        this.seed   = String('linter' + ~~(Math.random() * 100));
        this.format = 'pretty';
        this.noinfo = true;
        this.page   = 1;
        this.mode   = 'lint';
        this.src    = msg.data.src;
        delete msg.data.src;
        this.instruct(msg.data, err => {
          this.generate((error, results, fmt) => {
            process.send({type: 'done', data: {error, results, fmt}});
          });
        });
      }
    } else if (msg.type === 'response') {
      if (msg.mode === 'api') {
        this.emit('apiResponse', msg.data);
      } else if (msg.mode === 'user') {
        this.emit('userResponse', msg.data);
      } else if (msg.mode === 'list') {
        this.emit('listResponse', msg.data);
      }
    } else if (msg.type === 'cmd') {
      if (msg.data === 'getMemory') {
        process.send({type: 'cmdComplete', mode: 'memory', content: process.memoryUsage().heapUsed});
      } else if (msg.data === 'gc') {
        global.gc();
      } else if (msg.data === 'emptyListCache') {
        this.emptyListCache();
      } else if (msg.data === 'getListCache') {
        var listCache = 0;
        _.each(this.cache, item => {
          listCache += Number(item.size);
        });
        process.send({type: 'cmdComplete', mode: 'listCache', content: listCache});
      }
    } else if (msg.type === 'pong') {
      this.emit('pong');
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
    this.once('pong', () => {
      this.parentReplied = true;
    });

    // See if any lists have expired
    this.checkCache();
  }, 5000)
};

util.inherits(Generator, EventEmitter);

// Receives the query which contains API, owner, and reqest data
Generator.prototype.instruct = function(options, done) {
  this.options = options || {};
  this.results = Number(this.options.results);
  this.seed    = this.options.seed || '';
  this.format  = (this.options.format || this.options.fmt || 'json').toLowerCase();
  this.noInfo  = typeof this.options.noinfo !== 'undefined';
  this.page    = Number(this.options.page) || 1;

  if (this.mode === undefined) this.mode = options.mode || "generator";

  // Sanitize values
  if (isNaN(this.results) || this.results < 0 || this.results > this.info.results || this.results === '') this.results = 1;
  if (this.seed === '') {
    this.defaultSeed();
  }

  if (this.page < 0 || this.page > 10000) this.page = 1;
  ///////////////////

  this.seedRNG();

  async.series([
    cb => {
      process.send({type: 'lookup', mode: 'api', data: options.ref});
      this.once('apiResponse', data => {
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
      this.once('userResponse', data => {
        this.user = data;
        this.options.userID      = data.id;
        this.options.userTier    = data.tier;

        if (data.apikey !== this.options.key) {
          cb('UNAUTHORIZED_USER');
        } else {
          cb(null);
        }

      });
    },
    cb => {
      if (this.mode !== "lint") {
        // Get API src
        this.src = fs.readFileSync('./data/apis/' + this.doc.id + '.api', 'utf8');
      }
      cb(null);
    }
  ], (err, results) => {
    done(err);
  });
};

Generator.prototype.generate = function(cb) {
  let self = this;

  this.results = this.results || 1;
  let output = [];

  try {
    this.sandBox = new vm.Script(`
      'use strict'
      var _APIgetVars = ${JSON.stringify(this.options)};
      var _APIresults = [];
      var _APIerror = null;
      var _APIstack = null;
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

    this.sandBox.runInContext(this.context, {
      displayErrors: true,
      timeout: this.info.execTime * 1000
    });

    if (this.context._APIerror === null && this.context._APIstack === null) {
      returnResults(null, this.context._APIresults);
    } else {
      returnResults({error: this.context._APIerror, stack: this.context._APIstack}, [{}]);
    }
  } catch(e) {
    returnResults({error: e.toString(), stack: e.stack}, [{}]);
  }

  // Remove accidental user defined globals. Pretty hacky, should probably look into improving this...
  let diff = Object.keys(this.context);
  diff.filter(each => this.originalContext.indexOf(each) === -1).forEach(each => delete self.context[each]);

  function returnResults(err, output) {
    if (err === null) {
      let json = {
        results: output,
        info: {
          seed: String(self.seed),
          results: numeral(self.results).format('0,0'),
          page: numeral(self.page).format('0,0'),
          version: self.version
        }
      };
      json.info.user = {
        username: self.user.username,
        tier: self.user.tierName + ` [${self.user.tierID}]`,
        results: numeral(self.user.results).format('0,0') + " / " + String(self.user.tierResults !== 0 ? numeral(self.user.tierResults).format('0,0') : "unlimited"),
        remaining: self.user.tierResults !== 0 ? numeral(self.user.tierResults - self.user.results).format('0,0') : "unlimited"
      };

      if (self.noInfo) delete json.info;

      if (self.format === 'yaml') {
        cb(null, YAML.stringify(json, 4), 'yaml');
      } else if (self.format === 'xml') {
        cb(null, js2xmlparser('user', json), 'xml');
      } else if (self.format === 'prettyjson' || self.format === 'pretty') {
        cb(null, JSON.stringify(json, null, 2), 'json');
      } else if (self.format === 'csv') {
        converter.json2csv(json.results, (err, csv) => {
          cb(null, csv, 'csv');
        });
      } else {
        cb(null, JSON.stringify(json), 'json');
      }
    } else {
      if ([
        "SyntaxError: Unexpected token }",
        "SyntaxError: Unexpected token catch",
        "SyntaxError: Missing catch or finally after try"
      ].indexOf(err.error) !== -1) {
        err.error = "SyntaxError: Unexpected end of input";
      }
      try {
        parseStack = err.stack.split('\n').slice(0, 2).join('').match(/evalmachine.*?:(\d+)(?::(\d+))?/);
        let line = parseStack[1]-10;
        let col  = parseStack[2];

        parseStack = `${err.error.toString().split(':').join(':\n-')} on line ${line}${col === undefined ? "." : " column " + col}`;
      } catch(e) {
        parseStack = err.error;
      }
      err.formatted = parseStack;
      delete err.stack;
      cb(err, JSON.stringify({results: [{}]}), null);
    }
  }
};

Generator.prototype.seedRNG = function() {
  let seed = this.seed;
  seed = this.page !== 1 ? seed + String(this.page) : seed;

  this.numericSeed = parseInt(crypto.createHash('md5').update(seed).digest('hex').substring(0, 8), 16);
  mersenne.seed(this.numericSeed);
};

Generator.prototype.defaultSeed = function() {
  this.seed = random(1, 16);
};

Generator.prototype.availableFuncs = function() {
  // Actual logic
  let funcs = {
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

      if (Array.isArray(obj)) {
        if (num < 0 || num > obj.length-1) {
          throw new Error(`Index ${num} is out of range for array ${obj}`);
        } else {
          if (num !== undefined) {
            return obj[num];
          } else {
            return obj[range(0, obj.length-1)];
          }
        }
      } else {
        // Check if list is in local generator cache
        // If not, fetch from redis cache and add it to the local cache
        if (obj in this.cache) {

          // Update local cache lastUsed date
          // Also update redis cache lastUsed date
          this.cache[obj].lastUsed = new Date().getTime();
          redis.exists("list:" + obj + ":contents", (err, result) => {
            if (result === 1) {
              redis.hmset("list:" + obj, 'lastUsed', new Date().getTime());
            }
          });

          if (num !== undefined) {
            if (num < 1 || num > this.cache[obj].contents.length) {
              throw new Error(`Line ${num} is out of range for list ${obj}`);
            } else {
              item = this.cache[obj].contents[num-1];
            }
          } else {
            item = randomItem(this.cache[obj].contents);
          }
          return item;
        } else {
          process.send({type: 'lookup', mode: 'list', data: {ref: obj, user: {id: this.options.userID, tier: this.options.userTier}}});
          let done = false;
          let item = null;
          this.once('listResponse', result => {
            if (result === false) {
              throw new Error(`You aren't authorized to access list ${obj}`);
              done = true;
            } else {
              redis.SMEMBERS("list:" + obj + ":contents", (err, file) => {

                // Fetch metadata for list and store in local generator cache
                redis.hgetall("list:" + obj, (err, info) => {
                  this.cache[obj] = {
                    added: new Date().getTime(),
                    contents: file,
                    size: info.size,
                    owner: info.owner,
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
    require: function(lib) {
      if (lib === 'faker') {
        return require('faker');
      }
    }
  };

  // Proxy
  return {
    random: {
      numeric: (min, max)     => funcs.random.numeric(min, max),
      special: (mode, length) => funcs.random.special(mode, length),
      custom:  (charset, length) => funcs.random.custom(charset, length)
    },
    list: (obj, num) => funcs.list(obj, num),
    hash: {
      md5: val    => funcs.hash.md5(val),
      sha1: val   => funcs.hash.sha1(val),
      sha256: val => funcs.hash.sha256(val)
    },
    timestamp: () => funcs.timestamp(),
    require: () => null//lib  => funcs.require(lib)
  };
};

Generator.prototype.checkCache = function() {
  _.each(this.cache, (obj, ref) => {
    if (new Date().getTime() - obj.lastUsed > settings.generators[this.name].localTTL * 1000) {
      delete this.cache[ref];
    }
  });
};

Generator.prototype.emptyListCache = function() {
  this.cache = {};
};

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
  return min + mersenne.rand(max-min+1);
};

const log = msg => {
  process.send({type: 'logger', content: String(msg)});
}

new Generator(process.argv[2], process.argv[3]);

const mersenne     = require('mersenne');
const crypto       = require('crypto');
const YAML         = require('yamljs');
const js2xmlparser = require('js2xmlparser');
const converter    = require('json-2-csv');
const fs           = require('fs');
const deasync      = require('deasync');
const vm           = require('vm');
const async        = require('async');
const util         = require('util');
const _            = require('lodash');
const EventEmitter = require('events').EventEmitter;

const Generator = function(name, options) {
  let self = this;
  name = name || 'generator';
  process.title = 'RandomAPI_Generator ' + name;
  this.parentReplied = true;

  options = JSON.parse(options);
  this.version   = '0.1';
  this.limits    = {
    execTime: options.execTime,
    memory:   options.memory * 1024 * 1024,
    results:  options.results
  };
  this.context = vm.createContext(this.availableFuncs());
  this.originalContext = ['random', 'list', 'hash', 'String', 'timestamp', '_APIgetVars', '_APIresults', 'getVar'];
  this.listsResults = {}; // Hold cache of list results

  // Lists that were added to cache within last minute.
  // Structure: {Key: list.length}
  // Every 60 seconds, perform a check for any lists that
  // are greater than 1/4 the size of the memory limit and remove
  // them if they are.
  this.listsAdded = {};

  process.on('message', msg => {
    if (msg.type === 'task') {
      if (msg.mode === 'generate') {
        self.instruct(msg.data, err => {
          if (err) {
            process.send({type: 'taskFinished', data: {data: err, results: null, fmt: null}});
          } else {
            self.generate((data, fmt) => {
              process.send({type: 'done', data: {data, fmt}});
            });
          }
        });
      } else if (msg.mode === 'lint') {
        let a = _.merge({
          seed: String('linter' + ~~(Math.random() * 100)),
          format: 'json',
          noinfo: true,
          page: 1,
          mode: 'lint'
        }, msg.data);
        self.instruct(a, err => {
          self.generate((data, fmt) => {
            process.send({type: 'done', data: {data, fmt}});
          });
        });
      } else if (msg.mode === 'speedtest') {

      }
    } else if (msg.type === 'response') {
      if (msg.mode === 'api') {
        self.emit('apiResponse', msg.data);
      } else if (msg.mode === 'user') {
        self.emit('userResponse', msg.data);
      } else if (msg.mode === 'list') {
        self.emit('listResponse', msg.data);
      }
    } else if (msg.type === 'cmd') {
      if (msg.data === 'getMemory') {
        process.send({type: 'cmdComplete', mode: 'memory', content: process.memoryUsage().heapUsed});
      } else if (msg.data === 'getLists') {
        process.send({type: 'cmdComplete', mode: 'lists', content: String(Object.keys(self.listsResults))});
      } else if (msg.data === 'gc') {
        global.gc();
      } else if (msg.data === 'clearLists') {
        self.listsResults = {};
      }
    } else if (msg.type === 'pong') {
      self.emit('pong');
    }
  });

  // Remove lists that shouldn't be cached
  setInterval(() => {
    self.checkLists();
  }, 60000);

  // Commit sudoku if parent process doesn't reply during 5 second check
  setInterval(() => {
    self.parentReplied = false;
    setTimeout(() => {
      if (!self.parentReplied) {
        process.exit();
      }
    }, 5000)
    try {
      process.send({type: 'ping'});
    } catch(e) {}
    self.once('pong', () => {
      self.parentReplied = true;
    });
  }, 5000)
};

util.inherits(Generator, EventEmitter);

// Receives the query which contains API, owner, and reqest data
Generator.prototype.instruct = function(options, done) {
  let self = this;

  this.options = options || {};
  this.results = Number(this.options.results);
  this.seed    = this.options.seed || '';
  this.format  = (this.options.format || this.options.fmt || 'json').toLowerCase();
  this.noInfo  = typeof this.options.noinfo !== 'undefined';
  this.page    = Number(this.options.page) || 1;
  this.mode    = options.mode;
  this.src     = options.src;

  // Sanitize values
  if (isNaN(this.results) || this.results < 0 || this.results > this.limits.results || this.results === '') this.results = 1;

  if (this.seed === '') {
    this.defaultSeed();
  }

  if (this.page < 0 || this.page > 10000) this.page = 1;
  ///////////////////

  this.seedRNG();

  async.series([
    cb => {
      process.send({type: 'lookup', mode: 'api', data: options.ref});
      self.once('apiResponse', data => {
        self.doc = data;

        if (!self.doc) {
          cb('This API doesn\'t exist boi!');
        } else {
          cb(null);
        }
      });
    },
    cb => {
      process.send({type: 'lookup', mode: 'user', data: self.doc.owner});
      self.once('userResponse', data => {
        self.keyOwner = data;

        if (self.keyOwner.apikey !== self.options.key) {
          cb('You are not the owner of this API boi!');
        } else {
          cb(null);
        }
      });
    },
    cb => {
      if (self.mode === "lint") {
        self.src = options.src;
      } else {
        // Get API src
        self.src = fs.readFileSync('./data/apis/' + self.doc.id + '.api', 'utf8');
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
      var _APIgetVars = ${JSON.stringify(self.options)};
      var _APIresults = [];
      (function() {
        for (var _APIi = 0; _APIi < ${self.results}; _APIi++) {
          var api = {};
          try {
    ${self.src}
          } catch (e) {
            api = {
              API_ERROR: e.toString()//e.toString(),
              //API_STACK: e.stack
            };
          }
          _APIresults.push(api);
        }
      })();
      function getVar(key) {
        //if (_APIgetVars === undefined) return undefined;
        return key in _APIgetVars ? _APIgetVars[key] : undefined;
      }
    `);

    this.sandBox.runInContext(this.context, {
      displayErrors: true,
      timeout: self.limits.execTime * 1000
    });
    returnResults(null, this.context._APIresults);
  } catch(e) {
    returnResults(null, [{API_ERROR: e.toString()}]);
    //console.log(e.stack);
  }

  // Remove accidental user defined globals. Pretty hacky, should probably look into improving this...
  let diff = Object.keys(this.context);
  diff.filter(each => this.originalContext.indexOf(each) === -1).forEach(each => delete self.context[each]);

  function returnResults(err, output) {
    if (err !== null) {
      output = [{API_ERROR: err.toString()}];
    }

    let json = {
      results: output,
      info: {
        seed: String(self.seed),
        results: self.results,
        page: self.page,
        version: self.version
      }
    };

    if (output[0].API_ERROR !== undefined) {
      json.error = true;
    }

    if (self.noInfo) delete json.info;

    if (self.format === 'yaml') {
      cb(YAML.stringify(json, 4), 'yaml');
    } else if (self.format === 'xml') {
      cb(js2xmlparser('user', json), 'xml');
    } else if (self.format === 'prettyjson' || self.format === 'pretty') {
      cb(JSON.stringify(json, null, 2), 'json');
    } else if (self.format === 'csv') {
      converter.json2csv(json.results, (err, csv) => {
        cb(csv, 'csv');
      });
    } else {
      cb(JSON.stringify(json), 'json');
    }
  }
};

Generator.prototype.speedTest = function(limit, cb) {
  let self = this;
  let output = [];

  try {

    this.sandBox = new vm.Script(`
      'use strict'
      var _APIgetVars = ${JSON.stringify(self.options)};
      var _APIresults = [];
      var start = new Date().getTime();
      (function() {
        while(true) {
          var api = {};
          try {
${self.src}
          } catch (e) {
            api = {
              API_ERROR: e.toString(),
              API_STACK: e.stack
            };
          }
          _APIresults.push(api);
          if (new Date().getTime() - start >= ${limit}*1000) break;
        }
      })();
      function getVar(key) {
        //if (_APIgetVars === undefined) return undefined;
        return key in _APIgetVars ? _APIgetVars[key] : undefined;
      }
    `);
    this.sandBox.runInContext(this.context, {
      displayErrors: true,
      timeout: self.limits.execTime * 1000
    });

    self.listsResults = {}; // Clear lists everytime for speedtest runs
    cb(this.context._APIresults.length);
  } catch(e) {
    cb(-1);
  }
};




//self.lint(m.code, m.user, function(err, results) {
Generator.prototype.lint = function(code, user, cb) {
  let self = this;
  this.results   = 1;
  this.seed      = String('linter' + ~~(Math.random() * 100));
  this.format    = 'json';
  this.noInfo    = true;
  this.page      = 1;
  this.speedtest = false;
  this.src       = code;

  this.page = 1;
  ///////////////////

  this.seedRNG();

  let output = [];

  try {
    this.sandBox = new vm.Script(`
      'use strict'
      let _APIgetVars = ${JSON.stringify(self.options)};
      let _APIresults = [];
      (function() {
        for (let _APIi = 0; _APIi < ${self.results}; _APIi++) {
          let api = {};
          try {
${self.src}
          } catch (e) {
            api = {
              API_ERROR: e.toString(),
              API_STACK: e.stack
            };
          }
          _APIresults.push(api);
        }
      })();
      function getVar(key) {
        //if (_APIgetVars === undefined) return undefined;
        return key in _APIgetVars ? _APIgetVars[key] : undefined;
      }
    `);

    this.sandBox.runInContext(this.context, {
      displayErrors: true,
      timeout: self.limits.execTime * 1000
    });
    returnResults(null, this.context._APIresults);
  } catch(e) {
    returnResults(e.toString(), null);
  }

  // Remove accidental user defined globals. Pretty hacky, should probably look into improving this...
  let diff = Object.keys(this.context);
  diff.filter(each => this.originalContext.indexOf(each) === -1).forEach(each => delete self.context[each]);

  function returnResults(err, output) {
    if (err !== null) {
      output = [{API_ERROR: err.toString()}];
    }

    let json = {
      results: output,
      info: {
        seed: String(self.seed),
        results: self.results,
        page: self.page,
        version: self.version
      }
    };

    if (output[0].API_ERROR !== undefined) {
      json.error = true;
    }

    if (self.noInfo) delete json.info;

    if (self.format === 'yaml') {
      cb(YAML.stringify(json, 4), 'yaml');
    } else if (self.format === 'xml') {
      cb(js2xmlparser('user', json), 'xml');
    } else if (self.format === 'prettyjson' || self.format === 'pretty') {
      cb(JSON.stringify(json, null, 2), 'json');
    } else if (self.format === 'csv') {
      converter.json2csv(json.results, (err, csv) => {
        cb(csv, 'csv');
      });
    } else {
      cb(JSON.stringify(json), 'json');
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
  let self = this;
  return {
    random: {
      numeric: (a, b) => {
        return range(a, b);
      },
      special: (mode, length) => {
        if (length > 65535) length = 1;
        return random(mode, length);
      }
    },
    list: (obj, num) => {
      if (num !== '' && num !== undefined) num = Number(num); // Convert string to num if it isn't undefined
      if (num === '') num = undefined;

      if (Array.isArray(obj)) {
        if (num !== undefined) {
          return obj[num-1];
        } else {
          return obj[range(0, obj.length-1)];
        }
      } else {
        let done = false;
        if (!(obj in self.listsResults)) {
          process.send({type: 'lookup', mode: 'list', data: obj});
          self.once('listResponse', data => {
            if (data === null) {
              self.listsAdded[obj] = 0;
              self.listsResults[obj] = {
                added: new Date().getTime()
              };
              self.listsResults[obj].content = [null];
              done = true;
            } else {
              let res = data;
              let file = fs.readFileSync(process.cwd() + '/data/lists/' + res.id + '.list', 'utf8');

              // Add filesize to listAdded object to check later
              self.listsAdded[obj] = file.length;
              self.listsResults[obj] = {
                added: new Date().getTime()
              };

              self.listsResults[obj].content = file.split('\n').slice(0, -1);
              done = true;
            }
          });
        } else {
          done = true;
        }

        require('deasync').loopWhile(function(){return !done;});
        self.listsResults[obj].lastUsed = new Date().getTime();
        if (num !== undefined) {
          return self.listsResults[obj].content[num-1];
        } else {
          return randomItem(self.listsResults[obj].content);
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
    String,
    timestamp: () => {
      return Math.floor(new Date().getTime()/1000);
    }
  };
};

Generator.prototype.checkLists = function() {
  let self = this;
  let keys = Object.keys(this.listsAdded);
  let listsDeleted = false;

  // Remove list from cache if it is bigger than 1/4 the cache
  for (let i = 0; i < keys.length; i++) {
    if (this.listsAdded[keys[i]] > ~~(this.limits.memory/4)) {
      delete this.listsResults[keys[i]];
      listsDeleted = true;
    }
  }

  // Keep removing oldest lists until cache size is back to default
  while (this.getCacheSize > this.limits.memory) {
    delete this.listResults[this.getOldestList().ref];
    listsDeleted = true;
  }

  this.listsAdded = {};
  //if (listsDeleted) global.gc();
};

Generator.prototype.getOldestList = function() {
  let self = this;
  let keys = Object.keys(this.listsAdded);
  let listsDeleted = false;
  let oldest = {
    ref: null,
    lastUsed: Infinity
  };
  for (let i = 0; i < keys.length; i++) {
    if (this.listsResults[keys[i]].lastUsed < oldest.lastUsed) {
      oldest.ref = keys[i];
      oldest.lastUsed = this.listsResults[keys[i]].lastUsed;
    }
  }

  return oldest;
}

Generator.prototype.getCacheSize = function() {
  let size = 0;

  for (let i = 0; i < keys.length; i++) {
    size += this.listResults[keys[i]].content.length;
  }

  return size;
}

const random = (mode, length) => {
  let result = '';
  let chars;

  if (mode === 1) {
    chars = 'abcdef1234567890';
  } else if (mode === 2) {
    chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  } else if (mode === 3) {
    chars = '0123456789';
  } else if (mode === 4) {
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  } else if (mode === 5) {
    chars = 'abcdefghijklmnopqrstuvwxyz1234567890';
  } else if (mode === 6) {
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
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
  return min + mersenne.rand(max-min+1);
};

const log = msg => {
  process.send({type: 'logger', content: String(msg)});
}

new Generator(process.argv[2], process.argv[3]);

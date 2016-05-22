var mersenne     = require('mersenne');
var crypto       = require('crypto');
var YAML         = require('yamljs');
var js2xmlparser = require('js2xmlparser');
var converter    = require('json-2-csv');
var fs           = require('fs');
var deasync      = require('deasync');
var mersenne     = require('mersenne');
var vm           = require('vm');
var async        = require('async');
var util         = require('util');
var EventEmitter = require('events').EventEmitter;

var version = '0.1';

var Generator = function(name, options) {
  name = name || "generator";
  process.title = "RandomAPI Generator " + name + " - " + options;

  var self = this;
  options = JSON.parse(options);
  this.version   = version;
  this.limits    = {
    execTime: options.execTime,
    memory:   options.memory,
    results:  options.results
  };
  this.context = vm.createContext(this.availableFuncs());
  this.originalContext = ["random", "list", "hash", "String", "timestamp", "_APIgetVars", "_APIresults", "getVar"];
  this.listResults = {}; // Hold cache of list results

  process.on('message', (m) => {
    // Received API info from forker
    // Emit for generate() to receive
    if (m.type === 'API_RESPONSE') {
      self.emit('API_RESPONSE', m.content);
    } else if (m.type === 'USER_RESPONSE') {
      self.emit('USER_RESPONSE', m.content);
    } else if (m.type === 'LIST_RESPONSE') {
      self.emit('LIST_RESPONSE', m.content);

    // New Generate task
    } else if (m.type === "task") {
      self.instruct(m.options, false, function(err) {
        if (err) {
          process.send({type: 'DONE', content: {data: err, fmt: null}});
        } else {
          self.generate(function(data, fmt) {
            process.send({type: 'DONE', content: {data, fmt}});
          });
        }
      });
    } else if (m.type === "command") {
      if (m.content === "gc") {
        global.gc();
      } else if (m.content === "getMemory") {
        process.send({type: "getMemory", content: process.memoryUsage().heapUsed});
      } else if (m.content === "getLists") {
        process.send({type: "getLists", content: String(Object.keys(self.listResults))});
      } else if (m.content === "clearLists") {
        self.listResults = {};
      }

    // Speedtest
    } else if (m.type === "speedtest") {
      self.instruct(m.options, true, function(err) {
        if (err) {
          process.send({type: 'DONE', content: {data: err, fmt: null}});
        } else {
          self.speedTest(m.options.time, function(num) {
            process.send({type: 'DONE', content: {data: num}});
          });
        }
      });
    }
  });
};

util.inherits(Generator, EventEmitter);

// Receives the query which contains API, owner, and reqest data
Generator.prototype.instruct = function(options, speedtest, done) {
  var self = this;

  this.options     = options || {};
  this.results     = Number(this.options.results);
  this.seed        = this.options.seed || '';
  this.format      = (this.options.format || this.options.fmt || 'json').toLowerCase();
  this.noInfo      = typeof this.options.noinfo !== 'undefined';
  this.page        = Number(this.options.page) || 1;
  this.speedtest   = speedtest;

  // Sanitize values
  if (isNaN(this.results) || this.results < 0 || this.results > this.limits.results || this.results === '') this.results = 1;

  if (this.seed === '') {
    this.defaultSeed();
  }

  if (this.page < 0 || this.page > 10000) this.page = 1;
  ///////////////////

  this.seedRNG();

  async.series([
    function(cb) {
      process.send({type: 'API', ref: options.ref});
      self.once('API_RESPONSE', data => {
        self.doc = data;

        if (!self.doc) {
          cb("This API doesn't exist boi!");
        } else {
          cb(null);
        }
      });
    },
    function(cb) {
      process.send({type: 'USER', id: self.doc.owner});
      self.once('USER_RESPONSE', data => {
        self.keyOwner = data;

        if (self.keyOwner.key !== self.options.key && !self.speedtest) {
          cb("You are not the owner of this API boi!" + self.speedtest);
        } else {
          cb(null);
        }
      });
    },
    function(cb) {
      // Get API src
      self.src = fs.readFileSync('./data/apis/' + self.doc.id + '.api', 'utf8');
      cb(null);
    }
  ], function(err, results) {
    done(err);
  });
};

Generator.prototype.generate = function(cb) {
  var self = this;

  this.results = this.results || 1;
  var output = [];

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
              API_ERROR: "Something went wrong"//e.toString(),
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
    returnResults("Something went wrong", null);
    //console.log(e.stack);
  }

  // Remove accidental user defined globals. Pretty hacky, should probably look into improving this...
  var diff = Object.keys(this.context);
  diff.filter(each => this.originalContext.indexOf(each) === -1).forEach(each => delete self.context[each]);

  function returnResults(err, output) {
    if (err !== null) {
      output = [{API_ERROR: err.toString()}];
    }

    var json = {
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

    self.defaultSeed();
    self.seedRNG();

    if (self.format === 'yaml') {
      cb(YAML.stringify(json, 4), "yaml");
    } else if (self.format === 'xml') {
      cb(js2xmlparser('user', json), "xml");
    } else if (self.format === 'prettyjson' || self.format === 'pretty') {
      cb(JSON.stringify(json, null, 2), "json");
    } else if (self.format === 'csv') {
      converter.json2csv(json.results, (err, csv) => {
        cb(csv, "csv");
      });
    } else {
      cb(JSON.stringify(json), "json");
    }
  }
};

Generator.prototype.speedTest = function(limit, cb) {
  var self = this;
  var output = [];

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

    self.listResults = {}; // Clear lists everytime for speedtest runs
    cb(this.context._APIresults.length);
  } catch(e) {
    cb(-1);
  }
};

Generator.prototype.seedRNG = function() {
  var seed = this.seed;
  seed = this.page !== 1 ? seed + String(this.page) : seed;

  this.numericSeed = parseInt(crypto.createHash('md5').update(seed).digest('hex').substring(0, 8), 16);
  mersenne.seed(this.numericSeed);
};

Generator.prototype.defaultSeed = function() {
  this.seed = random(1, 16);
};

Generator.prototype.availableFuncs = function() {
  var self = this;
  return {
    random: {
      numeric: function(a, b) {
        return range(a, b);
      },
      special: function(mode, length) {
        if (length >= 65535) length = 1;
        return random(mode, length);
      }
    },
    list: function(obj, num) {
      if (num !== "" && num !== undefined) num = Number(num); // Convert string to num if it isn't undefined
      if (num === "") num = undefined;

      if (Array.isArray(obj)) {
        if (num !== undefined) {
          return obj[num-1];
        } else {
          return obj[range(0, obj.length-1)];
        }
      } else {
        var done = false;
        if (!(obj in self.listResults)) {
          process.send({type: 'LIST', ref: obj});
          self.once('LIST_RESPONSE', data => {
            var res = data;
            if (res !== null) {
              self.listResults[obj] = fs.readFileSync(process.cwd() + '/data/lists/' + res.id + '.list', 'utf8').split('\n');
            } else {
              self.listResults[obj] = [undefined];
            }
            done = true;
          });
        } else {
          done = true;
        }

        require('deasync').loopWhile(function(){return !done;});
        if (num !== undefined) {
          return self.listResults[obj][num-1];
        } else {
          return randomItem(self.listResults[obj]);
        }
      }
    },
    hash: {
      md5: function(val) {
        return crypto.createHash('md5').update(String(val)).digest('hex');
      },
      sha1: function(val) {
        return crypto.createHash('sha1').update(String(val)).digest('hex');
      },
      sha256: function(val) {
        return crypto.createHash('sha256').update(String(val)).digest('hex');
      }
    },
    String,
    timestamp: function() {
      return Math.floor(new Date().getTime()/1000);
    }
  };
};

var random = (mode, length) => {
  var result = '';
  var chars;

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

  for (var i = 0; i < length; i++) {
      result += chars[range(0, chars.length - 1)];
  }

  return result;
};

var randomItem = arr => {
  return arr[range(0, arr.length-1)];
};

var range = (min, max) => {
  return min + mersenne.rand(max-min+1);
};

var log = msg => {
  process.send({type: "logger", content: msg});
}

new Generator(process.argv[2], process.argv[3]);

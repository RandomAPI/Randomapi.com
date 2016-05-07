var mersenne     = require('mersenne');
var crypto       = require('crypto');
var YAML         = require('yamljs');
var js2xmlparser = require('js2xmlparser');
var converter    = require('json-2-csv');
var fs           = require('fs');
var deasync      = require('deasync');
var SandCastle   = require('sandcastle').SandCastle;
var version      = '0.1';

var Generator = function(options) {
  var self = this;

  this.options = options || {};
  this.results = Number(this.options.results);
  this.seed    = this.options.seed || '';
  this.format  = (this.options.format || this.options.fmt || 'json').toLowerCase();
  this.noInfo  = typeof this.options.noinfo !== 'undefined' ? true : false;
  this.page    = Number(this.options.page) || 1;
  this.version = version;

  // Sanitize values
  if (isNaN(this.results) || this.results < 0 || this.results > 5000 || this.results === '') this.results = 1;

  if (this.seed === '') {
    this.defaultSeed();
  }

  if (this.page < 0 || this.page > 10000) this.page = 1;
  ///////////////////

  this.seedRNG();

  this.doc      = API.getAPIByRef(this.options.ref);
  this.keyOwner = User.getByID(this.doc.owner);

  if (!this.doc || this.keyOwner.key !== this.options.key) {
    throw "You are not the owner boi!";
  }
  
  // Get API src
  this.src = fs.readFileSync('./data/apis/' + this.doc.id + '.api', 'utf8');

  this.sandcastle = new SandCastle({
    api: availableFuncs[version].replace('MERSENNE_SEED', self.numericSeed),
    timeout: 5000
  });

};

Generator.prototype.generate = function(cb) {
  var self = this;
  this.results = this.results || 1;
  var output = [];
  var script = this.sandcastle.createScript(`
    exports.main = function() {
      exit((function() {
        var _APIgetVars = ${JSON.stringify(self.options)};
        var _APIresults = [];
        for (var _APIi = 0; _APIi < ${self.results}; _APIi++) {
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
        }
        return _APIresults;
        function getVar(key) {

          //if (_APIgetVars === undefined) return undefined;
          return key in _APIgetVars ? _APIgetVars[key] : undefined;
        }
      })());
    }
  `);


  script.run();// we can pass variables into run.
  
  script.on('exit', function(err, output) {
    if (err) {
      returnResults(err, null);
    } else {
      returnResults(null, output);
    }
  });

  script.on('timeout', function() {
    returnResults("script timed out", null);
  });

  function returnResults(err, output) {
    console.log(err);
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
    self.sandcastle.kill();
  }
};

Generator.prototype.seedRNG = function() {
  var seed = this.seed;
  seed = this.page !== 1 ? seed + String(this.page) : seed;

  this.numericSeed = parseInt(crypto.createHash('md5').update(seed).digest('hex').substring(0, 8), 16);
  // mersenne.seed(seed);
};

Generator.prototype.defaultSeed = function() {
  this.seed = random(1, 16);
};

random = (mode, length) => {
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
}

randomItem = arr => {
  return arr[range(0, arr.length-1)];
};

range = (min, max) => {
  return min + mersenne.rand(max-min+1);
};

module.exports = Generator;

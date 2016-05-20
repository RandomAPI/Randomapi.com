var GeneratorForker = require('./api/0.1/GeneratorForker');
// global models
var db           = require('./models/db');
API       = require('./models/API');
List      = require('./models/List');
User      = require('./models/User');
Generator = require('./models/Generator');
Counters  = require('./models/Counters');
_                = require('lodash');

var gen = new GeneratorForker({execTime: 30, memory: 100, results: 10000});
gen.speedTest({ref: 'sdmih', key: 'SXVQ-SCCZ-L3N2-XOFO'}, 1, function(amt) {
  console.log(amt);
  process.exit();
});
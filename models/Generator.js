var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');
var deasync  = require('deasync');

var generatorSchema = mongoose.Schema({
  id: {
    type: Number,
    unique: true
  },
  version: {
    type: String,
    unique: true
  }
});

generatorSchema.pre('save', function(next) {
  var self = this;

  Counters.getNextIndex('generators', true, function(data) {
    self.id = data.index;
    next();
  });
});

var Generator = mongoose.model('Generator', generatorSchema);

Generator.getByID = deasync(function(id, cb) {
  Generator.findOne({id: id}, function(err, model) {
    cb(null, model);
  });
});

Generator.getByVersion = deasync(function(version, cb) {
  Generator.findOne({version: version}, function(err, model) {
    cb(null, model);
  });
});

Generator.getLatestVersion = deasync(function(cb) {
  Counters.getNextIndex('generators', false, (data) => {
    cb(null, data);
  });
});

Generator.getAvailableVersions = deasync(function(cb) {
  Generator.find({}, {id: 1, version: 1, _id: 0}, function(err, versions) {
    cb(null, versions);
  });
});

module.exports = Generator;

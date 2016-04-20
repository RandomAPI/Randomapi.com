var mongoose     = require('mongoose');
var findOrCreate = require('mongoose-findorcreate')
var Counters = require('./Counters');

var APISchema = mongoose.Schema({
  id: {
    type: Number,
    unique: true
  },
  ref: {
    type: String,
    unique: true
  },
  name: String,
  owner: Number
});

APISchema.pre('save', function(next) {
  var self = this;
  Counters.getNextIndex("apis", true, function(data) {
    self.id = data.index;
    API.genRandomRef(function(ref) {
      self.ref = ref;
      next();
    });
  });
});

APISchema.plugin(findOrCreate);
var API = mongoose.model('API', APISchema);

API.add = function(data, cb) {
  API.create(data, function(err, model) {
    cb(model);
  });
};

API.genRandomRef = function(cb) {
  var ref, dup;
  do {
    dup = false;
    ref = random(5, 5);

    API.findOne({ref: ref}, function(err, model) {
      if (model === null) {
        cb(ref);
      } else {
        dup = true;
      }
    });
  } while(dup);
};

function random(mode, length) {
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
  }

  for (var i = 0; i < length; i++) {
      result += chars[range(0, chars.length-1)];
  }

  return result;
}

function range(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

API.getAPIs = function(id, cb) {
  API.find({owner: id}, function(err, docs) {
    if (docs.length === 0) {
      cb("No apis found", null);
    } else {
      cb(null, docs);
    }
  });
};

module.exports = API;

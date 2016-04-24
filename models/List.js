var mongoose     = require('mongoose');
var findOrCreate = require('mongoose-findorcreate')
var Counters     = require('./Counters');

var ListSchema = mongoose.Schema({
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

ListSchema.pre('save', function(next) {
  var self = this;

  Counters.getNextIndex('lists', true, function(data) {
    self.id = data.index;

    List.genRandomRef(function(ref) {
      self.ref = ref;
      next();
    });
  });
});

ListSchema.plugin(findOrCreate);
var List = mongoose.model('List', ListSchema);

List.add = function(data, cb) {
  List.create(data, function(err, model) {
    cb(model);
  });
};

List.genRandomRef = function(cb) {
  var ref, dup;
  do {
    dup = false;
    ref = random(5, 5);

    List.findOne({ref: ref}, function(err, model) {
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

List.getLists = function(id, cb) {
  List.find({owner: id}, function(err, docs) {
    if (docs.length === 0) {
      cb('No lists found', null);
    } else {
      cb(null, docs);
    }
  });
};

List.getList = function(id, cb) {
  List.findOne({id: id}, function(err, doc) {
    if (doc === null) {
      cb('List wasn\'t found', null);
    } else {
      cb(null, doc);
    }
  });
};

List.getListByRef = function(ref, cb) {
  List.findOne({ref: ref}, function(err, doc) {
    if (doc === null) {
      cb('List wasn\'t found', null);
    } else {
      cb(null, doc);
    }
  });
};

module.exports = List;

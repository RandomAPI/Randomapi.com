var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');
var deasync  = require('deasync');
var Counters = require('./Counters');

var userSchema = mongoose.Schema({
  id: {
    type: Number,
    unique: true
  },
  username: {
    type: String,
    unique: true
  },
  password: String,
  key: {
    type: String,
    unique: true
  },
  role: {
    type: String,
    default: 'user'
  }
});

userSchema.pre('save', function(next) {
  var self = this;
  this.password = bcrypt.hashSync(this.password);

  Counters.getNextIndex('users', true, function(data) {
    self.id = data.index;

    User.genRandomKey(function(key) {
      self.key = key;
    next();
    });
  });
});

userSchema.methods.validPass = function(password, cb) {
  bcrypt.compare(password, this.password, function(err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

var User = mongoose.model('User', userSchema);

User.register = function(data, cb) {
  if (data.username.match(/^[a-zA-Z0-9]{1,20}$/)) {
    if (data.password === '') {
      return cb({flash: 'Please provide a password!', redirect: '/register'}, null);
    }
    User.create(data, function(err, model) {
      if (err) {
        cb({flash: 'This username is already in use!', redirect: '/register'}, null);
      } else {
        cb(null, {user: model, flash: 'Registered successfully! Welcome to RandomAPI!', redirect: '/'});
      }
    });
    return;
  }
  cb({flash: 'Only 20 alphanumeric characters max please!', redirect: '/register'}, null);
};

User.login = function(data, cb) {
  User.findOne({username: data.username}, function(err, model) {
    if (err || !model) {
      cb({flash: 'Invalid username or password!', redirect: '/login'}, null);
    } else {
      model.validPass(data.password, function(err, match) {
        if (match) {
          cb(null, {user: model, flash: 'Logged in successfully! Welcome to RandomAPI!', redirect: '/'});
        } else {
          cb({flash: 'Invalid username of password!', redirect: '/login'}, null);
        }
      });
    }
  });
};

User.getByID = deasync(function(id, cb) {
  User.findOne({id: id}, function(err, model) {
    cb(null, model);
  });
});

User.getByName = deasync(function(name, cb) {
  User.findOne({username: name}, function(err, model) {
    cb(null, model);
  });
});

User.genRandomKey = function(cb) {
  var key, dup;
  do {
    dup = false;
    key = random(6, 16).match(/.{4}/g).join('-');

    User.findOne({key: key}, function(err, model) {
      if (model === null) {
        cb(key);
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
  } else if (mode === 6) {
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  }

  for (var i = 0; i < length; i++) {
      result += chars[range(0, chars.length - 1)];
  }

  return result;
}

function range(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = User;

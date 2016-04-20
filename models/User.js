var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');
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
  role: {
    type: String,
    default: "user"
  }
});

userSchema.pre('save', function(next) {
  var self = this;
  this.password = bcrypt.hashSync(this.password);
  Counters.getNextIndex("users", true, function(data) {
    self.id = data.index;
    next();
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
    User.create(data, function(err, model) {
      if (err) {
        cb({flash: "This username is already in use!", redirect: "/register"}, null);
      } else {
        cb(null, {user: model, flash: "Registered successfully! Welcome to RandomAPI!", redirect: "/"});
      }
    });
  } else {
    cb({flash: "Only 20 alphanumeric characters max please!", redirect: "/register"}, null);
  }
}

User.login = function(data, cb) {
  User.findOne({username: data.username}, function(err, model) {
    if (err || !model) {
      cb({flash: "Invalid username or password!", redirect: "/login"}, null);
    } else {
      model.validPass(data.password, function(err, match) {
        if (match) {
          cb(null, {user: model, flash: "Logged in successfully! Welcome to RandomAPI!", redirect: "/"});
        } else {
          cb({flash: "Invalid username of password!", redirect: "/login"}, null);
        }
      });
    }
  });
}

module.exports = User;

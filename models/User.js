const bcrypt  = require('bcrypt-nodejs');
const random  = require('../utils').random;
const range   = require('../utils').range;
const logger  = require('../utils').logger;
const deasync = require('deasync');
const db      = require('./db');

module.exports = {
  register(data, cb) {
    if (data.username.match(/^[a-zA-Z0-9]{1,20}$/)) {
      if (data.password === '') {
        return cb({flash: 'Please provide a password!', redirect: '/register'}, null);
      }
      if (this.exists(data.username)) {
        cb({flash: 'This username is already in use!', redirect: '/register'}, null);
      } else {
        var result = this.addUser(data);
        logger(JSON.stringify(result));
        cb(null, {user: result, redirect: '/'});
      }
      return;
    }
    cb({flash: 'Only 20 alphanumeric chars max please!', redirect: '/register'}, null);
  },
  exists: deasync((username, cb) => {
    db.query('SELECT * FROM `User` WHERE ?', {username}, (err, results) => cb(null, results.length !== 0));
  }),
  keyExists: deasync((apikey, cb) => {
    db.query('SELECT * FROM `User` WHERE ?', {apikey}, (err, results) => cb(null, results.length !== 0));
  }),
  login() {

  },
  getByID: deasync(function(id, cb) {
    db.query('SELECT * FROM `User` WHERE ?', {id}, (err, results) => cb(null, results[0]));
  }),
  getByName() {

  },
  genRandomKey() {
    let key, dup;
    do {
      key = random(6, 16).match(/.{4}/g).join('-');
      if (this.keyExists(key)) {
        dup = false;
      }
    } while(dup);

    return key;
  },
  addUser: deasync(function(data, cb) {
    var self = this;
    data.password = bcrypt.hashSync(data.password);
    data.apikey   = this.genRandomKey();

    db.query('INSERT INTO `User` SET ?', data, (err, result) => {
      if (err) {
        cb(null, err);
      } else {
        cb(null, self.getByID(Number(result.insertId)));
      }
    });
  })
};

const bcrypt  = require('bcrypt-nodejs');
const random  = require('../utils').random;
const range   = require('../utils').range;
const logger  = require('../utils').logger;
const db      = require('./db');
const Promise = require('bluebird');

module.exports = {
  register(data, cb) {
    if (data.username.match(/^[a-zA-Z0-9]{1,20}$/)) {
      if (data.password === '') {
        cb({flash: 'Please provide a password!', redirect: '/register'}, null);
      } else {
        this.getByName(data.username).then((user) => {
          if (user !== null) {
            cb({flash: 'This username is already in use!', redirect: '/register'}, null);
          } else {
            this.addUser(data).then(this.getByID).then(user => {
              cb(null, {user, redirect: '/'});
            });
          }
        });
      }
    } else {
      cb({flash: 'Only 20 alphanumeric chars max please!', redirect: '/register'}, null);
    }
  },
  keyExists(apikey) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `User` WHERE ?', {apikey}, (err, data) => {
        if (err) reject(err);
        else resolve(data.length !== 0);
      });
    });
  },
  validPass(password, hash) {
    return bcrypt.compareSync(password, hash);
  },
  login(data, cb) {
    this.getByName(data.username).then(user => {
      if (user !== null && this.validPass(data.password, user.password)) {
        cb(null, {user, redirect: '/'});
      } else {
        cb({flash: 'Invalid username or password!', redirect: '/login'}, null);
      }
    });
  },
  getByID(id) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `User` WHERE ?', {id}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data[0]);
      });
    });
  },
  getByName(username) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `User` WHERE ?', {username}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data[0]);
      });
    });
  },
  genRandomKey() {
    let key, dup;
    do {
      key = random(6, 16).match(/.{4}/g).join('-');

      this.keyExists(key).then(exists => {
        dup = exists;
      }, () => {});
    } while(dup);

    return key;
  },
  addUser(data) {
    return new Promise((resolve, reject) => {
      let self = this;
      data.password = bcrypt.hashSync(data.password);
      data.apikey   = this.genRandomKey();

      db.query('INSERT INTO `User` SET ?', data, (err, result) => {
        err ? reject(err) : resolve(result.insertId);
      });
    });
  }
};

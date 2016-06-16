const bcrypt  = require('bcrypt-nodejs');
const random  = require('../utils').random;
const range   = require('../utils').range;
const logger  = require('../utils').logger;
const db      = require('./db');
const Promise = require('bluebird');

module.exports = {
  register(data, cb) {
    return new Promise((resolve, reject) => {
      if (data.username.match(/^[a-zA-Z0-9]{1,20}$/)) {
        if (data.password === '') {
          reject({flash: 'Please provide a password!', redirect: '/register'});
        } else {
          this.getCond({username: data.username}).then((user) => {
            if (user !== null) {
              reject({flash: 'This username is already in use!', redirect: '/register'});
            } else {
              this.addUser(data).then(this.getCond).then(user => {
                resolve({user, redirect: '/'});
              });
            }
          });
        }
      } else {
        reject({flash: 'Only 20 alphanumeric chars max please!', redirect: '/register'});
      }
    });
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
    return new Promise((resolve, reject) => {
      this.getCond({username: data.username}).then(user => {
        if (user !== null && this.validPass(data.password, user.password)) {
          resolve({user, redirect: '/'});
        } else {
          reject({flash: 'Invalid username or password!', redirect: '/login'});
        }
      });
    });
  },
  getCond(cond) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `User` WHERE ?', cond, (err, data) => {
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
        err ? reject(err) : resolve({id: result.insertId});
      });
    });
  }
};

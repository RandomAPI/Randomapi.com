const bcrypt  = require('bcrypt-nodejs');
const random  = require('../utils').random;
const range   = require('../utils').range;
const logger  = require('../utils').logger;
const andify  = require('../utils').andify;
const db      = require('./db').connection;
const Promise = require('bluebird');

const Subscription = require('./Subscription');

module.exports = {
  register(data, cb) {
    return new Promise((resolve, reject) => {
      if (data.username.match(/^[a-zA-Z0-9]{1,20}$/)) {
        if (data.password === '') {
          reject({flash: 'Please provide a password!', redirect: '/register'});
        } else {
          this.getCond({username: data.username}).then(user => {
            if (user !== null) {
              reject({flash: 'This username is already in use!', redirect: '/register'});
            } else {
              this.addUser(data).then(Subscription.add).then(this.getCond).then(user => {
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
  genPassHash(password) {
    return bcrypt.hashSync(password);
  },
  keyExists(apikey) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `user` WHERE ?', {apikey}, (err, data) => {
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
      cond = andify(cond);
      if (cond.query !== undefined) {
        db.query('SELECT u.*, t.id AS tierID, \
        t.results AS tierResults, t.name AS tierName FROM `user` u \
        INNER JOIN `subscription` s ON (u.id=s.uid) \
        INNER JOIN `plan` p ON (s.plan=p.id) \
        INNER JOIN `tier` t ON (p.tier=t.id) WHERE ? ' + cond.query, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      } else {
        db.query('SELECT u.*, t.id AS tierID, \
        t.results AS tierResults, t.name AS tierName FROM `user` u \
        INNER JOIN `subscription` s ON (u.id=s.uid) \
        INNER JOIN `plan` p ON (s.plan=p.id) \
        INNER JOIN `tier` t ON (p.tier=t.id) WHERE ?', cond, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      }
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
      let timezones = [
      -12.0, -11.0, -10.0, -9.0, -8.0, -7.0, -6.0,
      -5.0, -4.0, -3.5, -3.0, -2.0, -1.0, 0.0, 1.0,
      2.0, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 5.75, 6.0,
      7.0, 8.0, 9.0, 9.5, 10.0, 11.0, 12.0];
      if (timezones.indexOf(Number(data.timezone)) === -1) data.timezone = 0.0;
      data.password = bcrypt.hashSync(data.password);
      data.apikey   = this.genRandomKey();

      db.query('INSERT INTO `user` SET ?', data, (err, result) => {
        err !== null ? reject(err) : resolve({id: result.insertId});
      });
    });
  },
  update(vals, username) {
    return new Promise((resolve, reject) => {
      db.query('UPDATE `user` SET ? WHERE ?', [vals, {username}], (err, result) => {
        resolve({err: err, result: result});
      });
    });
  },
  getVal(key, username) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `user` WHERE ?', {username}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data[0][key]);
      });
    });
  },
  incVal(key, value, username) {
    value = Number(value);
    return new Promise((resolve, reject) => {
      this.getVal(key, username).then(previous => {
        previous += value;
        db.query('UPDATE `user` SET ? WHERE ?', [{[key]: previous}, {username}], (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else resolve(previous);
        });
      });
    });
  },
  decVal(key, value, username) {
    value = Number(value);
    return this.incVal(key, -value, username);
  }
};

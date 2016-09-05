const random  = require('../utils').random;
const range   = require('../utils').range;
const logger  = require('../utils').logger;
const andify  = require('../utils').andify;
const db      = require('./db').connection;
const moment  = require('moment');
const Promise = require('bluebird');
const crypto  = require('crypto');

module.exports = {
  add(data) {
    return new Promise((resolve, reject) => {
      let self = this;

      data.ref       = this.genRandomRef();
      data.authToken = this.genRandomToken();

      db.query('INSERT INTO `token` SET ?', data, (err, result) => {
        err ? reject(err) : resolve({id: result.insertId});
      });
    });
  },
  revoke(cond) {
    return new Promise((resolve, reject) => {
      db.query('DELETE FROM `token` WHERE ?', cond, (err, data) => {
        err ? reject(err) : resolve();
      });
    });
  },
  genRandomRef() {
    let ref, dup;

    do {
      dup = false;
      ref = random(5, 8);

      this.refExists(ref).then(exists => {
        dup = exists;
      });
    } while(dup);

    return ref;
  },
  genRandomToken() {
    let token, dup;

    do {
      dup = false;
      token = random(2, 16);

      this.tokenExists(token).then(exists => {
        dup = exists;
      });
    } while(dup);

    return token;
  },
  genRandomClientToken() {
    let token, dup;

    do {
      dup = false;
      token = random(2, 16);

      this.clientTokenExists(token).then(exists => {
        dup = exists;
      });
    } while(dup);

    return token;
  },
  refExists(ref) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `token` WHERE ?', {ref}, (err, data) => {
        err ? reject(err) : resolve(data.length !== 0);
      });
    });
  },
  tokenExists(authToken) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `token` WHERE ?', {authToken}, (err, data) => {
        err ? reject(err) : resolve(data.length !== 0);
      });
    });
  },
  clientTokenExists(clientToken) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `token` WHERE ?', {clientToken}, (err, data) => {
        err ? reject(err) : resolve(data.length !== 0);
      });
    });
  },
  getCond(cond) {
    return new Promise((resolve, reject) => {
      cond = andify(cond);

      if (cond.query !== undefined) {
        db.query('SELECT * FROM `token` WHERE ' + cond.query, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      } else {
        db.query('SELECT * FROM `token` WHERE ?', cond, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      }
    });
  },
  getTokens(owner) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `token` WHERE ? ORDER BY `lastUsed` DESC', {owner}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data);
      });
    });
  },
  update(vals, ref) {
    return new Promise((resolve, reject) => {
      db.query('UPDATE `token` SET ? WHERE ?', [vals, {ref}], (err, result) => {
        this.lastUsed(ref).then(() => {
          resolve({err: err, result: result});
        });
      });
    });
  },
  lastUsed(ref) {
    return new Promise((resolve, reject) => {
      db.query('UPDATE `token` SET ? WHERE ?', [{lastUsed: moment(new Date().getTime()).format("YYYY-MM-DD HH:mm:ss")}, {ref}], (err, result) => {
        resolve({err: err, result: result});
      });
    });
  },
  valid(clientToken, fingerprint) {
    return new Promise((resolve, reject) => {
      this.getCond({clientToken, fingerprint}).then(token => {
        if (token === null) resolve(null);
        else {
          this.lastUsed(token.ref).then(() => {
            resolve(true);
          });
        }
      });
    });
  }
};

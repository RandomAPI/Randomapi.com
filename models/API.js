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

      data.ref  = this.genRandomRef();
      data.hash = this.genRandomHash();
      data.generator = 1;

      db.query('INSERT INTO `api` SET ?', data, (err, result) => {
        err ? reject(err) : resolve({id: result.insertId});
      });
    });
  },
  remove(cond) {
    return new Promise((resolve, reject) => {
      db.query('DELETE FROM `api` WHERE ?', cond, (err, data) => {
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
  genRandomHash() {
    let hash, dup;

    do {
      dup = false;
      hash = random(1, 32);

      this.hashExists(hash).then(exists => {
        dup = exists;
      });
    } while(dup);

    return hash;
  },
  refExists(ref) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `api` WHERE ?', {ref}, (err, data) => {
        err ? reject(err) : resolve(data.length !== 0);
      });
    });
  },
  hashExists(hash) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `api` WHERE ?', {hash}, (err, data) => {
        err ? reject(err) : resolve(data.length !== 0);
      });
    });
  },
  getCond(cond) {
    return new Promise((resolve, reject) => {
      cond = andify(cond);

      if (cond.query !== undefined) {
        db.query('SELECT * FROM `api` WHERE ' + cond.query, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      } else {
        db.query('SELECT * FROM `api` WHERE ?', cond, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      }
    });
  },
  getAPIs(owner) {
    return new Promise((resolve, reject) => {
      db.query('SELECT a.* FROM `api` a INNER JOIN `generator` g ON (a.generator=g.id) WHERE ? ORDER BY `modified` DESC', {owner}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data);
      });
    });
  },
  update(vals, ref) {
    return new Promise((resolve, reject) => {
      db.query('UPDATE `api` SET ? WHERE ?', [vals, {ref}], (err, result) => {
        this.modified(ref).then(() => {
          resolve({err: err, result: result});
        });
      });
    });
  },
  getVal(key, ref) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `api` WHERE ?', {ref}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data[0][key]);
      });
    });
  },
  incVal(key, value, ref) {
    value = Number(value);
    return new Promise((resolve, reject) => {
      this.getVal(key, ref).then(previous => {
        previous += value;
        db.query('UPDATE `api` SET ? WHERE ?', [{[key]: previous}, {ref}], (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else resolve(previous);
        });
      });
    });
  },
  decVal(key, value, ref) {
    return this.incVal(key, -Number(value), ref);
  },
  modified(ref) {
    return new Promise((resolve, reject) => {
      db.query('UPDATE `api` SET ? WHERE ?', [{modified: moment(new Date().getTime()).format("YYYY-MM-DD HH:mm:ss")}, {ref}], (err, result) => {
        resolve({err: err, result: result});
      });
    });
  },
  lastcall(ref) {
    return new Promise((resolve, reject) => {
      db.query('UPDATE `api` SET ? WHERE ?', [{lastcall: moment(new Date().getTime()).format("YYYY-MM-DD HH:mm:ss")}, {ref}], (err, result) => {
        resolve({err: err, result: result});
      });
    });
  }
};

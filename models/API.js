const random  = require('../utils').random;
const range   = require('../utils').range;
const logger  = require('../utils').logger;
const andify  = require('../utils').andify;
const db      = require('./db').connection;
const Promise = require('bluebird');

module.exports = {
  add(data) {
    return new Promise((resolve, reject) => {
      let self = this;
      data.ref = this.genRandomRef();
      data.generator = 1;

      db.query('INSERT INTO `api` SET ?', data, (err, result) => {
        err ? reject(err) : resolve({id: result.insertId});
      });
    });
  },
  remove(cond) {
    return new Promise((resolve, reject) => {
      db.query('DELETE FROM `api` WHERE ?', cond, (err, data) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
  genRandomRef() {
    let ref, dup;
    do {
      dup = false;
      ref = random(5, 5);

      this.refExists(ref).then(exists => {
        dup = exists;
      }, () => {});
    } while(dup);
    return ref;
  },
  refExists(ref) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `api` WHERE ?', {ref}, (err, data) => {
        if (err) reject(err);
        else resolve(data.length !== 0);
      });
    });
  },
  getCond(cond) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `api` WHERE ?', cond, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data[0]);
      });
    });
  },
  getAPIs(owner) {
    return new Promise((resolve, reject) => {
      db.query('SELECT a.id, a.ref, a.name, g.version generator, a.owner FROM `api` a INNER JOIN `generator` g ON (a.generator=g.id) WHERE ?', {owner}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data);
      });
    });
  }
};

const random  = require('../utils').random;
const range   = require('../utils').range;
const logger  = require('../utils').logger;
const db      = require('./db');
const Promise = require('bluebird');

module.exports = {
  add(data) {
    return new Promise((resolve, reject) => {
      let self = this;
      data.ref = this.genRandomRef();

      db.query('INSERT INTO `API` SET ?', data, (err, result) => {
        err ? reject(err) : resolve(result.insertId);
      });
    });
  },
  remove(id) {
    return new Promise((resolve, reject) => {
      db.query('DELETE FROM `API` WHERE ?', {id}, (err, data) => {
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
      db.query('SELECT * FROM `API` WHERE ?', {ref}, (err, data) => {
        if (err) reject(err);
        else resolve(data.length !== 0);
      });
    });
  },
  getAPIByRef(ref) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `API` WHERE ?', {ref}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data[0]);
      });
    });
  },
  getAPI(id) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `API` WHERE ?', {id}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data[0]);
      });
    });
  },
  getAPIs(owner) {
    return new Promise((resolve, reject) => {
      db.query('SELECT a.id, a.ref, a.name, g.version generator, a.owner  FROM API a INNER JOIN Generator g ON (a.generator=g.id) WHERE ?', {owner}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data);
      });
    });
  }
};

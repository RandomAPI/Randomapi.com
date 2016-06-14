const db      = require('./db');
const random  = require('../utils').random;
const range   = require('../utils').range;
const logger  = require('../utils').logger;

module.exports = {
  add(data) {
    return new Promise((resolve, reject) => {
      let self = this;
      data.ref = this.genRandomRef();

      db.query('INSERT INTO `List` SET ?', data, (err, result) => {
        err ? reject(err) : resolve(result.insertId);
      });
    });
  },
  remove(id) {
    return new Promise((resolve, reject) => {
      db.query('DELETE FROM `List` WHERE ?', {id}, (err, data) => {
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
      db.query('SELECT * FROM `List` WHERE ?', {ref}, (err, data) => {
        if (err) reject(err);
        else resolve(data.length !== 0);
      });
    });
  },
  getListByRef(ref) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `List` WHERE ?', {ref}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data[0]);
      });
    });
  },
  getList(id) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `List` WHERE ?', {id}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data[0]);
      });
    });
  },
  getLists(owner) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `List` WHERE ?', {owner}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data);
      });
    });
  }
};

const random  = require('../utils').random;
const range   = require('../utils').range;
const logger  = require('../utils').logger;
const andify  = require('../utils').andify;
const db      = require('./db').connection;
const Promise = require('bluebird');

//const cc = snippet('keitharm/credit_card_generator/0.1');
//snippets can be drafted and edited and tested in the snippet preview, but in order
//to use them in an API, they much be saved with a version number and they can't be edited anymore.

module.exports = {
  add(data) {
    return new Promise((resolve, reject) => {
      let self = this;
      data.ref = this.genRandomRef();
      data.description = "";

      db.query('INSERT INTO `snippet` SET ?', data, (err, result) => {
        err ? reject(err) : resolve({['s.id']: result.insertId});
      });
    });
  },
  remove(cond) {
    return new Promise((resolve, reject) => {
      db.query('DELETE FROM `snippet` WHERE ?', cond, (err, data) => {
        if (err) reject(err);
        else resolve();
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
      }, () => {});
    } while(dup);
    return ref;
  },
  refExists(ref) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `snippet` WHERE ?', {ref}, (err, data) => {
        if (err) reject(err);
        else resolve(data.length !== 0);
      });
    });
  },
  getCond(cond) {
    return new Promise((resolve, reject) => {
      cond = andify(cond);
      if (cond.query !== undefined) {
        db.query('SELECT s.* FROM `snippet` s \
        INNER JOIN `user` u ON (u.id=s.owner) WHERE ' + cond.query, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      } else {
        db.query('SELECT s.* FROM `snippet` s \
        INNER JOIN `user` u ON (u.id=s.owner) WHERE ?', cond, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      }
    });
  },
  getSnippets(owner) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `snippet` WHERE ?', {owner}, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else resolve(data);
      });
    });
  },
  update(vals, ref) {
    return new Promise((resolve, reject) => {
      db.query('UPDATE `snippet` SET ? WHERE ?', [vals, {ref}], (err, result) => {
        resolve({err: err, result: result});
      });
    });
  }
};



//

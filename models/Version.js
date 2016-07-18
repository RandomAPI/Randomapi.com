const random  = require('../utils').random;
const range   = require('../utils').range;
const logger  = require('../utils').logger;
const andify  = require('../utils').andify;
const db      = require('./db').connection;
const moment  = require('moment');
const async   = require('async');
const _       = require('lodash');
const Promise = require('bluebird');

module.exports = {
  add(data) {
    return new Promise((resolve, reject) => {

      db.query('INSERT INTO `snippetversion` SET ?', data, (err, result) => {
        if (err) reject(err);
        else resolve(result.insertId);
      });
    });
  },
  newRevision(id) {
    return new Promise((resolve, reject) => {
      db.query('SELECT snippetID, version FROM `snippetversion` WHERE ? ORDER BY version DESC', {snippetID: id}, (err, doc) => {
        this.add({snippetID: id, description: '', version: doc[0].version+1}).then(resolve);
      });
    })
    //// make copy of record with incremented version number, published set to 0, and update created/modified date, update description
  },
  remove(id) {
    return new Promise((resolve, reject) => {
      db.query('DELETE FROM `snippetversion` WHERE ?', {snippetID: id}, (err, data) => {
        err ? reject(err) : resolve();
      });
    });
  },
  getCond(cond) {
    return new Promise((resolve, reject) => {
      cond = andify(cond);
      if (cond.query !== undefined) {
        db.query('SELECT v.* FROM `snippetversion` v \
        INNER JOIN `snippet` s ON (s.id=v.snippetID) WHERE ' + cond.query + ' ORDER BY version DESC LIMIT 1', (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      } else {
        db.query('SELECT v.* FROM `snippetversion` v \
        INNER JOIN `snippet` s ON (s.id=v.snippetID) WHERE ? ORDER BY version DESC LIMIT 1', cond, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      }
    });
  },
  getVersion(ref, version) {
    return new Promise((resolve, reject) => {
      db.query(`SELECT v.* FROM snippetversion v \
        INNER JOIN snippet s ON (s.id=v.snippetID) WHERE s.ref = ${db.escape(ref)} AND v.version = ${db.escape(version)} ORDER BY version DESC LIMIT 1`, (err, data) => {
        if (err) reject(err);
        else if (data.length === 0) resolve(null);
        else if (data.length === 1) resolve(data[0]);
        else resolve(data);
      });
    });
  },
  getVersions(ref) {
    return new Promise((resolve, reject) => {
      db.query(`SELECT v.* FROM snippetversion v \
        INNER JOIN snippet s ON (s.id=v.snippetID) WHERE s.ref = ${db.escape(ref)} ORDER BY v.version DESC`, (err, data) => {
        resolve(data);
      });
    });
  },
  update(vals, id) {
    return new Promise((resolve, reject) => {
      db.query('UPDATE `snippetversion` SET ? WHERE ?', [vals, {id}], (err, result) => {
        this.modified(id).then(() => {
          resolve({err: err, result: result});
        });
      });
    });
  },
  modified(id) {
    return new Promise((resolve, reject) => {
      db.query('UPDATE `snippetversion` SET ? WHERE ?', [{modified: moment(new Date().getTime()).format("YYYY-MM-DD HH:mm:ss")}, {id}], (err, result) => {
        resolve({err: err, result: result});
      });
    });
  }
};

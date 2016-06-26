const bcrypt  = require('bcrypt-nodejs');
const db      = require('./db').connection;
const andify  = require('../utils').andify;
const Promise = require('bluebird');

module.exports = {
  getByID(id) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `generator` WHERE ?', {id}, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  },
  getByVersion(version) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `generator` WHERE ?', {version}, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  },
  getLatestVersion() {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `generator` ORDER BY `id` DESC LIMIT 1', (err, data) => {
        if (err) reject(err);
        else resolve(data[0]);
      });
    });
  },
  getAvailableVersions() {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM `generator` ORDER BY `id` DESC', (err, data) => {
        if (err) reject(err);
        else {
          let versions = [];
          data.forEach(row => {
            versions.push({id: row.id, version: row.version});
          });
          resolve(versions);
        }
      });
    });
  },
  getCond(cond) {
    return new Promise((resolve, reject) => {
      cond = andify(cond);
      if (cond.query !== undefined) {
        db.query('SELECT * FROM `generator` WHERE ' + cond.query, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      } else {
        db.query('SELECT * FROM `generator` WHERE ?', cond, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      }
    });
  }
};

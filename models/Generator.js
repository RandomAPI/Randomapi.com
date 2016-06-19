const bcrypt    = require('bcrypt-nodejs');
const db        = require('./db');
const Promise   = require('bluebird');

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
  }
};

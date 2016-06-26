const random  = require('../utils').random;
const range   = require('../utils').range;
const logger  = require('../utils').logger;
const andify  = require('../utils').andify;
const db      = require('./db').connection;
const Promise = require('bluebird');

module.exports = {
  // Basic new subscription insert for newly created free tier accounts
  add(userID) {
    return new Promise((resolve, reject) => {
      db.query('INSERT INTO `subscription` SET ?', {uid: userID.id}, (err, result) => {
        err ? reject(err) : resolve({['u.id']: userID.id});
      });
    });
  },
  upgrade(userID, info) {
    return new Promise((resolve, reject) => {
      db.query('UPDATE `subscription` SET ? WHERE ?', [info, userID], (err, result) => {
        err ? reject(err) : resolve(true);
      });
    });
  },
  getCond(cond) {
    return new Promise((resolve, reject) => {
      cond = andify(cond);
      if (cond.query !== undefined) {
        db.query('SELECT * FROM `subscription` WHERE ' + cond.query, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      } else {
        db.query('SELECT * FROM `subscription` WHERE ?', cond, (err, data) => {
          if (err) reject(err);
          else if (data.length === 0) resolve(null);
          else if (data.length === 1) resolve(data[0]);
          else resolve(data);
        });
      }
    });
  }
};

const random  = require('../utils').random;
const range   = require('../utils').range;
const logger  = require('../utils').logger;
const andify  = require('../utils').andify;
const stripe  = require('../utils').stripe;
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
  update(userID, info) {
    return new Promise((resolve, reject) => {
      db.query('UPDATE `subscription` SET ? WHERE ?', [info, {uid: userID}], (err, result) => {
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
  },
  getUnpaidInvoices(customer) {
    return new Promise((resolve, reject) => {
      let unpaid = [];
      stripe.invoices.list({
        customer,
      }, (err, invoices) => {
        if (err) reject(err);
        else {
          invoices.data.forEach(invoice => {
            if (!invoice.paid && !invoice.closed) {
              unpaid.push(invoice);
            }
          });
          if (unpaid.length === 0) resolve(null);
          else resolve(unpaid);
        }
      });
    });
  },
  payInvoice(invoice) {
    return new Promise((resolve, reject) => {
      stripe.invoices.pay(invoice, (err, invoice) => {
        if (err) reject(err);
        else resolve(invoice);
      });
    });
  }
};

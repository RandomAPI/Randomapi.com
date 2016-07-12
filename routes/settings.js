const express = require('express');
const _       = require('lodash');
const router  = express.Router();
const logger  = require('../utils').logger;
const syslog  = require('../utils').syslog;
const stripe  = require('../utils').stripe;
const moment  = require('moment');

const User = require('../models/User');
const Tier = require('../models/Tier');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', (req, res, next) => {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');
  if (!req.session.loggedin) {
    res.redirect(baseURL + '/');
  } else {
    next();
  }
});

router.get('/', (req, res, next) => {
  res.render('settings/general', _.merge(defaultVars, {title: 'Settings'}));
});

router.post('/', (req, res, next) => {
  User.getVal('password', req.session.user.username).then(curPass => {
    if (User.validPass(req.body.current, curPass)) {
      if (req.body.new !== req.body.confirm) {
        req.flash('info', 'New and confirm password did not match!');
        res.redirect(baseURL + '/settings');
      } else {
        User.update({password: User.genPassHash(req.body.new)}, req.session.user.username).then(() => {
          req.flash('info', 'Password updated successfully!');
          res.redirect(baseURL + '/settings');
        });
      }
    } else {
      req.flash('warning', 'Current password did not match!');
      res.redirect(baseURL + '/settings');
    }
  });
});

router.get('/subscription', (req, res, next) => {
  stripe.customers.retrieve(req.session.subscription.cid, (err, customer) => {
    res.render('settings/subscription', _.merge(defaultVars, {title: 'Subscription', tier: req.session.tier, subscription: req.session.subscription, card: customer.sources.data[0]}));
  });
});

router.get('/subscription/cancel', (req, res, next) => {
  stripe.subscriptions.del(req.session.subscription.sid, {at_period_end: true}, (err, confirmation) => {
    if (err) {
      req.flash('warning', 'There was a problem canceling your subscription!');
      res.sendStatus(200);
    } else {
      Subscription.update(req.session.user.id, {canceled: moment(new Date().getTime()).format("YYYY-MM-DD HH:mm:ss"), status: 2}).then(subscription => {
        req.flash('info', 'Your subscription will be canceled at the end of your billing period!');
        res.sendStatus(200);
      });
    }
  });
});

router.get('/subscription/restart', (req, res, next) => {
  if (req.session.subscription.status !== 2) {
    req.flash('warning', 'There was a problem restarting your subscription!');
    res.sendStatus(200);
  } else {
    Plan.getCond({id: subscription.plan}).then(plan => {
      stripe.subscriptions.update(subscription.sid, {plan: plan.name}, (err, confirmation) => {
        if (err) {
          req.flash('warning', 'There was a problem restarting your subscription!');
          res.sendStatus(200);
        } else {
          Subscription.update(req.session.user.id, {canceled: null, status: 1}).then(subscription => {
            req.flash('info', 'Your subscription was restarted successfully!');
            res.sendStatus(200);
          });
        }
      });
    });
  }
});

router.get('/subscription/upgrade', (req, res, next) => {
  if (req.session.subscription.status > 2) {
    req.flash('warning', 'There was a problem upgrading your subscription!');
    res.sendStatus(200);
  } else {
    Plan.getCond({id: 4}).then(plan => {
      stripe.subscriptions.update(req.session.subscription.sid, {plan: plan.name}, (err, confirmation) => {
        if (err) {
          req.flash('warning', 'There was a problem upgrading your subscription!');
          res.sendStatus(200);
        } else {
          Subscription.update(req.session.user.id, {canceled: null, status: 1, plan: 4}).then(subscription => {
            req.flash('info', 'Your subscription was upgraded successfully!');
            res.sendStatus(200);
          });
        }
      });
    });
  }
});

router.get('/subscription/attemptPayment', (req, res, next) => {
  let results = [];
  let error = false;
  Subscription.getUnpaidInvoices(req.session.subscription.cid).then(data => {
    if (data === null) {
      req.flash('warning', 'No unpaid invoices were found.');
      res.sendStatus(200);
    } else {
      data.forEach(invoice => {
        Subscription.payInvoice(invoice.id).then(result => {
          results.push(result);
          if (results.length === data.length) {
            if (!error) {
              Subscription.update(req.session.subscription.uid, {status: 1}).then(data => {
                // Change account status
                req.flash('info', 'Outstanding Invoices were paid off successfully! Your account has been unlocked.');
                res.sendStatus(200);
              });
            } else {
              req.flash('warning', error);
              res.sendStatus(200);
            }
          }
        }, err => {
          error = err.toString();
          results.push(err);
          syslog(err, req);
          if (results.length === data.length) {
            req.flash('warning', err.toString());
            res.sendStatus(200);
          }
        });
      });
    }
  }, err => {
    syslog(err, req);
    req.flash('warning', err);
    res.sendStatus(200);
  });
});

router.get('/subscription/paymentOverdue', (req, res, next) => {
  req.flash('warning', 'Your account is currently on hold until your subscription status is resolved.');
  res.redirect(baseURL + "/settings/subscription");
});

module.exports = router;

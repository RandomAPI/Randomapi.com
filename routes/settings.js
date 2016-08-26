const express = require('express');
const _       = require('lodash');
const router  = express.Router();
const logger  = require('../utils').logger;
const syslog  = require('../utils').syslog;
const stripe  = require('../utils').stripe;
const moment  = require('moment');
const missingProps = require('../utils').missingProps;

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
  if (missingProps(req.body, ['current', 'new', 'confirm'])) {
    req.flash('warning', 'Missing expected form properties');
    res.redirect(baseURL + '/settings');
    return;
  }

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
    if (!err) {
      res.render('settings/subscription', _.merge(defaultVars, {title: 'Subscription', tier: req.session.tier, subscription: req.session.subscription}));
    } else {
      res.render('settings/subscription', _.merge(defaultVars, {title: 'Subscription', tier: req.session.tier, subscription: req.session.subscription}));
    }
  });
});

module.exports = router;

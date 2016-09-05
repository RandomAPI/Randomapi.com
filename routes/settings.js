const express = require('express');
const _       = require('lodash');
const router  = express.Router();
const logger  = require('../utils').logger;
const syslog  = require('../utils').syslog;
const stripe  = require('../utils').stripe;
const moment  = require('moment');
const missingProps = require('../utils').missingProps;

const User  = require('../models/User');
const Tier  = require('../models/Tier');
const Plan  = require('../models/Plan');
const Token = require('../models/Token');
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
        req.flash('warning', 'New and confirm password did not match!');
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

router.get('/offline', (req, res, next) => {
  Token.getTokens(req.session.user.id).then(tokens => {
    res.render('settings/offline', _.merge(defaultVars, {title: 'Offline', tier: req.session.tier, tokens}));
  });
});

router.get('/revokeToken/:ref', (req, res, next) => {
  Token.getCond({ref: req.params.ref}).then(doc => {
    if (doc === null || doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/settings/offline#active');
    } else {
      Token.revoke({ref: req.params.ref}).then(() => {
        req.flash('info', `Token ${doc.name} was revoked successfully!`);
        res.redirect(baseURL + '/settings/offline#active');
      });
    }
  });
});

router.post('/offline', (req, res, next) => {
  if (missingProps(req.body, ['name', 'password'])) {
    req.flash('warning', 'Missing expected form properties');
    res.redirect(baseURL + '/settings/offline#new');
    return;
  }

  // User is authenticated
  User.login({username: req.session.user.username, password: req.body.password}).then(data => {
    if (req.body.name === '') {
      req.flash('warning', 'Please provide a name for your Token');
      res.redirect(baseURL + '/settings/offline#new');

    } else if (!req.body.name.match(/^[A-z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/)) {
      req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
      res.redirect(baseURL + '/settings/offline#new');

    // Is user premium
    } else if (req.session.user.tierID !== 3) {
      req.flash('warning', 'A premium tier subscription is required to access this feature.');
      res.redirect(baseURL + '/settings/subscription');

    // Else, add the token
    } else {
      Token.add({name: req.body.name, owner: req.session.user.id}).then(Token.getCond).then(model => {
        req.flash('token', `Token ${model.name} was added successfully!${model.authToken}`);
        res.redirect(baseURL + '/settings/offline#active');
      });
    };
  }, err => {
    req.flash('warning', 'Invalid password');
    res.redirect(baseURL + '/settings/offline#new');
  });
});

module.exports = router;

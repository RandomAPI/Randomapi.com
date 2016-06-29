const express = require('express');
const _       = require('lodash');
const router  = express.Router();
const logger  = require('../utils').logger;
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
  next();
});

router.get('/', (req, res, next) => {
  if (req.session.loggedin) {
    res.render('dashboard', _.merge(defaultVars, {title: 'Dashboard'}));
  } else {
    res.render('index', _.merge(defaultVars, {title: 'Index'}));
  }
});

router.get('/upgrade', (req, res, next) => {
  if (req.session.loggedin) {
    // Is user OVER their limits from a recent downgrade?
    if (req.session.subscription.status === 4) {
      req.flash('warning', 'Your account is currently soft-locked until your account quotas are within their limits.');
      res.redirect(baseURL + '/');
    } else if (req.session.user.tierName === 'Free') {
      res.render('upgrade', _.merge(defaultVars, {title: 'Upgrade'}));
    } else {
      res.redirect(baseURL + 'settings/subscription');
    }
  } else {
    res.redirect(baseURL + '/');
  }
});

router.get('/pricing', (req, res, next) => {
  if (req.session.loggedin) {
    res.redirect(baseURL + 'upgrade');
  } else {
    res.render('pricing', _.merge(defaultVars, {title: 'Pricing'}));
  }
});

router.get('/documentation', (req, res, next) => {
  res.render('documentation', _.merge(defaultVars, {title: 'Documentation'}));
});

// Login //
router.get('/login', (req, res, next) => {
  if (req.session.loggedin) {
    res.redirect(baseURL + '/');
  } else {
    res.render('login', _.merge(defaultVars, {title: 'Login'}));
  }
});

router.post('/login', (req, res, next) => {
  if (req.session.loggedin) {
    res.redirect(baseURL + '/');
  } else {
    User.login({username: req.body.username, password: req.body.password}).then(data => {
      Tier.getCond({id: data.user.tierID}).then(tier => {
        req.session.loggedin = true;
        req.session.user = data.user;
        req.session.tier = tier;
        req.flash('info', data.flash);
        res.redirect(baseURL + data.redirect);
      });
    }, err => {
      req.flash('warning', err.flash);
      res.redirect(baseURL + err.redirect);
    });
  }
});

// Logout //
router.get('/logout', (req, res, next) => {
  if (req.session.loggedin) {
    delete req.session.loggedin;
    res.redirect(baseURL + '/');
  } else {
    res.redirect(baseURL + '/');
  }
});

// Registration //
router.get('/register', (req, res, next) => {
  if (req.session.loggedin) {
    res.redirect(baseURL + '/');
  } else {
    res.render('register', _.merge(defaultVars, {title: 'Register'}));
  }
});

router.get('/register/guest', (req, res, next) => {
  req.flash('info', "Please create an account first before you upgrade to a subscription plan.");
  res.redirect(baseURL + '/register');
});

router.post('/register', (req, res, next) => {
  if (!req.session.loggedin) {
    User.register(req.body).then(data => {
      req.session.loggedin = true;
      req.session.user = data.user;
      req.flash('info', data.flash);
      res.redirect(baseURL + data.redirect);
    }, err => {
      req.flash('warning', err.flash);
      res.redirect(baseURL + err.redirect);
    });
  } else {
    res.redirect(baseURL + '/index');
  }
});

module.exports = router;

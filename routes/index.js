const express = require('express');
const _       = require('lodash');
const router  = express.Router();
const logger  = require('../utils').logger;
const stripe  = require('../utils').stripe;
const moment  = require('moment');

const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Tier = require('../models/Tier');
const Plan = require('../models/Plan');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', function(req, res, next) {
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
    if (req.session.user.tierName === 'Free') {
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

router.get('/settings', (req, res, next) => {
  if (req.session.loggedin) {
    res.render('settings/general', _.merge(defaultVars, {title: 'Settings'}));
  } else {
    res.redirect(baseURL + '/');
  }
});

router.post('/settings', (req, res, next) => {
  if (req.session.loggedin) {
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
        req.flash('info', 'Current password did not match!');
        res.redirect(baseURL + '/settings');
      }
    });
  } else {
    res.redirect(baseURL + '/');
  }
});

router.get('/settings/subscription', (req, res, next) => {
  if (req.session.loggedin) {
    Subscription.getCond({uid: req.session.user.id}).then(subscription => {
      Plan.getCond({id: subscription.plan}).then(plan => {
        Tier.getCond({id: plan.tier}).then(tier => {
          res.render('settings/subscription', _.merge(defaultVars, {title: 'Subscription', plan, tier, subscription}));
        });
      });
    });
  } else {
    res.redirect(baseURL + '/');
  }
});

router.get('/settings/subscription/cancel', (req, res, next) => {
  if (req.session.loggedin) {
    Subscription.getCond({uid: req.session.user.id}).then(subscription => {
      stripe.subscriptions.del(subscription.sid, {at_period_end: true}, (err, confirmation) => {
        if (err) {
          req.flash('info', 'There was a problem canceling your subscription!');
          res.sendStatus(200);
        } else {
          Subscription.upgrade(req.session.user.id, {canceled: moment(new Date().getTime()).format("YYYY-MM-DD HH:mm:ss"), status: 2}).then(subscription => {
            req.flash('info', 'Your subscription will be canceled at the end of your billing period!');
            res.sendStatus(200);
          });
        }
      });
    });
  } else {
    res.redirect(baseURL + '/');
  }
});

router.get('/settings/subscription/renew', (req, res, next) => {
  if (req.session.loggedin) {
    Subscription.getCond({uid: req.session.user.id}).then(subscription => {
      if (subscription.status !== 2) {
        req.flash('info', 'There was a problem renewing your subscription!');
        res.sendStatus(200);
      } else {
        Plan.getCond({id: subscription.plan}).then(plan => {
          stripe.subscriptions.update(subscription.sid, {plan: plan.name}, (err, confirmation) => {
            if (err) {
              req.flash('info', 'There was a problem renewing your subscription!');
              res.sendStatus(200);
            } else {
              Subscription.upgrade(req.session.user.id, {canceled: null, status: 1}).then(subscription => {
                req.flash('info', 'Your subscription was renewed successfully!');
                res.sendStatus(200);
              });
            }
          });
        });
      }
    });
  } else {
    res.redirect(baseURL + '/');
  }
});

router.get('/settings/subscription/upgrade', (req, res, next) => {
  if (req.session.loggedin) {
    Subscription.getCond({uid: req.session.user.id}).then(subscription => {
      if (subscription.status > 2) {
        req.flash('info', 'There was a problem upgrading your subscription!');
        res.sendStatus(200);
      } else {
        Plan.getCond({id: 4}).then(plan => {
          stripe.subscriptions.update(subscription.sid, {plan: plan.name}, (err, confirmation) => {
            if (err) {
              req.flash('info', 'There was a problem upgrading your subscription!');
              res.sendStatus(200);
            } else {
              Subscription.upgrade(req.session.user.id, {canceled: null, status: 1, plan: 4}).then(subscription => {
                req.flash('info', 'Your subscription was upgraded successfully!');
                res.sendStatus(200);
              });
            }
          });
        });
      }
    });
  } else {
    res.redirect(baseURL + '/');
  }
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
      req.flash('info', err.flash);
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

router.post('/register', (req, res, next) => {
  if (!req.session.loggedin) {
    User.register(req.body).then(data => {
      req.session.loggedin = true;
      req.session.user = data.user;
      req.flash('info', data.flash);
      res.redirect(baseURL + data.redirect);
    }, err => {
      req.flash('info', err.flash);
      res.redirect(baseURL + err.redirect);
    });
  } else {
    res.redirect(baseURL + '/index');
  }
});

module.exports = router;

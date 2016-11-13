const express = require('express');
const _       = require('lodash');
const router  = express.Router();
const logger  = require('../utils').logger;
const stripe  = require('../utils').stripe;
const redis   = require('../utils').redis;
const async   = require('async');
const moment  = require('moment');
const request = require('request');
const settings     = require('../utils').settings;
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
  next();
});

router.get('/', (req, res, next) => {
  if (req.session.loggedin) {
    res.render('dashboard', _.merge(defaultVars, {title: 'Dashboard'}));
  } else {
    res.render('index', _.merge(defaultVars, {socket: ':' + settings.general.socket, title: 'Index'}));
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
    if (missingProps(req.body, ['username', 'password'])) {
      req.flash('warning', 'Missing expected form properties');
      res.redirect(baseURL + '/login');
      return;
    }
    User.login({username: req.body.username, password: req.body.password}).then(data => {
      Tier.getCond({id: data.user.tierID}).then(tier => {
        req.session.loggedin = true;
        req.session.user = data.user;
        req.session.tier = tier;
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
    delete req.session.user;
    delete req.session.subscription;
    delete req.session.tier;
  }
  res.redirect(baseURL + '/');
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
  req.flash('info', "Please create an account first before you upgrade to a plan.");
  res.redirect(baseURL + '/register');
});

router.get('/search', (req, res, next) => {
  res.render('search', _.merge(defaultVars, {socket: ':' + settings.general.socket, title: 'Search'}));
});

router.post('/register', (req, res, next) => {
  if (missingProps(req.body, ['username', 'password', 'timezone', 'referrer', 'g-recaptcha-response']) && process.env.spec !== "true") {
    req.flash('warning', 'Missing expected form properties');
    res.redirect(baseURL + '/register');
    return;
  }

  if (!req.session.loggedin) {
    User.login({username: req.body.username, password: req.body.password}).then(data => {
      Tier.getCond({id: data.user.tierID}).then(tier => {
        req.session.loggedin = true;
        req.session.user = data.user;
        req.session.tier = tier;
        res.redirect(baseURL + data.redirect);
      });
    }, err => {
      request.post({
        url: 'https://www.google.com/recaptcha/api/siteverify',
        form: {
          secret: settings.recaptcha.secretKey,
          response: req.body['g-recaptcha-response'],
          remoteip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
        }
      }, function(err, httpResponse, body) {
        try {
          let json = JSON.parse(body);

          if (json.success === true || process.env.spec === "true") {
            User.register({username: req.body.username, password: req.body.password, referrer: req.body.referrer, timezone: req.body.timezone}).then(data => {
              req.session.loggedin = true;
              req.session.user = data.user;

              logger(`[user]: New user registration "${data.user.username}"`);
              req.flash('info', 'Account created, thanks for signing up!');
              res.redirect(baseURL + data.redirect);
            }, err => {
              req.flash('warning', err.flash);
              res.redirect(baseURL + err.redirect);
            });
          } else {
            req.flash('warning', 'Recaptcha check failed...please try again.');
            res.redirect(baseURL + '/register');
          }
        } catch(e) {
          req.flash('warning', 'Recaptcha check failed...please try again.');
          res.redirect(baseURL + '/register');
        }
      });
    });
  } else {
    res.redirect(baseURL + '/index');
  }
});

/*
router.get('/twitterpromo', (req, res, next) => {
  if (req.session.user.tierID !== 1) return res.redirect(baseURL + '/');

  res.render('twitterpromo', _.merge(defaultVars, {title: 'Twitter Promo'}));
});

router.get('/twitterpromosuccess', (req, res, next) => {
  if (req.session.subscription.plan !== 10) return res.redirect(baseURL + '/');

  req.flash('info', `Your account was upgraded successfully to the Standard tier!`);
  res.redirect(baseURL + '/');
});

router.post('/twitterpromo', (req, res, next) => {
  let username = req.body.username;
  if (req.session.user.tierID !== 1) return res.redirect(baseURL + '/');

  async.series([
    cb => {
      // Make sure Twitter account hasn't been used with another account
      User.twitterUsed(username).then(used => {
        if (used) cb("already_used_twitter");
        else cb(null);
      });
    },

    cb => {
      // Make sure user's account is at least a day old
      request.get('https://api.twitter.com/1.1/users/lookup.json?screen_name=' + username, {
        'auth': {
          'bearer': settings.general.twitterPromoBearer
        }
      }, (err, resp, body) => {

        body = JSON.parse(body);

        // Account doesn't exist
        if (err || !Array.isArray(body) || body.length === 0) return cb("account_doesn't_exist");

        // 1 day
        let time = ~~((new Date().getTime() - new Date(body[0].created_at).getTime())/1000);
        if (time < 86400) cb("too_new");
        else cb(null);
      });
    },

    cb => {
      // Get tweets from user's timeline
      request.get('https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=' + username, {
        'auth': {
          'bearer': settings.general.twitterPromoBearer
        }
      }, (err, resp, body) => {
        let done = false;
        body = JSON.parse(body);
        let total = 0

        // No tweets or some other error
        if (err || !Array.isArray(body) || body.length === 0) return cb("no_tweets");

        body.forEach(tweet => {
          if (done) return;

          if (tweet.entities.urls.some(url => url.display_url === 'randomapi.com')) {
            let time = ~~((new Date().getTime() - new Date(tweet.created_at).getTime())/1000);

            // Make sure within an hour
            if (time < 3600) {
              done = true;

              User.update({twitterPromo: username}, req.session.user.username).then(() => {
                Subscription.update(req.session.user.id, {
                  plan: 10
                }).then(() => {
                  logger(`${req.session.user.username} just upgraded to the Standard tier via Twitter Promo!`);

                  return cb(null);
                });
              });
            }
          }

          total++;

          if (total === body.length && !done) {
            return cb("no_tweet_found");
          }
        });
      });
    }
  ],
  err => {
    switch(err) {
      case null:
        res.sendStatus(200);
        break;

      case "too_new":
      case "no_tweet_found":
      case "account_doesn't_exist":
      case "already_used_twitter":
      default:
        res.status(401).send(err);
        break;
    };
  });
});
*/

module.exports = router;

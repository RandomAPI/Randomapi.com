const express = require('express');
const _       = require('lodash');
const router  = express.Router();
const logger  = require('../utils').logger;
const stripe  = require('../utils').stripe;
const moment  = require('moment');

const User = require('../models/User');
const Plan = require('../models/Plan');
const Tier = require('../models/Tier');
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

router.post('/', (req, res, next) => {
  var stripeToken = req.body.stripeToken;

  stripe.customers.create({
    email: req.body.stripeEmail,
    source: stripeToken, // obtained with Stripe.js
  }, (err, customer) => {

    if (err) {
      req.flash('warning', err.toString());
      res.redirect(baseURL + '/upgrade');

    } else {
      Plan.getCond({name: req.body.plan, price: req.body.price}).then(plan => {
        if (plan === null) {
          req.flash('warning', 'There was a problem upgrading your account');
          res.redirect(baseURL + '/upgrade');
          return;
        }

        stripe.charges.create({
          amount: plan.price,
          currency: "usd",
          customer: customer.id,
          description:  req.body.plan
        }, (err, charge) => {

          Subscription.update(req.session.user.id, {
            cid: customer.id,
            email: customer.email,
            created: moment(customer.created*1000).format("YYYY-MM-DD HH:mm:ss"),
            plan: plan.id
          }).then(() => {

            Tier.getCond({id: plan.tier}).then(tier => {
              logger(`${req.session.user.username} just upgraded to the ${tier.name} tier!`);
              req.flash('info', `Your account was upgraded successfully to the ${tier.name} tier!`);
              res.redirect(baseURL + '/');
            });

          });

        });

      }, () => {

        req.flash('warning', 'There was a problem upgrading your account');
        res.redirect(baseURL + '/upgrade');
      });
    }
  });
});

router.post('/upgrade', (req, res, next) => {
  Plan.getCond({name: req.body.plan, price: req.body.price}).then(plan => {
    if (plan === null) {
      req.flash('warning', 'There was a problem upgrading your account');
      res.redirect(baseURL + '/upgrade');
      return;
    }
    stripe.customers.update(req.session.subscription.cid, { source: req.body.stripeToken }, (err, customer) => {
      stripe.charges.create({
        amount: plan.price,
        currency: "usd",
        customer: req.session.subscription.cid,
        description: req.body.plan,
      }, (err, charge) => {

        Subscription.update(req.session.user.id, {
          plan: plan.id
        }).then(() => {

          Tier.getCond({id: plan.tier}).then(tier => {
            logger(`${req.session.user.username} just upgraded to the ${tier.name} tier!`);
            req.flash('info', `Your account was upgraded successfully to the ${tier.name} tier!`);
            res.redirect(baseURL + '/');
          });
        });
      });
    });
  });
});

module.exports = router;

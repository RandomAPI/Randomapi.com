const express = require('express');
const _       = require('lodash');
const router  = express.Router();
const logger  = require('../utils').logger;
const stripe  = require('../utils').stripe;
const moment  = require('moment');

const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const Tier = require('../models/Tier');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', function(req, res, next) {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');
  next();
});

router.post('/', (req, res, next) => {
  // (Assuming you're using express - expressjs.com)
  // Get the credit card details submitted by the form
  var stripeToken = req.body.stripeToken;

  stripe.customers.create({
    source: stripeToken,
    plan: req.body.plan,
    email: req.body.stripeEmail
  }, function(err, customer) {
    // customer.id, customer.email, customer.created
    // customer.subscriptions.data[0].id, customer.subscriptions.data[0].id, customer.subscriptions.data[0].current_period_end
    // customer.subscriptions.data[0].plan.id, customer.subscriptions.data[0].plan.amount, customer.subscriptions.data[0].plan.name
    if (err) {
      req.flash('info', 'There was a problem upgrading your account');
      res.redirect(baseURL + '/');
    } else {
      Plan.getCond({name: req.body.plan,}).then(plan => {
        Subscription.upgrade({uid: req.session.user.id}, {
          cid: customer.id,
          sid: customer.subscriptions.data[0].id,
          email: customer.email,
          created: moment(customer.created*1000).format("YYYY-MM-DD HH:mm:ss"),
          current_period_end: moment(customer.subscriptions.data[0].current_period_end*1000).format("YYYY-MM-DD HH:mm:ss"),
          plan: plan.id
        }).then(() => {
          Tier.getCond({id: plan.tier}).then(tier => {
            req.flash('info', 'Your account was upgraded successfully to the ' + tier.name + " tier!");
            res.redirect(baseURL + '/');
          });
        });
      }, () => {
        req.flash('info', 'There was a problem upgrading your account');
        res.redirect(baseURL + '/');
      });
    }
  });
});

module.exports = router;

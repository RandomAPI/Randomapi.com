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
router.all('*', (req, res, next) => {
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
  }, (err, customer) => {

    if (err) {
      req.flash('warning', err.toString());
      res.redirect(baseURL + '/upgrade');

    } else {
      Plan.getCond({name: req.body.plan,}).then(plan => {

        Subscription.update(req.session.user.id, {
          cid: customer.id,
          sid: customer.subscriptions.data[0].id,
          email: customer.email,
          created: moment(customer.created*1000).format("YYYY-MM-DD HH:mm:ss"),
          current_period_end: moment(customer.subscriptions.data[0].current_period_end*1000).format("YYYY-MM-DD HH:mm:ss"),
          plan: plan.id
        }).then(() => {

          Tier.getCond({id: plan.tier}).then(tier => {
            req.flash('info', `Your account was upgraded successfully to the ${tier.name} tier!`);
            res.redirect(baseURL + '/');
          });
        });

      }, () => {
        req.flash('warning', 'There was a problem upgrading your account');
        res.redirect(baseURL + '/upgrade');
      });
    }
  });
});

// Update customer's credit card details
router.post('/updateCard', (req, res, next) => {
  stripe.customers.createSource(req.session.subscription.cid, {source: req.body.stripeToken}, (err, card) => {
    if (err) {
      req.flash('warning', err.toString());
      res.redirect(baseURL + '/settings/subscription');
    } else {
      stripe.customers.retrieve(req.session.subscription.cid, (err, customer) => {
        stripe.customers.deleteCard(req.session.subscription.cid, customer.default_source, (err, confirmation) => {
          stripe.customers.update(req.session.subscription.cid, {
            default_source: card.id
          }, (err, customer) => {
            if (err) {
              req.flash('warning', err);
              res.redirect(baseURL + '/settings/subscription');
            } else {
              req.flash('info', 'New card details added successfully!');
              res.redirect(baseURL + '/settings/subscription');
            }
          });
        });
      });
    }
  });
});

module.exports = router;

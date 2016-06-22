const express = require('express');
const _       = require('lodash');
const router  = express.Router();
const logger  = require('../utils').logger;

const User = require('../models/User');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', function(req, res, next) {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');
  next();
});

router.post('/', (req, res, next) => {
  var stripe = require("stripe")("sk_test_jP9dCoCOoCqECEISvkjUrrLK");

  // (Assuming you're using express - expressjs.com)
  // Get the credit card details submitted by the form
  var stripeToken = req.body.stripeToken;

  stripe.customers.create({
    source: stripeToken,
    plan: req.body.plan,
    email: req.body.stripeEmail
  }, function(err, customer) {
    console.log(err, customer);
    res.redirect(baseURL + "/");
  });
});

module.exports = router;

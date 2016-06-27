/*
  Run every day at midnight locally
  Check if a user's payment has gone through or not using Stripe's API and their cust/sub ids
  if not, update status to unpaid
  If a user's payment that was unpaid ends up going through, set status back to normal
*/
const db     = require('../models/db').connection;
const Subscription = require('../models/Subscription');
const stripe = require('../utils').stripe;

db.query("SELECT * FROM `subscription` WHERE `sid` IS NOT NULL", (err, results) => {
  results.forEach(result => {
    stripe.subscriptions.retrieve(
      result.sid,
      function(err, subscription) {
        console.log(subscription);
      }
    );
  });
});

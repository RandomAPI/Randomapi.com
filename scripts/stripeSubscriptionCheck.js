/*
  Run every day at midnight locally
  Check if a user's payment has gone through or not using Stripe's API and their cust/sub ids
  if not, update status to unpaid
  If a user's payment that was unpaid ends up going through, set status back to normal
*/
const db = require('../models/db').connection;
const Subscription = require('../models/Subscription');
const stripe = require('../utils').stripe;

let total = 0;
db.query("SELECT * FROM `subscription` WHERE `sid` IS NOT NULL", (err, results) => {
  results.forEach(result => {
    stripe.subscriptions.retrieve(result.sid, (err, subscription) => {
      if (subscription.status === "past_due") {
        Subscription.update(result.uid, {
          status: 3
        }).then(() => {
          if (++total === results.length) {
            process.exit();
          }
        });
      } else {
        if (++total === results.length) {
          process.exit();
        }
      }
    });
  });
});

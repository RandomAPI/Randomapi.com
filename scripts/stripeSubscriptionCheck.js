/*
  Run every day at midnight locally
  Check if a user's payment has gone through or not using Stripe's API and their cust/sub ids
  if not, update status to unpaid
  If a user's payment that was unpaid ends up going through, set status back to normal
*/
const moment = require('moment');
const db = require('../models/db').connection;
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Tier = require('../models/Tier');
const Plan = require('../models/Plan');
const stripe = require('../utils').stripe;

let total = 0;
db.query("SELECT * FROM `subscription` WHERE `sid` IS NOT NULL", (err, results) => {
  results.forEach(result => {
    stripe.subscriptions.retrieve(result.sid, (err, subscription) => {
      // If there is an error that says "No such subscription: sub_8ieq97sW75Wc4J",
      // that means that the user's subscription on Stripe's end has been deleted
      // at the end of their billing cycle. We need to set their subscription record
      // to an empty state now and also delete their customer object on Stripe
      if (err && err.toString().indexOf("No such subscription") !== -1) {
        Subscription.update(result.uid, {
          cid: null,
          sid: null,
          email: null,
          created: null,
          canceled: null,
          plan: 1,
          current_period_end: null,
          status: 1
        }).then(() => {

          // Delete customer from Stripe
          stripe.customers.del(result.cid, (err, confirmation) => {

            // Check if user has now gone over their account limit and soft lock them until
            // they delete lists/apis
            User.getCond({['u.id']: result.uid}).then(user => {
              Tier.getCond({id: 1}).then(tier => {

                if (user.apis > tier.apis || user.memory > tier.memory) {
                  Subscription.update(result.uid, {status: 4}).then(() => {
                    done(++total, results);
                  });
                } else {
                  done(++total, results);
                }
              });
            });
          });
        });
      } else if (subscription.status === "past_due") {
        Subscription.update(result.uid, {
          status: 3
        }).then(() => {
          done(++total, results);
        });
      } else {
        Subscription.update(result.uid, {
          current_period_end: moment(subscription.current_period_end*1000).format("YYYY-MM-DD HH:mm:ss")
        }).then(() => {
          done(++total, results);
        });
      }
    });
  });
  if (results.length === 0) {
    done(0, []);
  }
});

function done(total, results) {
  if (total === results.length) {
    process.exit();
  }
}


/* status
1: active
2: cancel at end of period
3: unpaid and locked
4: over limits for current tier so lock their account
*/

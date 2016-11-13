const express = require('express');
const async   = require('async');
const router  = express.Router();
const logger  = require('../utils').logger;
const redis   = require('../utils').redis;
const spawn   = require('child_process').spawn;
const User    = require('../models/User');
const API     = require('../models/API');
const Tier    = require('../models/Tier');
const Subscription = require('../models/Subscription');

router.get('/:ref?', (req, res, next) => {
  const Generators = req.app.get('Generators');
  let type, api, user, subscription, tier;

  async.series([
    // Check for hash
    cb => {
      if (req.params.ref !== undefined && req.params.ref.length === 32) {
        API.getCond({hash: req.params.ref}).then(result => {
          if (result === null) return cb({code: 404, error: "INVALID_API_HASH"});

          api = result;
          req.params.ref = api.ref;
          req.query.hideuserinfo = true;

          User.getCond({['u.id']: api.owner}).then(result => {
            user = result;
            req.query.key = user.apikey;
            cb(null);
          });
        });
      } else {
        cb(null);
      }
    },
    // Continue processing like normal
    cb => {
      if (req.query.key === undefined) {
        cb({code: 404, error: "MISSING_API_KEY"});

      } else if (req.query.ref === undefined && req.params.ref === undefined) {
        cb({code: 404, error: "MISSING_API_REF"});

      } else {
        cb(null);
      }
    },
    cb => {
      if (user === undefined) {
        User.getCond({apikey: req.query.key}).then(result => {
          if (result === null) return cb({code: 401, error: "INVALID_API_KEY"});

          user = result;
          cb(null);
        });
      } else {
        cb(null);
      }
    },
    cb => {
      Subscription.getCond({uid: user.id}).then(result => {
        if (result.status === 3) {
          return cb({code: 403, error: "SUBSCRIPTION_PAYMENT_OVERDUE"});
        } else if (result.status === 4) {
          return cb({code: 403, error: "ACCOUNT_SOFTLOCKED"});
        }

        subscription = result;
        cb(null);
      });
    },
    cb => {
      Tier.getCond({id: user.tierID}).then(result => {
        if (user.results >= result.results && result.results !== 0) {
          return cb({code: 403, error: "API_QUOTA_EXCEEDED"});
        }

        tier = result;
        cb(null);
      });
    },
    cb => {
      if (user.tierID === 1) {
        type = 'basic';
      } else if (user.tierID === 2) {
        type = 'standard';
      } else if (user.tierID === 3) {
        type = 'premium';
      }

      let shortest = Math.floor(Math.random() * Generators[type].length);
      for (let i = 0; i < Generators[type].length; i++) {
        if (Generators[type][i].queueLength() <= Generators[type][shortest].queueLength() && Generators[type][i].generator.connected) {
          shortest = i;
        }
      }

      // Make sure generator isn't offline
      if (!Generators[type][shortest].generator.connected) {
        cb({code: 500, error: "GENERATOR_OFFLINE"});
      } else {
        if (isNaN(req.query.results) || req.query.results < 0 || req.query.results === '' ||
           (typeof req.query.sole !== 'undefined' || typeof req.query.onlyone !== 'undefined')) req.query.results = 1;

        if (req.query.results > tier.per) {
          req.query.results = tier.per;
        }

        if (user.results+Number(req.query.results) >= tier.results && tier.results !== 0) {
          req.query.results = tier.results - user.results;
        }

        // Update User API calls and API lifetime calls
        User.incVal('results', req.query.results, user.username);
        User.incVal('lifetime', req.query.results, user.username);
        API.incVal('lifetime', req.query.results, req.params.ref);

        // Update User and API last call
        User.lastcall(user.id);
        API.lastcall(req.params.ref);

        // Finally, push task into queue
        Generators[type][shortest].queue.push({req, res});
      }
    }
  ], (err, results) => {
    if (err) {
      res.status(err.code).send({error: err.error});
    }
  });
});

module.exports = router;

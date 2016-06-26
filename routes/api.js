const express = require('express');
const router  = express.Router();
const logger  = require('../utils').logger;
const spawn   = require('child_process').spawn;
const User    = require('../models/User');
const Tier    = require('../models/Tier');

router.get('/:ref?', (req, res, next) => {
  const Generators = req.app.get('Generators');
  let type = Math.floor(Math.random() * 100);

  if (req.query.key === undefined) {
    return res.status(404).send({error: "MISSING_API_KEY"});
  } else if (req.query.ref === undefined && req.params.ref === undefined) {
    return res.status(404).send({error: "MISSING_API_REF"});
  }

  User.getCond({apikey: req.query.key}).then(user => {
    if (user === null) {
      return res.status(401).send({error: "INVALID_API_KEY"});
    }
    Tier.getCond({id: user.tierID}).then(tier => {
      if (user.results >= tier.results && tier.results !== 0) {
        return res.status(403).send({error: "API_QUOTA_EXCEEDED"});
      } else {

        if (user.tierID === 1) {
          type = 'basic';
        } else if (user.tierID === 2) {
          type = 'standard';
        } else if (user.tierID === 3) {
          type = 'premium';
        }

        let shortest = Math.floor(Math.random() * Generators[type].length);
        for (let i = 0; i < Generators[type].length; i++) {
          if (Generators[type][i].queueLength() < Generators[type][shortest].queueLength()) {
            shortest = i;
          }
        }

        // Make sure generator isn't offline
        if (!Generators[type][shortest].generator.connected) {
          res.send({error: "Something bad has happened...please try again later."});
        } else {
          if (isNaN(req.query.results) || req.query.results < 0 || req.query.results === '') req.query.results = 1;
          if (req.query.results > tier.per) {
            req.query.results = tier.per;
          }
          if (user.results+Number(req.query.results) >= tier.results && tier.results !== 0) {
            req.query.results = tier.results - user.results;
          }
          User.incVal('results', req.query.results, user.username);
          User.incVal('lifetime', req.query.results, user.username);
          Generators[type][shortest].queue.push({req, res});
        }
      }
    });
  });
});

module.exports = router;

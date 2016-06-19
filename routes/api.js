const express = require('express');
const router  = express.Router();
const logger  = require('../utils').logger;
const spawn   = require('child_process').spawn;
const User    = require('../models/User');

router.get('/:ref?', (req, res, next) => {
  const Generators = req.app.get('Generators');
  let type = Math.floor(Math.random() * 100);
  User.getCond({apikey: req.query.key}).then(user => {
    if (user.tier === 1) {
      type = 'basic';
    } else if (user.tier === 2) {
      type = 'standard';
    } else if (user.tier === 3) {
      type = 'premium';
    }

    let shortest = Math.floor(Math.random() * Generators[type].length);
    for (let i = 0; i < Generators[type].length; i++) {
      if (Generators[type][i].queueLength() < Generators[type][shortest].queueLength()) {
        shortest = i;
      }
    }

    Generators[type][shortest].queue.push({req, res});
  });
});

module.exports = router;

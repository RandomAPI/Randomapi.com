const express = require('express');
const router  = express.Router();
const logger  = require('../utils').logger;
const spawn   = require('child_process').spawn;

router.get('/:ref?', (req, res, next) => {
  const Generators = req.app.get('Generators');
  let type = Math.floor(Math.random() * 100);

  if (type < 33) {
    type = 'premium';
  } else if (type < 66) {
    type = 'standard';
  } else {
    type = 'basic';
  }

  let shortest = Math.floor(Math.random() * Generators[type].length);
  for (let i = 0; i < Generators[type].length; i++) {
    if (Generators[type][i].queueLength() < Generators[type][shortest].queueLength()) {
      shortest = i;
    }
  }

  Generators[type][shortest].queue.push({req, res});
});

module.exports = router;

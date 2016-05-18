var express = require('express');
var spawn   = require('child_process').spawn;
var router  = express.Router();

router.get('/:ref?', function(req, res, next) {
  var type = Math.floor(Math.random() * 100);

  if (type < 20) {
    type = "premium";
  } else if (type < 50) {
    type = "standard";
  } else {
    type = "basic";
  }

  var shortest = Math.floor(Math.random() * Generators[type].length);
  for (var i = 0; i < Generators[type].length; i++) {
    if (Generators[type][i].queueLength() < Generators[type][shortest].queueLength()) {
      shortest = i;
    }

    //log.log(`Generator ${i} is ${Generators.basic[i].queueLength()} items long`);
  }

  Generators[type][shortest].queue.push({req, res});

});

module.exports = router;
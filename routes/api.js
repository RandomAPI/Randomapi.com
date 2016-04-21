var express  = require('express');
var fs       = require('fs');
var router   = express.Router();
var settings = require('../settings.json');
var User     = require('../models/User.js');
var API      = require('../models/API.js');

var SandCastle = require('sandcastle').SandCastle;

var sandcastle = new SandCastle({
  api: './availableFuncs.js',
  timeout: 3000
});

router.get('/:ref', function(req, res, next) {
  API.getAPIByRef(req.params.ref, function(err, doc) {
    if (err) {
      res.send("EPIC FAILURE!");
    } else {

      // Search up api with ref
      var src = fs.readFileSync('./data/apis/' + doc.id + '.api'); // Read api src into this...
      var script = sandcastle.createScript("\
        exports.main = function() {\
          var output = '';\
          var api = {};\
          exit((function() {\
            var results = [];\
            for (var i = 0; i < 25; i++) {\
              var current = {};\
              " + src + "\
              results.push(current);\
              api = results;\
            }\
            return api;\
          })());\
        }\
      ");

      script.on('exit', function(err, output) {
        if (err) console.log(err);
        res.send(output);
      });

      script.on('timeout', function() {
        res.send("script timed out");
      });

      script.run();// we can pass variables into run.
    }
  });
});

module.exports = router;

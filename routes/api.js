var express  = require('express');
var fs       = require('fs');
var router   = express.Router();
var settings = require('../settings.json');
var User     = require('../models/User.js');
var API      = require('../models/API.js');

var SandCastle = require('sandcastle').SandCastle;

var sandcastle = new SandCastle({
  api: './availableFuncs.js',
  timeout: 10000
});

router.get('/:ref', function(req, res, next) {
  var results = req.query.results || 1;
  API.getAPIByRef(req.params.ref, function(err, doc) {
    if (err) {
      res.send("EPIC FAILURE!");
    } else {

      // Search up api with ref
      var src = fs.readFileSync('./data/apis/' + doc.id + '.api'); // Read api src into this...
      var script = sandcastle.createScript("\
        exports.main = function() {\
          exit((function() {\
            var _APIgetVars = " + JSON.stringify(req.query) + ";\
            var _APIresults = [];\
            for (var _APIi = 0; _APIi < " + results + "; _APIi++) {\
              var api = {};\
              " + src + "\
              _APIresults.push(api);\
            }\
            return _APIresults;\
            function getVar(key) {\
              return key in _APIgetVars ? APIgetVars[key] : null;\
            }\
          })());\
        }\
      ");

      script.on('exit', function(err, output) {
        if (err) {
          if (err.stack !== undefined) {
            res.send("<pre>Error: " + err.message + " on line " + err.stack.split('\n')[1].match(/.*?:(\d+)/)[1] + " column " + err.stack.split('\n')[1].match(/.*:(\d+)/)[1]);
          } else {
            res.send("<pre>Error: " + err.message);
          }
        } else {
          res.send(output);
        }
      });

      script.on('timeout', function() {
        res.send("script timed out");
      });

      script.run();// we can pass variables into run.
    }
  });
});

module.exports = router;

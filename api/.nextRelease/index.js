var results  = req.query.results || 1;
var doc      = API.getAPIByRef(req.params.ref);
var keyOwner = User.getByID(doc.owner);

if (!doc || keyOwner.key !== req.query.key) {
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
          return key in _APIgetVars ? _APIgetVars[key] : undefined;\
        }\
      })());\
    }\
  ");

  script.on('exit', function(err, output) {
    if (err) {
      res.send("<pre>Error: " + err.message);
    } else {
      res.send(output);
    }
  });

  script.on('timeout', function() {
    res.send("script timed out");
  });

  script.run();// we can pass variables into run.
}
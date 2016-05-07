var express   = require('express');
var router    = express.Router();

router.get('/:ref', function(req, res, next) {
  _.merge(req.query, {ref: req.params.ref});
  var version = Generator.getByID(API.getAPIByRef(req.params.ref).generator).version;
  new Generators[version](req.query).generate(function(data, fmt) {
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  });
});

module.exports = router;

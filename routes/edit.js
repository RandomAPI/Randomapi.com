var express  = require('express');
var fs       = require('fs');
var router   = express.Router();

// api //
router.get('/api/:ref', function(req, res, next) {
  if (req.session.loggedin) {
    var doc = API.getAPIByRef(req.params.ref);
    doc.code = fs.readFileSync('./data/apis/' + doc.id + '.api'); // Read api src into this...
    res.render('edit/api', _.merge(defaultVars, {api: doc, socket: ':' + settings.general.socket}));
  } else {
    res.render('index', defaultVars);
  }
});

router.post('/api/:ref', function(req, res, next) {
  if (req.session.loggedin) {
    var doc = API.getAPIByRef(req.params.ref);
    if (doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/view/api');
    } else {
      fs.writeFile('./data/apis/' + doc.id + '.api', req.body.code.replace(/\r\n/g, '\n'), 'utf8', function(err) {
        req.flash('info', 'API ' + doc.name + ' was updated successfully!');
        res.send(baseURL + '/view/api');
      });
    }
  }
});

// list //
router.get('/list/:ref', function(req, res, next) {
  if (req.session.loggedin) {
    var doc = List.getListByRef(req.params.ref);
    res.render('edit/list', _.merge(defaultVars, {list: doc}));
  } else {
    res.render('index', defaultVars);
  }
});

module.exports = router;

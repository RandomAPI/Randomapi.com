var express  = require('express');
var fs       = require('fs');
var router   = express.Router();
var settings = require('../settings.json');
var User     = require('../models/User.js');
var List     = require('../models/List.js');
var API      = require('../models/API.js');

// api //
router.get('/api/:ref', function(req, res, next) {
  if (req.session.loggedin) {
    API.getAPIByRef(req.params.ref, function(err, doc) {
      doc.code = fs.readFileSync('./data/apis/' + doc.id + '.api'); // Read api src into this...
      if (err) console.log(err);
      res.render('edit/api', { messages: req.flash('info'), session: req.session, api: doc });
    });
  } else {
    res.render('index', { messages: req.flash('info'), session: req.session });
  }
});

router.post('/api/:ref', function(req, res, next) {
  if (req.session.loggedin) {
    API.getAPIByRef(req.params.ref, function(err, doc) {
      if (err || doc.owner !== req.session.user.id) {
        res.redirect(baseURL + '/view/api');
      } else {
        fs.writeFile('./data/apis/' + doc.id + '.api', req.body.code.replace(/\r\n/g, '\n'), 'utf8', function(err) {
          if (err) console.log(err);
          req.flash('info', "API " + doc.name + " was updated successfully!");
          res.send(baseURL + '/view/api');
        });
      }
    });
  }
});


// list //
router.get('/list/:ref', function(req, res, next) {
  if (req.session.loggedin) {
    List.getListByRef(req.params.ref, function(err, doc) {
      if (err) console.log(err);
      res.render('edit/list', { messages: req.flash('info'), session: req.session, list: doc });
    });
  } else {
    res.render('index', { messages: req.flash('info'), session: req.session });
  }
});

module.exports = router;

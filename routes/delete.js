var express  = require('express');
var fs       = require('fs');
var router   = express.Router();
var settings = require('../settings.json');
var User     = require('../models/User.js');
var List     = require('../models/List.js');
var API      = require('../models/API.js');

// api //
router.get('/api/:id', function(req, res, next) {
  if (req.session.loggedin) {
    API.getAPI(req.params.id, function(err, doc) {
      if (err || doc.owner !== req.session.user.id) {
        console.log(err);
        res.redirect(baseURL + '/view/api');
      } else {
        API.remove({id: req.params.id}, function(err) {
          fs.unlink('./data/apis/' + req.params.id + '.api', function(err) {
            if (err) console.log(err);
            req.flash('info', "API " + doc.name + " was deleted successfully!");
            res.redirect(baseURL + '/view/api');
          });
        });
      }
    });
  } else {
    res.redirect(baseURL + '/view/api');
  }
});

// list //
router.get('/list/:id', function(req, res, next) {
  if (req.session.loggedin) {
    List.getList(req.params.id, function(err, doc) {
      if (err || doc.owner !== req.session.user.id) {
        console.log(err);
        res.redirect(baseURL + '/view/list');
      } else {
        List.remove({id: req.params.id}, function(err) {
          fs.unlink('./data/lists/' + req.params.id + '.list', function(err) {
            if (err) console.log(err);
            req.flash('info', "List " + doc.name + " was deleted successfully!");
            res.redirect(baseURL + '/view/list');
          });
        });
      }
    });
  } else {
    res.redirect(baseURL + '/view/list');
  }
});

module.exports = router;

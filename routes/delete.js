var express  = require('express');
var fs       = require('fs');
var router   = express.Router();

// api //
router.get('/api/:id', function(req, res, next) {
  if (req.session.loggedin) {
    var doc = API.getAPI(req.params.id);
    if (doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/view/api');
    } else {
      API.remove({id: req.params.id}, function(err) {
        fs.unlink('./data/apis/' + req.params.id + '.api', function(err) {
          req.flash('info', 'API ' + doc.name + ' was deleted successfully!');
          res.redirect(baseURL + '/view/api');
        });
      });
    }
  } else {
    res.redirect(baseURL + '/view/api');
  }
});

// list //
router.get('/list/:id', function(req, res, next) {
  if (req.session.loggedin) {
    var doc = List.getList(req.params.id)
    if (doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/view/list');
    } else {
      List.remove({id: req.params.id}, function(err) {
        fs.unlink('./data/lists/' + req.params.id + '.list', function(err) {
          req.flash('info', 'List ' + doc.name + ' was deleted successfully!');
          res.redirect(baseURL + '/view/list');
        });
      });
    }
  } else {
    res.redirect(baseURL + '/view/list');
  }
});

module.exports = router;

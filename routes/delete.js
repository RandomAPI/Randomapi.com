const express  = require('express');
const fs       = require('fs');
const router   = express.Router();

const API = require('../models/API');
const List = require('../models/List');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', function(req, res, next) {
  defaultVars = req.app.get('defaultVars');
  baseURL = req.app.get('baseURL');
  next();
});

router.get('/api/:id', (req, res, next) => {
  if (req.session.loggedin) {
    let doc = API.getAPI(req.params.id);
    if (doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/view/api');
    } else {
      API.remove({id: req.params.id}, err => {
        fs.unlink('./data/apis/' + req.params.id + '.api', err => {
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
router.get('/list/:id', (req, res, next) => {
  if (req.session.loggedin) {
    let doc = List.getList(req.params.id)
    if (doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/view/list');
    } else {
      List.remove({id: req.params.id}, err => {
        fs.unlink('./data/lists/' + req.params.id + '.list', err => {
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

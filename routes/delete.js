const express  = require('express');
const fs       = require('fs');
const router   = express.Router();

const API = require('../models/API');
const List = require('../models/List');
const User = require('../models/User');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', (req, res, next) => {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');
  next();
});

router.get('/api/:ref', (req, res, next) => {
  if (req.session.loggedin) {
    API.getCond({ref: req.params.ref}).then(doc => {
      if (doc === null || doc.owner !== req.session.user.id) {
        res.redirect(baseURL + '/view/api');
      } else {
        API.remove({id: doc.id}).then(() => {
          fs.unlink('./data/apis/' + doc.id + '.api', err => {
            User.decVal('apis', 1, req.session.user.username).then(() => {
              req.flash('info', `API ${doc.name} was deleted successfully!`);
              res.redirect(baseURL + '/view/api');
            });
          });
        });
      }
    });
  } else {
    res.redirect(baseURL + '/view/api');
  }
});

// list //
router.get('/list/:ref', (req, res, next) => {
  if (req.session.loggedin) {
    List.getCond({ref: req.params.ref}).then(doc => {
      if (doc === null || doc.owner !== req.session.user.id) {
        res.redirect(baseURL + '/view/list');
      } else {
        List.remove({id: doc.id}).then(() => {
          fs.unlink('./data/lists/' + doc.id + '.list', err => {
            User.decVal('memory', doc.memory, req.session.user.username).then(() => {
              req.flash('info', `List ${doc.name} was deleted successfully!`);
              res.redirect(baseURL + '/view/list');
            });
          });
        });
      }
    });
  } else {
    res.redirect(baseURL + '/view/list');
  }
});

module.exports = router;

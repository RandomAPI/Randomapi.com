const express  = require('express');
const _        = require('lodash');
const router   = express.Router();

const API = require('../models/API');
const List = require('../models/List');
const Generator = require('../models/Generator');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', (req, res, next) => {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');
  next();
});

router.get('/api', (req, res, next) => {
  if (req.session.loggedin) {
    let obs = [];
    API.getAPIs(req.session.user.id).then(apis => {
      res.render('view/api', _.merge(defaultVars, {apis, title: 'View APIs'}));
    });
  } else {
    res.redirect(baseURL + '/');
  }
});


// list //
router.get('/list', (req, res, next) => {
  if (req.session.loggedin) {
    List.getLists(req.session.user.id).then(lists => {
      res.render('view/list', _.merge(defaultVars, {lists, title: 'View APIs'}));
    });
  } else {
    res.redirect(baseURL + '/');
  }
});

module.exports = router;

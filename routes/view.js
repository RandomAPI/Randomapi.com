const express  = require('express');
const _        = require('lodash');
const router   = express.Router();

const API = require('../models/API');
const List = require('../models/List');
const Generator = require('../models/Generator');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', function(req, res, next) {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');
  next();
});

router.get('/api', (req, res, next) => {
  if (req.session.loggedin) {
    let obs = [];
    API.getAPIs(req.session.user.id).then(apis => {
      res.render('view/api', _.merge(defaultVars, {apis}));
    });
  } else {
    res.render('index', defaultVars);
  }
});


// list //
router.get('/list', (req, res, next) => {
  if (req.session.loggedin) {
    List.getLists(req.session.user.id).then(lists => {
      res.render('view/list', _.merge(defaultVars, {lists}));
    });
  } else {
    res.render('index', defaultVars);
  }
});

module.exports = router;

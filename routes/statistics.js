const express  = require('express');
const router   = express.Router();
const settings = require('../utils').settings;
const _        = require('lodash');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', (req, res, next) => {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');
  next();
});

router.get('/', (req, res, next) => {
  res.render('statistics', _.merge(defaultVars, {title: 'RandomAPI Statistics'}));
});

module.exports = router;

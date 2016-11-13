const express  = require('express');
const _        = require('lodash');
const router   = express.Router();
const logger   = require('../utils').logger;
const settings = require('../utils').settings;

const Snippet = require('../models/Snippet');
const Version = require('../models/Version');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', (req, res, next) => {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');
  next();
});

router.get('/snippetLookup/:ref?/:version?', (req, res, next) => {
  let ref     = req.params.ref;
  let version = req.params.version;

  Version.getVersion(ref, version).then(ver => {
    if (ver === null || ver.published === 0) {
      return res.redirect(baseURL + '/');
    }

    res.send(ver);
  });
});

module.exports = router;

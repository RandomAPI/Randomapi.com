const express = require('express');
const _       = require('lodash');
const async   = require('async');
const router  = express.Router();

const API       = require('../models/API');
const List      = require('../models/List');
const Snippet   = require('../models/Snippet');
const Version   = require('../models/Version');
const Generator = require('../models/Generator');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', (req, res, next) => {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');

  if (!req.session.loggedin) {
    res.redirect(baseURL + '/');
  } else {
    next();
  }
});

router.get('/api', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    API.getAPIs(req.session.user.id).then(apis => {
      res.render('view/api', _.merge(defaultVars, {apis, title: 'View APIs'}));
    });
  } else {
    if (req.session.subscription.status === 3) {
      res.redirect(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.redirect(baseURL + '/');
    }
  }
});


// list //
router.get('/list', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    List.getLists(req.session.user.id).then(lists => {
      res.render('view/list', _.merge(defaultVars, {lists, title: 'View Lists'}));
    });
  } else {
    if (req.session.subscription.status === 3) {
      res.redirect(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.redirect(baseURL + '/');
    }
  }
});

// snippet //
router.get('/snippet', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    Snippet.getPrivateSnippets(req.session.user.id).then(privateSnippets => {
      Snippet.getPublicSnippets(req.session.user.id).then(publicSnippets => {
        async.eachOf(publicSnippets, (snippet, index, cb) => {
          Version.getVersion(snippet.ref, snippet.version).then(ver => {
            publicSnippets[index].latestPublished = ver.published;
            cb();
          });
        }, () => {
          res.render('view/snippet', _.merge(defaultVars, {privateSnippets, publicSnippets, title: 'View Snippets'}));
        });
      });
    });
  } else {
    if (req.session.subscription.status === 3) {
      res.redirect(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.redirect(baseURL + '/');
    }
  }
});

module.exports = router;

const express  = require('express');
const _        = require('lodash');
const moment   = require('moment');
const fs       = require('fs');
const router   = express.Router();
const settings = require('../settings.json');
const logger   = require('../utils').logger;
const missingProps = require('../utils').missingProps;

const API     = require('../models/API');
const User    = require('../models/User');
const List    = require('../models/List');
const Snippet = require('../models/Snippet');
const Version = require('../models/Version');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', (req, res, next) => {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');

  if (!req.session.loggedin) {
    res.redirect(baseURL + '/');

  } else if (req.session.subscription.status === 3) {
    res.redirect(baseURL + '/settings/subscription/paymentOverdue');

  } else if (req.session.subscription.status === 4) {
    req.flash('warning', 'Your account is currently soft-locked until you fix your account quotas.');
    res.redirect(baseURL + '/');

  } else {
    next();
  }
});

router.get('/snippet/:ref?', (req, res, next) => {
  let ref = req.params.ref;

  if (ref === undefined) {
    res.redirect(baseURL + '/view/snippet');
    return;
  }

  Snippet.getCond({ref}).then(snippet => {
    if (snippet === null || snippet.owner !== req.session.user.id) {
      return res.redirect(baseURL + '/view/snippet');
    }

    res.render('publish/snippet', _.merge(defaultVars, {snippet, title: `Publish Snippet ${snippet.name}`}));
  });
});

router.get('/snippet/:ref?/confirm', (req, res, next) => {
  let ref = req.params.ref;

  if (ref === undefined) {
    return res.redirect(baseURL + '/view/snippet');
  }

  Snippet.getCond({ref}).then(snippet => {
    if (snippet === null || snippet.owner !== req.session.user.id) {
      return res.redirect(baseURL + '/view/snippet');
    }

    // First time publishing
    if (snippet.published === 0 ) {

      Snippet.update({published: 1}, snippet.id)
      .then(Version.getVersion(ref, 1)
        .then(ver => {
          Version.update({published: 1, created: moment(new Date()).format("YYYY-MM-DD HH:mm:ss")}, ver.id);
        })
      )
      .then(User.decVal('snippets', 1, req.session.user.username))
      .then(() => {
        req.app.get('removeSnippet')(`${req.session.user.username}/${snippet.name}/${snippet.version}`); // broken
        req.app.get('removeSnippet')(`${req.session.user.username}/${snippet.name}`);
        req.flash('info', `Snippet ${snippet.name} was published successfully!`);
        res.send(baseURL + '/view/snippet/#publish');
      });

    // Publishing latest version
    } else {
      Snippet.modified(snippet.id).then(() => {
        Version.getCond({snippetID: snippet.id}).then(ver => {
          Version.update({published: 1, created: moment(new Date()).format("YYYY-MM-DD HH:mm:ss")}, ver.id).then(() => {
            req.app.get('removeSnippet')(`${req.session.user.username}/${snippet.name}/${snippet.version}`); // broken
            req.app.get('removeSnippet')(`${req.session.user.username}/${snippet.name}`);
            req.flash('info', `Revision ${ver.version} for Snippet ${snippet.name} was published successfully!`);
            res.send(baseURL + '/view/snippet/#publish');
          });
        });
      });
    }
  });
});

module.exports = router;

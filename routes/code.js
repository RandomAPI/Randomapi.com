const express  = require('express');
const _        = require('lodash');
const fs       = require('fs');
const router   = express.Router();
const settings = require('../settings.json');
const logger   = require('../utils').logger;
const missingProps = require('../utils').missingProps;
const multer   = require('multer');
const crypto   = require('crypto');
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, './uploads/')
  },
  filename(req, file, cb) {
    crypto.pseudoRandomBytes(16, (err, raw) => {
      cb(null, raw.toString('hex') + Date.now());
    });
  }
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5*1024*1024
  }
}).single('file');

const API  = require('../models/API');
const User  = require('../models/User');
const List = require('../models/List');
const Snippet = require('../models/Snippet');

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

router.get('/api/:ref?', (req, res, next) => {
  API.getCond({ref: req.params.ref}).then(doc => {
    if (doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/view/api');
    } else {
      doc.code = fs.readFileSync('./data/apis/' + doc.id + '.api'); // Read api src into this...
      res.render('code/api', _.merge(defaultVars, {api: doc, socket: ':' + settings.general.socket, title: `Coding API ${doc.name} [${doc.ref}]`}));
    }
  }).catch(err => {
    res.redirect(baseURL + '/view/api');
  });
});

router.post('/api/:ref', (req, res, next) => {
  if (missingProps(req.body, ['code'])) {
    req.flash('warning', 'Missing expected form properties');
    res.send(baseURL + '/code/api/' + req.params.ref);
    return;
  }

  API.getCond({ref: req.params.ref}).then(doc => {
    if (doc.owner !== req.session.user.id) {
      res.send(baseURL + '/view/api');
    } else {
      API.modified(doc.ref).then(() => {
        fs.writeFile('./data/apis/' + doc.id + '.api', req.body.code.replace(/\r\n/g, '\n').slice(0, 8192), 'utf8', err => {
          req.flash('info', `API ${doc.name} [${doc.ref}] was updated successfully!`);
          res.send(baseURL + '/view/api');
        });
      });
    }
  });
});

// Snippets
router.get('/snippet/:ref?', (req, res, next) => {
  Snippet.getCond({ref: req.params.ref}).then(doc => {
    if (doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/view/snippet');
    } else {
      doc.code = fs.readFileSync('./data/snippets/' + doc.id + '.snippet'); // Read snippet src into this...
      res.render('code/snippet', _.merge(defaultVars, {snippet: doc, socket: ':' + settings.general.socket, title: `Coding Snippet ${doc.name}`}));
    }
  }).catch(err => {
    res.redirect(baseURL + '/view/snippet');
  });
});

router.post('/snippet/:ref', (req, res, next) => {
  if (missingProps(req.body, ['code'])) {
    req.flash('warning', 'Missing expected form properties');
    res.send(baseURL + '/code/snippet/' + req.params.ref);
    return;
  }
  Snippet.getCond({ref: req.params.ref}).then(doc => {
    if (doc.owner !== req.session.user.id) {
      res.send(baseURL + '/view/snippet');
    } else {
      Snippet.modified(doc.ref).then(() => {
        fs.writeFile('./data/snippets/' + doc.id + '.snippet', req.body.code.replace(/\r\n/g, '\n').slice(0, 8192), 'utf8', err => {
          req.app.get('removeSnippet')(`${req.session.user.username}/${doc.name}`);
          req.flash('info', `Snippet ${doc.name} was updated successfully!`);
          res.send(baseURL + '/view/snippet');
        });
      });
    }
  });
});

module.exports = router;

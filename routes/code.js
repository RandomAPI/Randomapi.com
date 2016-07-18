const express  = require('express');
const _        = require('lodash');
const fs       = require('fs-extra');
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
const User = require('../models/User');
const List = require('../models/List');
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
router.get('/snippet/:ref?/:version?', (req, res, next) => {
  let ref     = req.params.ref;
  let version = req.params.version;

  if (ref === undefined || version === undefined) {
    req.flash('warning', `Missing ref and/or version number`);
    res.redirect(baseURL + '/view/snippet');
    return;
  }

  Snippet.getCond({ref}).then(doc => {

    // Create new revision
    if (version === "newRevision") {

      // Get current version
      Version.getCond({snippetID: doc.id})
      .then(ver => {
        if (ver.published === 0) {
          req.flash('warning', 'You already have a revision in progress that hasn\'t been published yet');
          res.redirect(baseURL + '/view/snippet#publish');
          return;
        }

        // Copy contents of current version to new version
        fs.copy(
          `./data/snippets/${doc.id}-${ver.version}.snippet`,
          `./data/snippets/${doc.id}-${ver.version+1}.snippet`,
        () => {
          // Create new revision
          Version.newRevision(doc.id)
          .then(id => {
            req.flash('info', `Revision ${ver.version+1} for Snippet ${doc.name} has been created successfully!`);
            res.redirect(`${baseURL}/code/snippet/${doc.ref}/${ver.version+1}`);
          });
        });
      });
      return;
    }

    // Get specific version
    Version.getVersion(ref, version).then(ver => {
      if (ver === null || doc.owner !== req.session.user.id) {
        res.redirect(baseURL + '/view/snippet');
      } else {
        doc.code = fs.readFileSync(`./data/snippets/${doc.id}-${ver.version}.snippet`); // Read snippet src into this...
        res.render('code/snippet', _.merge(defaultVars, {snippet: doc, version: ver, socket: ':' + settings.general.socket, title: `Coding Snippet ${doc.name}`}));
      }
    }).catch(err => {
      res.redirect(baseURL + '/view/snippet');
    });
  }).catch(err => {
    res.redirect(baseURL + '/view/snippet');
  });
});

router.post('/snippet/:ref?/:version?', (req, res, next) => {
  let ref     = req.params.ref;
  let version = req.params.version;

  if (ref === undefined || version === undefined) {
    req.flash('warning', `Missing ref and/or version number`);
    res.send(`${baseURL}/code/snippet/${req.params.ref}/${req.params.version}`);
    return;
  }

  if (missingProps(req.body, ['code'])) {
    req.flash('warning', 'Missing expected form properties');
    res.send(`${baseURL}/code/snippet/${req.params.ref}/${req.params.version}`);
    return;
  }

  Snippet.getCond({ref}).then(doc => {
    if (doc.owner !== req.session.user.id) {
      res.send(baseURL + '/view/snippet');
      return;
    }

    Version.getVersion(ref, version).then(ver => {
      if (ver === null || ver.published === 1) {
        res.send(baseURL + '/view/snippet');
        return;
      }

      Snippet.modified(doc.id)
      .then(() => {

        Version.modified(ver.id)
        .then(() => {

          fs.writeFile(`./data/snippets/${doc.id}-${version}.snippet`, req.body.code.replace(/\r\n/g, '\n').slice(0, 8192), 'utf8', err => {
            req.app.get('removeSnippet')(`${req.session.user.username}/${doc.name}/${ver.version}`);
            req.app.get('removeSnippet')(`${req.session.user.username}/${doc.name}`);
            req.flash('info', `Snippet ${doc.name} was updated successfully!`);
            if (ver.version > 1) {
              res.send(baseURL + '/view/snippet#publish');
            } else {
              res.send(baseURL + '/view/snippet');
            }
          });
        });
      });
    })
  });
});

module.exports = router;

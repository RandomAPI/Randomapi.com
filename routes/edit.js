const express  = require('express');
const _        = require('lodash');
const fs       = require('fs');
const router   = express.Router();
const settings = require('../settings.json');
const logger   = require('../utils').logger;
const multer   = require('multer');
const crypto   = require('crypto');
const missingProps = require('../utils').missingProps;

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

router.get('/api/:ref?', (req, res, next) => {
  API.getCond({ref: req.params.ref}).then(doc => {
    if (doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/view/api');
    } else {
      doc.code = fs.readFileSync('./data/apis/' + doc.id + '.api'); // Read api src into this...
      res.render('edit/api', _.merge(defaultVars, {api: doc, title: `Edit API ${doc.name} [${doc.ref}]`}));
    }
  }, () => {
    res.redirect(baseURL + '/view/api');
  });
});

router.post('/api/:ref', (req, res, next) => {
  if (missingProps(req.body, ['rename'])) {
    req.flash('warning', 'Missing expected form properties');
    res.redirect(baseURL + '/edit/api/' + req.params.ref);
    return;
  }

  API.getCond({ref: req.params.ref}).then(doc => {
    if (doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/view/api');
    } else {
      let name = req.body.rename;
      if (name === undefined || name === "") name = doc.name;
      if (name.match(/^[A-z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/) === null) {
        req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
        res.redirect(baseURL + '/edit/api/' + req.params.ref);
      } else {
        API.update({name}, doc.ref).then(() => {
          req.flash('info', `API ${name} [${doc.ref}] was updated successfully!`);
          res.redirect(baseURL + '/view/api');
        });
      }
    }
  });
});

// list //
router.get('/list/:ref', (req, res, next) => {
  List.getCond({ref: req.params.ref}).then(doc => {
    res.render('edit/list', _.merge(defaultVars, {list: doc, title: `Editing list ${doc.name} [${doc.ref}]`}));
  });
});

router.post('/list/:ref', (req, res, next) => {
  List.getCond({ref: req.params.ref}).then(doc => {
    upload(req, res, err => {
      if (missingProps(req.body, ['rename'])) {
        req.flash('warning', 'Missing expected form properties');
        res.redirect(baseURL + '/edit/list/' + req.params.ref);
        if (req.file !== undefined) {
          fs.unlink('./'+ req.file.path);
        }
        return;
      } else if (err) {
        req.flash('warning', 'This list is too big. Please keep your file size under 5MB.');
        res.redirect(baseURL + '/edit/list/' + req.params.ref);

      } else if (doc.owner !== req.session.user.id) {
        res.redirect(baseURL + '/view/list');

      } else if (req.file !== undefined && req.file.originalname.match(/(?:\.([^.]+))?$/)[1] !== 'txt') {
        req.flash('warning', 'Looks like you provided an invalid file...please try again.');
        if (req.file !== undefined) {
          fs.unlink('./'+ req.file.path);
        }
        res.redirect(baseURL + '/edit/list/' + req.params.ref);

      // Is user within their tier limits?
      } else if (req.file !== undefined && req.session.user.memory - doc.memory + req.file.size > req.session.tier.memory && req.session.tier.memory !== 0) {
        req.flash('warning', 'Replacing this list would go over your List quota for the ' + req.session.tier.name + ' tier.');
        fs.unlink('./'+ req.file.path);
        res.redirect(baseURL + '/edit/list/' + req.params.ref);

      } else {
        let name = req.body.rename;
        if (name === undefined || name === "") name = doc.name;
        if (name.match(/^[A-z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/) === null) {
          req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
          res.redirect(baseURL + '/view/api/' + req.params.ref);
        } else if (req.file === undefined) {
          List.update({name}, doc.ref).then(() => {
            req.flash('info', `List ${name} [${doc.ref}] was updated successfully!`);
            res.redirect(baseURL + '/view/list');
          });
        } else {
          List.update({name, memory: req.file.size}, doc.ref).then(() => {
            fs.rename('./'+ req.file.path, './data/lists/' + doc.id + '.list', err => {
              let newSize = req.file.size;
              let oldSize = doc.memory;

              User.incVal('memory', newSize-oldSize, req.session.user.username).then(() => {
                req.app.get('removeList')(`${doc.ref}`);
                req.flash('info', `List ${name} [${doc.ref}] was updated successfully!`);
                res.redirect(baseURL + '/view/list');
              });
            });
          });
        }
      }
    })
  });
});

// Snippets
router.get('/snippet/:ref?/:version?', (req, res, next) => {
  let ref     = req.params.ref;
  let version = req.params.version;

  if (ref === undefined) {
    req.flash('warning', `Missing ref`);
    res.redirect(baseURL + '/view/snippet');
    return;
  }

  Snippet.getCond({ref}).then(doc => {
    if (doc === null) {
      res.redirect(baseURL + '/view/snippet');
      return;
    }

    Snippet.getTags(doc.id).then(tags => {
      if (doc.owner !== req.session.user.id) {
        res.redirect(baseURL + '/view/snippet');
      } else {
        if (version !== undefined) {
          Version.getVersion(ref, version).then(ver => {
            if (ver === null) {
              res.redirect(baseURL + '/view/snippet');
            }
            doc.description = ver.description; // Replace snippet description with revision's description
            res.render('edit/snippet', _.merge(defaultVars, {snippet: doc, version: _.merge(ver, {revision: true}), tags, socket: ':' + settings.general.socket, title: `Edit Snippet ${doc.name}`}));
          });
        } else {
          res.render('edit/snippet', _.merge(defaultVars, {snippet: doc, version: {version: 1, revision: false}, tags, socket: ':' + settings.general.socket, title: `Edit Snippet ${doc.name}`}));
        }
      }
    });
  });
});

router.post('/snippet/:ref?/:version?', (req, res, next) => {
  let ref         = req.params.ref;
  let version     = req.params.version;
  let versionFmt;
  if (version !== undefined) {
    versionFmt = "/" + version;
    props = ['rename', 'description'];
    req.body.tags = "";
  } else {
    props = ['rename', 'tags', 'description'];
  }
  let description = req.body.description;

  if (ref === undefined) {
    req.flash('warning', `Missing ref`);
    res.redirect(`${baseURL}/edit/snippet/${ref}${versionFmt}${versionFmt}`);
    return;
  }

  if (missingProps(req.body, props)) {
    req.flash('warning', 'Missing expected form properties');
    res.redirect(`${baseURL}/edit/snippet/${ref}${versionFmt}`);
    return;
  }

  let tags = _.uniq(req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== ""));
  let rejects = tags.filter(tag => tag.match(/^([A-z0-9 _\-\.+\[\]\{\}\(\)]{1,32})$/g) === null);

  Snippet.getCond({ref}).then(doc => {
    if (doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/view/snippet');
      return;
    }

    let name = req.body.rename;
    let desc = req.body.description;

    if (name === undefined || name === "") name = doc.name;
    if (doc.published === 1 && name !== doc.name) {
      req.flash('warning', 'Names can\'t be changed for Published Snippets');
      res.redirect(`${baseURL}/edit/snippet/${ref}${versionFmt}`);

    } else if (name.match(/^[A-z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/) === null) {
      req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
      res.redirect(`${baseURL}/edit/snippet/${ref}${versionFmt}`);

    } else if (rejects.length > 0 || req.body.tags.length > 255) {
      req.flash('warning', 'Snippet tags invalid! 32 chars per tag, accepted chars: a-Z0-9 _-.+[]{}()');
      res.redirect(`${baseURL}/edit/snippet/${ref}${versionFmt}`);

    } else if (description.length > 65535) {
      req.flash('warning', 'Description is too large');
      res.redirect(`${baseURL}/edit/snippet/${ref}${versionFmt}`);

    } else {
      Snippet.getCond({name: req.body.rename, owner: req.session.user.id}).then(dup => {
        if (req.body.rename !== doc.name && dup !== null) {
          req.flash('warning', `You already have another snippet named ${req.body.rename}`);
          res.redirect(`${baseURL}/edit/snippet/${ref}${versionFmt}`);
          return;
        }

        // Revision edit
        if (version !== undefined) {
          Version.getVersion(ref, version).then(ver => {
            Version.update({description}, ver.id).then(() => {
              Snippet.modified(doc.id).then(() => {
                req.flash('info', `Snippet ${name} was updated successfully!`);
                res.redirect(baseURL + '/view/snippet#publish');
              });
            });
          });
        } else {
          Snippet.update({name, description}, doc.id).then(() => {
            Snippet.updateTags(tags, doc.id).then(() => {
              req.flash('info', `Snippet ${name} was updated successfully!`);
              res.redirect(baseURL + '/view/snippet' + (doc.published === 1 ? "#publish" : ""));
            });
          });
        }
      });
    }
  });
});

module.exports = router;

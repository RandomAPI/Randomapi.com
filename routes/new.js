const express  = require('express');
const _        = require('lodash');
const fs       = require('fs');
const router   = express.Router();
const multer   = require('multer');
const settings = require('../utils').settings;
const missingProps = require('../utils').missingProps;
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
const List = require('../models/List');
const User = require('../models/User');
const Snippet   = require('../models/Snippet');
const Generator = require('../models/Generator');

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

router.get('/api', (req, res, next) => {
  Generator.getAvailableVersions().then(versions => {
    res.render('new/api', _.merge(defaultVars, {versions, title: 'New API'}));
  });
});

router.post('/api', (req, res, next) => {
  if (missingProps(req.body, ['name'])) {
    req.flash('warning', 'Missing expected form properties');
    res.redirect(baseURL + '/new/api');
    return;
  }

  if (req.body.name === '') {
    req.flash('warning', 'Please provide a name for your API');
    res.redirect(baseURL + '/new/api');

  } else if (!req.body.name.match(/^[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/)) {
    req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
    res.redirect(baseURL + '/new/api');

  // Is user within their tier limits?
  } else if (req.session.user.apis + 1 > req.session.tier.apis && req.session.tier.apis !== 0) {
    req.flash('warning', 'You have used up your API quota for the ' + req.session.tier.name + ' tier.');
    res.redirect(baseURL + '/new/api');

  // Else, add the API
  } else {
    API.add({name: req.body.name, generator: req.body.generator, owner: req.session.user.id}).then(API.getCond).then(model => {
      fs.writeFile('./data/apis/' + model.id + '.api', `
// Documentation: ${settings.general.basehref}documentation
// Your awesome API code here...`, 'utf8', err => {

        // Increment total APIs for user
        User.incVal('apis', 1, req.session.user.username).then(() => {
          req.flash('info', `API ${model.name} [${model.ref}] was added successfully!`);
          res.redirect(baseURL + '/code/api/' + model.ref);
        });
      });
    });
  }
});

// list //
router.get('/list', (req, res, next) => {
  res.render('new/list', _.merge(defaultVars, {title: 'New List'}));
});

router.post('/list', (req, res, next) => {
  upload(req, res, err => {
    if (missingProps(req.body, ['name']) || req.file === undefined) {
      req.flash('warning', 'Missing expected form properties');
      res.redirect(baseURL + '/new/list');
      if (req.file !== undefined) {
        fs.unlink('./'+ req.file.path);
      }
      return;
    } else if (err) {
      req.flash('warning', 'This list is too big. Please keep your file size under 5MB.');
      res.redirect(baseURL + '/new/list');

    } else if (req.body.name === "" || req.file.originalname.match(/(?:\.([^.]+))?$/)[1] !== 'txt') {
      req.flash('warning', 'Looks like you provided an invalid file...please try again.');
      if (req.file !== undefined) {
        fs.unlink('./'+ req.file.path);
      }
      res.redirect(baseURL + '/new/list');

    } else if (!req.body.name.match(/^[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/)) {
      req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
      res.redirect(baseURL + '/new/list');

    // Is user within their tier limits?
    } else if (req.session.user.memory + req.file.size > req.session.tier.memory && req.session.tier.memory !== 0) {
      req.flash('warning', 'You have used up your List quota for the ' + req.session.tier.name + ' tier.');
      fs.unlink('./'+ req.file.path);
      res.redirect(baseURL + '/new/list');

    // Else, add the List
    } else {
      List.add({name: req.body.name, memory: req.file.size, owner: req.session.user.id}).then(List.getCond).then(model => {
        fs.rename('./'+ req.file.path, './data/lists/' + model.id + '.list', err => {
          User.incVal('memory', req.file.size, req.session.user.username).then(() => {
            req.flash('info', `List ${model.name} [${model.ref}] was added successfully!`);
            res.redirect(baseURL + '/view/list');
          });
        });
      });
    }
  });
});

// snippets //
router.get('/snippet', (req, res, next) => {
  res.render('new/snippet', _.merge(defaultVars, {title: 'New Snippet'}));
});

router.post('/snippet', (req, res, next) => {
  if (missingProps(req.body, ['name', 'tags'])) {
    req.flash('warning', 'Missing expected form properties');
    res.redirect(baseURL + '/new/snippet');
    return;
  }

  let tags = _.uniq(req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== ""));
  let rejects = tags.filter(tag => tag.match(/^([a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{1,32})$/g) === null);

  if (req.body.name === '') {
    req.flash('warning', 'Please provide a name for your Snippet');
    res.redirect(baseURL + '/new/snippet');

  // Make sure snippet name meets requirements
  } else if (!req.body.name.match(/^[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/)) {
    req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
    res.redirect(baseURL + '/new/snippet');

  // Check tag requirements
  } else if (rejects.length > 0 || req.body.tags.length > 255) {
    req.flash('warning', 'Snippet tags invalid! 32 chars per tag, accepted chars: a-Z0-9 _-.+[]{}()');
    res.redirect(baseURL + '/new/snippet');

  // Is user within their snippet limits?
  } else if (req.session.user.snippets + 1 > req.session.tier.snippets && req.session.tier.snippets !== 0) {
    req.flash('warning', 'You have used up your Snippet quota for the ' + req.session.tier.name + ' tier.');
    res.redirect(baseURL + '/new/snippet');

  } else {
    // Check for duplicate names
    Snippet.getCond({name: req.body.name, owner: req.session.user.id}).then(dup => {

      // Add snippet
      if (dup !== null) {
        req.flash('warning', `You already have another snippet named ${req.body.name}`);
        res.redirect(baseURL + '/new/snippet');
        return;
      }
      Snippet.add({name: req.body.name, description: req.body.description, owner: req.session.user.id, tags}).then(Snippet.getCond).then(model => {
        fs.writeFile('./data/snippets/' + model.id + '.snippet', `
// Documentation: ${settings.general.basehref}documentation
// Your awesome Snippet code here...`, 'utf8', err => {

          // Increment total Snippets for user
          User.incVal('snippets', 1, req.session.user.username).then(() => {
            req.flash('info', `Snippet ${model.name} was added successfully!`);
            res.redirect(baseURL + '/code/snippet/' + model.ref);
          });
        });
      });
    });
  }
});

module.exports = router;

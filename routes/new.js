const express  = require('express');
const _        = require('lodash');
const fs       = require('fs');
const router   = express.Router();
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
  } else {
    next();
  }
});

router.get('/api', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    Generator.getAvailableVersions().then(versions => {
      res.render('new/api', _.merge(defaultVars, {versions, title: 'New API'}));
    });
  } else {
    if (req.session.subscription.status === 3) {
      res.redirect(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.redirect(baseURL + '/');
    }
  }
});

router.post('/api', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    if (req.body.name === '') {
      req.flash('warning', 'Please provide a name for your API');
      res.redirect(baseURL + '/new/api');

    } else if (!req.body.name.match(/^[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/)) {
      req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
      res.redirect(baseURL + '/new/api');

    // Is user OVER their limits from a recent downgrade?
    } else if (req.session.subscription.status === 4) {
      req.flash('warning', 'Your account is currently soft-locked until you fix your account quotas.');
      res.redirect(baseURL + '/');

    // Is user within their tier limits?
    } else if (req.session.user.apis + 1 > req.session.tier.apis && req.session.tier.apis !== 0) {
      req.flash('warning', 'You have used up your API quota for the ' + req.session.tier.name + ' tier.');
      res.redirect(baseURL + '/new/api');

    // Else, add the API
    } else {
      API.add({name: req.body.name, generator: req.body.generator, owner: req.session.user.id}).then(API.getCond).then(model => {
        fs.writeFile('./data/apis/' + model.id + '.api', `
// Documentation: http://localhost:3000/documentation
// Your awesome API code here...`, 'utf8', err => {

          // Increment total APIs for user
          User.incVal('apis', 1, req.session.user.username).then(() => {
            req.flash('info', `API ${model.name} [${model.ref}] was added successfully!`);
            res.redirect(baseURL + '/edit/api/' + model.ref);
          });
        });
      });
    }
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
    res.render('new/list', _.merge(defaultVars, {title: 'New List'}));
  } else {
    if (req.session.subscription.status === 3) {
      res.redirect(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.redirect(baseURL + '/');
    }
  }
});

router.post('/list', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    upload(req, res, err => {
      if (err) {
        req.flash('warning', 'This list is too big. Please keep your file size under 5MB.');
        res.redirect(baseURL + '/new/list');

      } else if (req.body.name === undefined || req.body.name === "" || req.file === undefined || req.file.originalname.match(/(?:\.([^.]+))?$/)[1] !== 'txt') {
        req.flash('warning', 'Looks like you provided an invalid file...please try again.');
        if (req.file !== undefined) {
          fs.unlink('./'+ req.file.path);
        }
        res.redirect(baseURL + '/new/list');

      } else if (!req.body.name.match(/^[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/)) {
        req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
        res.redirect(baseURL + '/new/list');

      // Is user OVER their limits from a recent downgrade?
      } else if (req.session.subscription.status === 4) {
        req.flash('warning', 'Your account is currently soft-locked until you fix your account quotas.');
        fs.unlink('./'+ req.file.path);
        res.redirect(baseURL + '/');

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
  } else {
    if (req.session.subscription.status === 3) {
      res.redirect(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.redirect(baseURL + '/');
    }
  }
});

// snippets //
router.get('/snippet', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    res.render('new/snippet', _.merge(defaultVars, {title: 'New Snippet'}));
  } else {
    if (req.session.subscription.status === 3) {
      res.redirect(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.redirect(baseURL + '/');
    }
  }
});

router.post('/snippet', (req, res, next) => {
  if (req.session.subscription.status !== 3) {
    if (req.body.name === '') {
      req.flash('warning', 'Please provide a name for your Snippet');
      res.redirect(baseURL + '/new/snippet');

    } else if (!req.body.name.match(/^[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{1,32}$/)) {
      req.flash('warning', 'Only 32 chars max please! Accepted chars: a-Z0-9 _-.+[]{}()');
      res.redirect(baseURL + '/new/snippet');

    // Make sure snippet name meets requirements
    } else if (req.session.user.snippets + 1 > req.session.tier.snippets && req.session.tier.snippets !== 0) {
      req.flash('warning', 'You have used up your Snippet quota for the ' + req.session.tier.name + ' tier.');
      res.redirect(baseURL + '/new/snippet');

    // Is user OVER their limits from a recent downgrade?
    } else if (req.session.subscription.status === 4) {
      req.flash('warning', 'Your account is currently soft-locked until you fix your account quotas.');
      res.redirect(baseURL + '/');

    // Is user within their snippet limits?
    } else if (req.session.user.snippets + 1 > req.session.tier.snippets && req.session.tier.snippets !== 0) {
      req.flash('warning', 'You have used up your Snippet quota for the ' + req.session.tier.name + ' tier.');
      res.redirect(baseURL + '/new/snippet');

    // Else, add the Snippet
    } else {
      Snippet.add({name: req.body.name, description: req.body.description, owner: req.session.user.id}).then(Snippet.getCond).then(model => {
        fs.writeFile('./data/snippets/' + model.id + '.snippet', `
// Documentation: http://localhost:3000/documentation
// Your awesome Snippet code here...`, 'utf8', err => {

          // Increment total Snippets for user
          User.incVal('snippets', 1, req.session.user.username).then(() => {
            req.flash('info', `Snippet ${model.name} was added successfully!`);
            res.redirect(baseURL + '/edit/snippet/' + model.ref);
          });
        });
      });
    }
  } else {
    if (req.session.subscription.status === 3) {
      res.redirect(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.redirect(baseURL + '/');
    }
  }
});

module.exports = router;

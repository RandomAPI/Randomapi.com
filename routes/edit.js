const express  = require('express');
const _        = require('lodash');
const fs       = require('fs');
const router   = express.Router();
const settings = require('../settings.json');
const logger   = require('../utils').logger;

const API  = require('../models/API');
const List = require('../models/List');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', (req, res, next) => {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');
  next();
});

router.get('/api/:ref?', (req, res, next) => {
  if (req.session.loggedin && req.session.subscription.status !== 3) {
    API.getCond({ref: req.params.ref}).then(doc => {
      if (doc.owner !== req.session.user.id) {
        res.redirect(baseURL + '/view/api');
      } else {
        doc.code = fs.readFileSync('./data/apis/' + doc.id + '.api'); // Read api src into this...
        res.render('edit/api', _.merge(defaultVars, {api: doc, socket: ':' + settings.general.socket, title: `Edit API ${doc.ref}`}));
      }
    }).catch(err => {
      res.redirect(baseURL + '/view/api');
    });
  } else {
    if (req.session.subscription.status === 3) {
      res.redirect(baseURL + '/settings/subscription/paymentOverdue');
    } else {
      res.redirect(baseURL + '/');
    }
  }
});

router.post('/api/:ref', (req, res, next) => {
  if (req.session.loggedin && req.session.subscription.status !== 3) {
    API.getCond({ref: req.params.ref}).then(doc => {
      if (doc.owner !== req.session.user.id) {
        res.redirect(baseURL + '/view/api');
      } else {
        let name = req.body.rename;
        if (name === undefined || name === "") name = doc.name;
        API.update({name}, doc.ref).then(() => {
          fs.writeFile('./data/apis/' + doc.id + '.api', req.body.code.replace(/\r\n/g, '\n').slice(0, 8192), 'utf8', err => {
            req.flash('info', `API ${name} [${doc.ref}] was updated successfully!`);
            res.send(baseURL + '/view/api');
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

// list //
router.get('/list/:ref', (req, res, next) => {
  if (req.session.loggedin && req.session.subscription.status !== 3) {
    List.getCond({ref: req.params.ref}).then(doc => {
      res.render('edit/list', _.merge(defaultVars, {list: doc, title: `Editing list ${doc.ref}`}));
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

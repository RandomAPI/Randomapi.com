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
const upload = multer({ storage: storage });

const API = require('../models/API');
const List = require('../models/List');
const Generator = require('../models/Generator');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', (req, res, next) => {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');
  next();
});

router.get('/api', (req, res, next) => {
  if (req.session.loggedin) {
    Generator.getAvailableVersions().then(versions => {
      res.render('new/api', _.merge(defaultVars, {versions, title: 'New API'}));
    });
  } else {
    res.redirect(baseURL + '/');
  }
});

router.post('/api', (req, res, next) => {
  if (req.body.name === '') {
    req.flash('info', 'Please provide a name for your API');
    res.redirect(baseURL + '/new/api');
  } else {
    API.add({name: req.body.name, generator: req.body.generator, owner: req.session.user.id}).then(API.getCond).then(model => {
      fs.writeFile('./data/apis/' + model.id + '.api', `
// Documentation: http://localhost:3000/documentation
// Your awesome API code here...
`, 'utf8', err => {
        req.flash('info', `API ${req.body.name} was added successfully!`);
        res.redirect(baseURL + '/edit/api/' + model.ref);
      });
    });
  }
});

// list //
router.get('/list', (req, res, next) => {
  if (req.session.loggedin) {
    res.render('new/list', _.merge(defaultVars, {title: 'New List'}));
  } else {
    res.redirect(baseURL + '/');
  }
});

router.post('/list', upload.any(), (req, res, next) => {
  if (req.body.name === undefined || req.files.length === 0 || req.files[0].originalname.match(/(?:\.([^.]+))?$/)[1] !== 'txt') {
    req.flash('info', 'Looks like you provided an invalid file...please try again.');
    fs.unlink('./'+ req.files[0].path);
    res.redirect(baseURL + '/new/list');
  } else {
    List.add({name: req.body.name, owner: req.session.user.id}).then(List.getCond).then(model => {
      fs.rename('./'+ req.files[0].path, './data/lists/' + model.id + '.list', err => {
        req.flash('info', `List ${req.body.name} was added successfully!`);
        res.redirect(baseURL + '/view/list');
      });
    });
  }
});

module.exports = router;

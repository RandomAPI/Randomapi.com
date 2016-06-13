const express  = require('express');
const fs       = require('fs');
const router   = express.Router();
const settings = require('../settings.json');

const API = require('../models/API');
const List = require('../models/List');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', function(req, res, next) {
  defaultVars = req.app.get('defaultVars');
  baseURL = req.app.get('baseURL');
  next();
});

router.get('/api/:ref', (req, res, next) => {
  if (req.session.loggedin) {
    let doc = API.getAPIByRef(req.params.ref);
    doc.code = fs.readFileSync('./data/apis/' + doc.id + '.api'); // Read api src into this...
    res.render('edit/api', _.merge(defaultVars, {api: doc, socket: ':' + settings.general.socket}));
  } else {
    res.render('index', defaultVars);
  }
});

router.post('/api/:ref', (req, res, next) => {
  if (req.session.loggedin) {
    let doc = API.getAPIByRef(req.params.ref);
    if (doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/view/api');
    } else {
      fs.writeFile('./data/apis/' + doc.id + '.api', req.body.code.replace(/\r\n/g, '\n'), 'utf8', err => {
        req.flash('info', 'API ' + doc.name + ' was updated successfully!');
        res.send(baseURL + '/view/api');
      });
    }
  }
});

// list //
router.get('/list/:ref', (req, res, next) => {
  if (req.session.loggedin) {
    let doc = List.getListByRef(req.params.ref);
    res.render('edit/list', _.merge(defaultVars, {list: doc}));
  } else {
    res.render('index', defaultVars);
  }
});

module.exports = router;

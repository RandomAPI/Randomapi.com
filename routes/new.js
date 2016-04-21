var express  = require('express');
var fs       = require('fs');
var router   = express.Router();
var settings = require('../settings.json');
var API      = require('../models/API.js');
var List     = require('../models/List.js');
var multer   = require('multer');
var crypto   = require('crypto');
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/')
  },
  filename: function (req, file, cb) {
    crypto.pseudoRandomBytes(16, function (err, raw) {
      // Extension:  + '.' + file.originalname.match(/.*\.(.*)/)[1]
      cb(null, raw.toString('hex') + Date.now());
    });
  }
});
var upload = multer({ storage: storage });

var baseURL;
router.all('*', function(req, res,next) {
  if (settings.behindReverseProxy) {
    var uri = req.headers.uri;
    var path = req.originalUrl;
    baseURL = uri.slice(0, uri.indexOf(path));
  } else {
    baseURL = "";
  }
  next();
});

var views;
fs.readdir('.viewsMin/pages/new', function(err, data) {;
  views = data;
});

var titles = {
  home: 'Home',
  index: 'Home',
  login: 'Login',
  register: 'Register'
};

// api //
router.get('/api', function(req, res, next) {
  if (req.session.loggedin) {
    res.render('new/api', { messages: req.flash('info'), session: req.session });
  } else {
    res.render('index', { messages: req.flash('info'), session: req.session });
  }
});

router.post('/api', function(req, res, next) {
  API.add({name: req.body.name, owner: req.session.user.id}, function(model) {
    fs.writeFile('./data/apis/' + model.id + '.api', req.body.code.replace(/\r\n/g, '\n'), 'utf8', function(err) {
      if (err) console.log(err);
      req.flash('info', "API " + req.body.name + " was added successfully!");
      res.redirect(baseURL + '/view/api');
    });
  });
});

// list //
router.get('/list', function(req, res, next) {
  if (req.session.loggedin) {
    res.render('new/list', { messages: req.flash('info'), session: req.session });
  } else {
    res.render('index', { messages: req.flash('info'), session: req.session });
  }
});

router.post('/list', upload.any(), function(req, res, next) {
  if (req.body.name === undefined || req.files.length === 0 || req.files[0].originalname.match(/(?:\.([^.]+))?$/)[1] !== "txt") {
    req.flash('info', "Looks like you provided an invalid file...please try again.");
    res.redirect(baseURL + '/new/list');
  } else {
    List.add({name: req.body.name, owner: req.session.user.id}, function(model) {
      fs.rename('./'+ req.files[0].path, './data/lists/' + model.id + '.list', function(err) {
        if (err) console.log(err);
        req.flash('info', "List " + req.body.name + " was added successfully!");
        res.redirect(baseURL + '/view/list');
      });
    });
  }
});
module.exports = router;

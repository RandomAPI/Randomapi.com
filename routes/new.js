var express  = require('express');
var fs       = require('fs');
var router   = express.Router();
var settings = require('../settings.json');
var User     = require('../models/User.js');
var multer   = require('multer');
var crypto   = require('crypto');
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/')
  },
  filename: function (req, file, cb) {
    console.log(file);
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
  console.log(req.body);
  // Get unique api id

  fs.writeFile('./data/apis/1.api', req.body.code.replace(/\r\n/g, '\n'), 'utf8', function(err) {
    if (err) console.log(err);
    res.status(204).end();
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
  console.log(req.body) // form fields
  console.log(req.files) // form files
  res.status(204).end()
});
module.exports = router;

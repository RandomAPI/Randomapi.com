var express  = require('express');
var fs       = require('fs');
var router   = express.Router();
var settings = require('../settings.json');
var User     = require('../models/User.js');

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
fs.readdir('.viewsMin/pages/view', function(err, data) {;
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
    res.render('view/api', { messages: req.flash('info'), session: req.session });
  } else {
    res.render('index', { messages: req.flash('info'), session: req.session });
  }
});


// list //
router.get('/list', function(req, res, next) {
  if (req.session.loggedin) {
    res.render('view/list', { messages: req.flash('info'), session: req.session });
  } else {
    res.render('index', { messages: req.flash('info'), session: req.session });
  }
});

module.exports = router;

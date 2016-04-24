var express  = require('express');
var fs       = require('fs');
var router   = express.Router();
var settings = require('../settings.json');
var User     = require('../models/User.js');

var views;
fs.readdir('.viewsMin/pages', function(err, data) {;
  views = data;
});

var titles = {
  home: 'Home',
  index: 'Home',
  login: 'Login',
  register: 'Register'
};

// Index //
router.get('/', function(req, res, next) {
  if (req.session.loggedin) {
    res.render('home', _.merge(defaultVars, {title: "Home"}));
  } else {
    res.render('index', defaultVars);
  }
});

// Login //
router.get('/login', function(req, res, next) {
    if (req.session.loggedin) {
      res.redirect(baseURL + '/');
    } else {
      res.render('login',defaultVars);
    }
});

router.post('/login', function(req, res, next) {
  if (req.session.loggedin) {
    res.redirect(baseURL + '/');
  } else {
    User.login({username: req.body.username, password: req.body.password}, function(err, data) {
      if (err) {
        req.flash('info', err.flash);
        res.redirect(baseURL + err.redirect);
      } else {
        req.session.loggedin = true;
        req.session.user = data.user;
        req.flash('info', data.flash);
        res.redirect(baseURL + data.redirect);
      }
    });
  }
});

// Logout //
router.get('/logout', function(req, res, next) {
  if (req.session.loggedin) {
    delete req.session.loggedin;
    req.flash('info', "Logged out successfully!");
    res.redirect(baseURL + '/');
  } else {
    res.redirect(baseURL + '/');
  }
});

// Registration //
router.get('/register', function(req, res, next) {
  if (req.session.loggedin) {
    res.redirect(baseURL + '/');
  } else {
    res.render('register', defaultVars);
  }
});

router.post('/register', function(req, res, next) {
  if (!req.session.loggedin) {
    User.register(req.body, function(err, data) {
      if (err) {
        req.flash('info', err.flash);
        res.redirect(baseURL + err.redirect);
      } else {
        req.session.loggedin = true;
        req.session.user = data.user;
        req.flash('info', data.flash);
        res.redirect(baseURL + data.redirect);
      }
    });
  } else {
    res.redirect(baseURL + '/index');
  }
});

module.exports = router;

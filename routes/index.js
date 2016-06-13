const express = require('express');
const router  = express.Router();
const logger  = require('../utils').logger;

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', function(req, res, next) {
  defaultVars = req.app.get('defaultVars');
  baseURL = req.app.get('baseURL');
  next();
});

router.get('/', (req, res, next) => {
  if (req.session.loggedin) {
    res.render('dashboard', _.merge(defaultVars, {title: 'Dashboard'}));
  } else {
    res.render('index', defaultVars);
  }
});

// Login //
router.get('/login', (req, res, next) => {
    if (req.session.loggedin) {
      res.redirect(baseURL + '/');
    } else {
      res.render('login', defaultVars);
    }
});

router.post('/login', (req, res, next) => {
  if (req.session.loggedin) {
    res.redirect(baseURL + '/');
  } else {
    User.login({username: req.body.username, password: req.body.password}, (err, data) => {
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
router.get('/logout', (req, res, next) => {
  if (req.session.loggedin) {
    delete req.session.loggedin;
    res.redirect(baseURL + '/');
  } else {
    res.redirect(baseURL + '/');
  }
});

// Registration //
router.get('/register', (req, res, next) => {
  if (req.session.loggedin) {
    res.redirect(baseURL + '/');
  } else {
    res.render('register', defaultVars);
  }
});

router.post('/register', (req, res, next) => {
  if (!req.session.loggedin) {
    User.register(req.body, (err, data) => {
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

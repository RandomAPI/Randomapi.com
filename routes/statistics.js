const express  = require('express');
const _        = require('lodash');
const router   = express.Router();
const settings = require('../settings.json');
const redis    = require('../utils').redis;

const API     = require('../models/API');
const User    = require('../models/User');
const List    = require('../models/List');
const Snippet = require('../models/Snippet');
const Version = require('../models/Version');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', (req, res, next) => {
  defaultVars = req.app.get('defaultVars');
  baseURL     = req.app.get('baseURL');
  next();
});

router.get('/data?', (req, res, next) => {
  if (!req.session.loggedin) {
    res.redirect(baseURL + '/');
  } else {
    getUsageHours(req.session.user.id, stats => {
      res.send(stats);
    });
  }
});

router.get('/api/:ref?', (req, res, next) => {
  API.getCond({ref: req.params.ref}).then(doc => {
    if (doc.owner !== req.session.user.id) {
      res.redirect(baseURL + '/view/api');
    } else {
      res.render('statistics/api', _.merge(defaultVars, {api: doc, socket: ':' + settings.general.socket, title: `Stats for API ${doc.name} [${doc.ref}]`}));
    }
  }).catch(err => {
    res.redirect(baseURL + '/view/api');
  });
});

router.get('/api/:ref/data?', (req, res, next) => {
  API.getCond({ref: req.params.ref}).then(doc => {
    if (doc.owner !== req.session.user.id) {
      res.send([]);
    } else {
      getAPIStats(req.params.ref, stats => {
        res.send(stats);
      });
    }
  }).catch(err => {
    res.send([]);
  });
});

router.get('/snippet/:ref?', (req, res, next) => {

});

function getAPIStats(ref, cb) {
  let hours = [];
  let timestamp = new Date().getTime();
  let flooredHour = ~~(~~(new Date().getTime()/1000)/3600)*3600000;

  for (let i = 0; i < 24; i++) {
    redis.zrangebyscore(`stats:API:${ref}`, flooredHour-(86400000*i), (i === 0 ? timestamp : flooredHour)-(86400000*(i-1)), (err, data) => {
      hours.unshift(data);
      if (i === 23) cb(hours);
    });
  }
}

function getUsageHours(userid, cb) {
  let hours = [];
  let timestamp = new Date().getTime();
  let flooredHour = ~~(~~(new Date().getTime()/1000)/3600)*3600000;

  for (let i = 0; i < 24; i++) {
    redis.zrangebyscore(`stats:User:${userid}`, flooredHour-(86400000*i), (i === 0 ? timestamp : flooredHour)-(86400000*(i-1)), (err, data) => {
      hours.unshift(data);
      if (i === 23) cb(hours);
    });
  }
}

module.exports = router;

const express = require('express');
const async   = require('async');
const router  = express.Router();
const logger  = require('../utils').logger;
const User    = require('../models/User');
const Token   = require('../models/Token');

router.post('/login', (req, res, next) => {
  User.getCond({username: req.body.username}).then(user => {
    if (user === null) return res.status(401).send({error: "Invalid username or authToken"});

    Token.getCond({authToken: req.body.authToken}).then(token => {
      if (token === null) return res.status(401).send({error: "Invalid username or authToken"});
      if (token.status === 1) return res.status(401).send({warning: "Token is valid but has already been used"});
      let clientToken = Token.genRandomClientToken();
      Token.update({clientToken, status: 1, fingerprint: req.body.fingerprint}, token.ref).then((a) => {
        res.send(clientToken);
      });

    }, err => {
      res.status(401).send({error: err.error});  
    });

  }, err => {
    res.status(401).send({error: err.error});
  });
});

router.post('/verify', (req, res, next) => {
  User.getCond({username: req.body.username}).then(user => {
    if (user === null) return res.sendStatus(401);

    Token.getCond({clientToken: req.body.clientToken, fingerprint: req.body.fingerprint}).then(token => {
      if (token === null) return res.sendStatus(401);
      Token.lastUsed(token.ref).then(res.sendStatus(200));

    }, err => {
      res.sendStatus(401);
    });

  }, err => {
    res.sendStatus(401);
  });
});

router.post('/logout', (req, res, next) => {
  User.getCond({username: req.body.username}).then(user => {
    if (user === null) return res.sendStatus(401);

    Token.getCond({clientToken: req.body.clientToken, fingerprint: req.body.fingerprint}).then(token => {
      if (token === null) return res.sendStatus(401);
      Token.revoke({ref: token.ref}).then(res.sendStatus(200));

    }, err => {
      res.sendStatus(401);
    });

  }, err => {
    res.sendStatus(401);
  });
});

module.exports = router;

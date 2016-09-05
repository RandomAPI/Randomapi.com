const express = require('express');
const async   = require('async');
const _       = require('lodash');
const fs      = require('fs');
const router  = express.Router();
const logger  = require('../utils').logger;
const API     = require('../models/API');
const List    = require('../models/List');
const Snippet = require('../models/Snippet');
const Version = require('../models/Version');
const User    = require('../models/User');
const Token   = require('../models/Token');
const util    = require('util');

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

    Token.valid(req.body.clientToken, req.body.fingerprint).then(token => {
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

// Sync local OfflineAPI with RandomAPI server
router.post('/sync', (req, res, next) => {
  User.getCond({username: req.body.username}).then(user => {
    if (user === null) return res.sendStatus(401);

    Token.getCond({clientToken: req.body.clientToken, fingerprint: req.body.fingerprint}).then(token => {
      if (token === null) return res.sendStatus(401);

      // Valid token and user at this point...can sync now
      let sync = {};

      async.series([
        // Fetch APIs and extract requires from APIs
        cb => {
          API.getAPIs(user.id).then(apis => {
            let requires = [];

            async.each(apis, (api, callback) => {
              extractRequires(requires, user, api, callback);
            }, () => {

              // Convert require signatures to refs
              getRequireRefs(user, _.uniq(requires), requires => {
                cb(null, {apis, requires});
              });
            });
          });
        },

        // Fetch Lists
        cb => {
          List.getLists(user.id).then(lists => {
            cb(null, {lists});
          });
        }
      ], (err, data) => {

        // Send to user results
        res.send(data);
      });

    }, err => {
      res.sendStatus(401);
    });

  }, err => {
    res.sendStatus(401);
  });
});

router.post('/download/:type?/:ref?', (req, res, next) => {
  User.getCond({username: req.body.username}).then(user => {
    if (user === null) return res.sendStatus(401);

    Token.valid(req.body.clientToken, req.body.fingerprint).then(token => {
      if (token === null) return res.sendStatus(401);

      // valid
      if (req.params.type === 'api') {
        if(req.params.ref === undefined) return res.sendStatus(400);

        // Check if user has permissions for this api
        API.getCond({owner: user.id, ref: req.params.ref}).then(api => {
          if (api === null) return res.sendStatus(403);
          res.send(fs.readFileSync(`./data/apis/${api.id}.api`, 'utf8'));
        });
      } else if (req.params.type === 'require') {

        let split;
        try {
          split = req.params.ref.split('-');
        } catch(e) {
          return res.sendStatus(400);
        }

        if (split.length < 2) return res.sendStatus(400);
        Snippet.getCond({ref: split[0], username: user.username}).then(userSnip => {
          Version.getCond({snippetID: split[1], version: split[2]}).then(authSnip => {
            if (userSnip || (authSnip && authSnip.published === 1)) {
              try {
                res.send(fs.readFileSync(`./data/snippets/${split[1]}-${split[2]}.snippet`, 'utf8'));
              } catch(e) {
                res.sendStatus(404);
              }
            } else {
              res.sendStatus(404);
            }
          });
        });
      } else if (req.params.type === 'list') {
        if(req.params.ref === undefined) return res.sendStatus(400);

        // Check if user has permissions for this list
        List.getCond({owner: user.id, ref: req.params.ref}).then(list => {
          if (list === null) return res.sendStatus(403);
          res.send(fs.readFileSync(`./data/lists/${list.id}.list`, 'utf8'));
        });
      } else {
        res.sendStatus(400);
      }
    });
  });
});

router.all('/?', (req, res, next) => {
  res.sendStatus(404);
});

module.exports = router;


function extractRequires(requires, user, api, callback) {
  let src = fs.readFileSync(`./data/apis/${api.id}.api`, 'utf8');

  let rawMatches = src.match(/require\((?:["'`]([A-z0-9]*\/[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]*(?:\/[0-9]*?)?|~.[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]*(?:\/[0-9]*?)?)["'`]\))/g);
  let index = 0;

  try {
    // There are matches
    if (rawMatches !== null) {
      let reg = new RegExp(/require\((?:["'`]([A-z0-9]*\/[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]*(?:\/[0-9]*?)?|~.[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]*(?:\/[0-9]*?)?)["'`]\))/g);
      let match = reg.exec(src);

      while (match !== null) {
        let result = (match[1] || match[2]).trim();
        if (result.indexOf('~') === 0) {
          result = user.username + '/' + result.slice(1);
        }
        requires.push(result);
        match = reg.exec(src);
      }
    }
  } catch(e) {
    console.log(e);
  }
  callback(null);
}

function getRequireRefs(user, raw, done) {
  //[ 'bill/phone number/1', 'keith/randomnum' ]
  let refs = [];
  async.each(raw, (ref, cb) => {
    let split = ref.split('/');

    // public and has version num or not published and has version number
    if (split.length === 3) {
      Snippet.getCond({username: split[0], name: split[1]}).then(snip => {
        if (snip === null) return cb();

        Version.getVersion(snip.ref, split[2]).then(ver => {
          if (ver !== null && (ver.published === 1 || snip.owner === user.id)) {
            refs.push(`${snip.ref}-${snip.id}-${ver.version}`);
          } else {
            //console.log('bad');
          }
          cb();
        });
      });

    // private and no version num
    } else {
      Snippet.getCond({username: split[0], name: split[1]}).then(snip => {
        refs.push(`${snip.ref}-${snip.id}-1`);
        cb();
      });
    }
  }, () => {
    done(refs);
  });
}

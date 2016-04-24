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
    res.render('new/api', defaultVars);
  } else {
    res.render('index', defaultVars);
  }
});

router.post('/api', function(req, res, next) {
  if (req.body.name === "") {
    req.flash('info', "Please provide a name for your API");
    res.redirect(baseURL + '/new/api');
  } else {
    API.add({name: req.body.name, owner: req.session.user.id}, function(model) {
      fs.writeFile('./data/apis/' + model.id + '.api', "// Append all fields to the api object\napi.field = \"blah\";\n\n// Access a random item from a list with the list() function\n//api.list = list('LIST_REF_HERE');\n\n// list() also accepts an array of items to choose a random item from\napi.number = list([1,2,3,4,5]);\n\n// random.numeric(min, max) and random.special(mode, length)\napi.num     = random.numeric(1, 10);\napi.special = random.special(2, 10);\n\n// timestamp() returns current unix timestamp\napi.time = timestamp();\n\n// Use getVar() if you are accessing a GET variable in the URI\napi.blah = getVar('blah');\n\n// Hashessssss\napi.md5    = hash.md5(api.time);\napi.sha1   = hash.sha1(api.time);\napi.sha256 = hash.sha256(api.time);\n", 'utf8', function(err) {
        if (err) console.log(err);
        req.flash('info', "API " + req.body.name + " was added successfully!");
        res.redirect(baseURL + '/edit/api/' + model.ref);
      });
    });
  }
});

// list //
router.get('/list', function(req, res, next) {
  if (req.session.loggedin) {
    res.render('new/list', defaultVars);
  } else {
    res.render('index', defaultVars);
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

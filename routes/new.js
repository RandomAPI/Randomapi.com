const express  = require('express');
const _        = require('lodash');
const fs       = require('fs');
const router   = express.Router();
const multer   = require('multer');
const crypto   = require('crypto');
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, './uploads/')
  },
  filename(req, file, cb) {
    crypto.pseudoRandomBytes(16, (err, raw) => {
      // Extension:  + '.' + file.originalname.match(/.*\.(.*)/)[1]
      cb(null, raw.toString('hex') + Date.now());
    });
  }
});
const upload = multer({ storage: storage });

const API = require('../models/API');
const List = require('../models/List');
const Generator = require('../models/Generator');

// Setup defaultVars and baseURL for all routes
let defaultVars, baseURL;
router.all('*', function(req, res, next) {
  defaultVars = req.app.get('defaultVars');
  baseURL = req.app.get('baseURL');
  next();
});

router.get('/api', (req, res, next) => {
  if (req.session.loggedin) {
    Generator.getAvailableVersions().then(versions => {
      res.render('new/api', _.merge(defaultVars, {versions}));
    });
  } else {
    res.render('index', defaultVars);
  }
});

router.post('/api', (req, res, next) => {
  if (req.body.name === '') {
    req.flash('info', 'Please provide a name for your API');
    res.redirect(baseURL + '/new/api');
  } else {
    API.add({name: req.body.name, generator: req.body.generator, owner: req.session.user.id}, model => {
      fs.writeFile('./data/apis/' + model.id + '.api', `
// APIs are coded with Vanilla Javascript and are executed in a sandboxed environment
// Append all fields to the api object that you want to have returned
api.field = 'blah';

// If you want to use a variable but don't want it to be outputted in the API, use var like a normal variable.
var data = '123';
api.data = data; // This will attach data to the api object that is returned

// Access a random item from a list with the list() function
//api.list = list('LIST_REF_HERE');

// list() also accepts an array of items to choose a random item from
api.number = list([1,2,3,4,5]);

// List also accepts a 2nd argument for which line of the list you'd like to use
api.number2 = list([1,2,3], 2); // This will always return 2 since it is the 2nd item of the array (not 0 indexed based)

// random.numeric(min, max) and random.special(mode, length)
/* Special Modes chooses from this list of characters:
1: abcdef1234567890
2: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890
3: 0123456789
4: ABCDEFGHIJKLMNOPQRSTUVWXYZ
5: abcdefghijklmnopqrstuvwxyz1234567890
6: ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890
*/

api.num     = random.numeric(1, 10);
api.special = random.special(2, 10);

// timestamp() returns current unix timestamp
api.time = timestamp();

// Use getVar() if you are accessing a GET variable in the URI. If the variable isn't set, then it'll return undefined.
api.blah = getVar('blah');
api.testing = getVar('testing');

// Currently available hashes
api.md5    = hash.md5(api.time);
api.sha1   = hash.sha1(api.time);
api.sha256 = hash.sha256(api.time);

api.num1 = random.numeric(1, 100);
api.num2 = random.numeric(1, 100);
api.results = {
  add: api.num1 + api.num2,
  sub: api.num1 - api.num2,
  div: api.num1 / api.num2,
  mul: api.num1 * api.num2,
  mod: api.num1 % api.num2
};
`, 'utf8', err => {
        req.flash('info', 'API ' + req.body.name + ' was added successfully!');
        res.redirect(baseURL + '/edit/api/' + model.ref);
      });
    });
  }
});

// list //
router.get('/list', (req, res, next) => {
  if (req.session.loggedin) {
    res.render('new/list', defaultVars);
  } else {
    res.render('index', defaultVars);
  }
});

router.post('/list', upload.any(), (req, res, next) => {
  if (req.body.name === undefined || req.files.length === 0 || req.files[0].originalname.match(/(?:\.([^.]+))?$/)[1] !== 'txt') {
    req.flash('info', 'Looks like you provided an invalid file...please try again.');
    res.redirect(baseURL + '/new/list');
  } else {
    List.add({name: req.body.name, owner: req.session.user.id}).then(List.getList).then(model => {
      fs.rename('./'+ req.files[0].path, './data/lists/' + model.id + '.list', err => {
        req.flash('info', 'List ' + req.body.name + ' was added successfully!');
        res.redirect(baseURL + '/view/list');
      });
    });
  }
});

module.exports = router;

var express  = require('express');
var fs       = require('fs');
var router   = express.Router();

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
    var obs = [];
    var apis = API.getAPIs(req.session.user.id);
    for (var i = 0; i < apis.length; i++) {
      var newobj = JSON.parse(JSON.stringify(apis[i]));
      newobj.generator = Generator.getByID(apis[i].generator).version;
      obs.push(newobj);
    }
    res.render('view/api', _.merge(defaultVars, {apis: obs}));
  } else {
    res.render('index', defaultVars);
  }
});


// list //
router.get('/list', function(req, res, next) {
  if (req.session.loggedin) {
    var lists = List.getLists(req.session.user.id);
    res.render('view/list', _.merge(defaultVars, {lists}));
  } else {
    res.render('index', defaultVars);
  }
});

module.exports = router;

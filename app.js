var express      = require('express');
var path         = require('path');
var favicon      = require('serve-favicon');
var logger       = require('morgan');
var cookieParser = require('cookie-parser')();
var bodyParser   = require('body-parser');
var fs           = require('fs');
var flash        = require('connect-flash');
var compress     = require('compression');
var app          = express();
_                = require('lodash');

var db           = require('./models/db');
var settings     = require('./settings.json');

// Redis Session Store
var redis        = require('redis');
var session      = require('express-session');
var redisStore   = require('connect-redis')(session);

// Routes
var index = require('./routes/index');
var newRoute = require('./routes/new');
var view = require('./routes/view');
var edit = require('./routes/edit');
var deleteRoute = require('./routes/delete');
var api = require('./routes/api');

// view engine setup
app.set('views', path.join(__dirname, '.viewsMin/pages'));
app.set('view engine', 'ejs');

// gzip compression
app.use(compress());

// Session store
app.use(cookieParser);

var sessionSettings = {
  key: settings.session.key,
  store: new redisStore(),
  secret: settings.session.secret,
  cookie: {
    path: '/'
  },
  resave: false,
  saveUninitialized: false
};

app.use(session(sessionSettings));

// Flash messages
app.use(flash());

// Favicon
app.use(favicon(__dirname + '/public/img/favicon.png'));

app.use(logger('dev'));
app.use(bodyParser.json({limit: '128mb'}));
app.use(bodyParser.urlencoded({ limit: '128mb', extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
baseURL = "";  // For redirects
basehref = ""; // For relative JS and CSS in pages
defaultVars = {};

app.use('*', function(req, res, next) {
  defaultVars = { messages: req.flash('info'), session: req.session, basehref, title: null };
  if (settings.general.behindReverseProxy) {
    var uri = req.headers.uri.replace(/(\/)+$/,'');
    var path = req.originalUrl.replace(/(\/)+$/,'');
    if (path === '') {
      baseURL = uri;
    } else {
      baseURL = uri.slice(0, uri.indexOf(path));
    }
    basehref = req.headers.hostpath + baseURL + '/';
  } else {
    baseURL = "";
    basehref = baseURL + '/';
  }
  next();
});
app.use('/', index);
app.use('/new', newRoute);
app.use('/view', view);
app.use('/edit', edit);
app.use('/delete', deleteRoute);
app.use('/api', api);

// production error handler
// no stacktraces leaked to user
app.use(function(req, res, next) {
  res.redirect(baseURL + '/');
});

app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.send(err.stack);
});

module.exports = app;

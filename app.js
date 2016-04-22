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

app.use(logger('dev'));
app.use(bodyParser.json({limit: '128mb'}));
app.use(bodyParser.urlencoded({ limit: '128mb', extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', index);
app.use('/new', newRoute);
app.use('/view', view);
app.use('/edit', edit);
app.use('/delete', deleteRoute);
app.use('/api', api);

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.send(err.stack);
});

module.exports = app;

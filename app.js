settings         = require('./settings.json');
var express      = require('express');
var path         = require('path');
var favicon      = require('serve-favicon');
var logger       = require('morgan');
var cookieParser = require('cookie-parser')();
var bodyParser   = require('body-parser');
var http         = require('http');
var flash        = require('connect-flash');
var compress     = require('compression');
var cors         = require('cors');
var debug        = require('debug')('RandomAPI:server');
var app          = express();
var server       = http.createServer(app);
_                = require('lodash');
io               = require('socket.io')(settings.general.socket);

var db           = require('./models/db');

// Redis Session Store
var session      = require('express-session');
var redisStore   = require('connect-redis')(session);

// Routes
var index    = require('./routes/index');
var newRoute = require('./routes/new');
var view     = require('./routes/view');
var edit     = require('./routes/edit');
var delRoute = require('./routes/delete');
var api      = require('./routes/api');

// global models
API       = require('./models/API');
List      = require('./models/List');
User      = require('./models/User');
Generator = require('./models/Generator');
Counters  = require('./models/Counters');

// view engine setup
app.set('views', path.join(__dirname, '.viewsMin/pages'));
app.set('view engine', 'ejs');
app.set('port', settings.general.port);

app.use(cors());
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

//app.use(logger('dev'));
app.use(bodyParser.json({limit: '128mb'}));
app.use(bodyParser.urlencoded({ limit: '128mb', extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
baseURL     = null;  // For redirects
basehref    = null;  // For relative JS and CSS in pages
defaultVars = {};  // Default vars to send into views
var firstRun = false;

app.use('*', function(req, res, next) {
  console.log(req.originalUrl)
  // Skip if user is accessing api
  if (req.params[0].slice(0, 5) === '/api/') next();
  else {
    if (baseURL === null && basehref === null) firstRun = true;

    defaultVars = { messages: req.flash('info'), session: req.session, basehref, title: null, originalUrl: req.originalUrl };
    if (settings.general.behindReverseProxy) {
      var uri  = req.headers.uri.replace(/(\/)+$/,'');
      var path = req.originalUrl.replace(/(\/)+$/,'');

      if (path === '') {
        baseURL = uri;
      } else {
        baseURL = uri.slice(0, uri.indexOf(path));
      }
      basehref = req.headers.hostpath + baseURL + '/';
    } else {
      baseURL  = '';
      basehref = baseURL + '/';
    }

    if (firstRun) {
      firstRun = false;
      if (settings.general.behindReverseProxy) {
        res.redirect(req.headers.uri.replace(/(\/)+$/,''));
      } else {
        res.redirect(req.originalUrl);
      }
    } else {
      next();
    }
  }
});

app.use('/', index);
app.use('/new', newRoute);
app.use('/view', view);
app.use('/edit', edit);
app.use('/delete', delRoute);
app.use('/api', api);

// production error handler
// no stacktraces leaked to user
app.use(function(req, res, next) {
  res.redirect(baseURL + '/');
});

app.use(function(err, req, res, next) {
  //res.status(err.status || 500);
  res.send(err.stack);
});

module.exports = {
  server,
  app
};

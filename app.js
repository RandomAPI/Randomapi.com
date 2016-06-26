const express      = require('express');
const path         = require('path');
const favicon      = require('serve-favicon');
const cookieParser = require('cookie-parser')();
const bodyParser   = require('body-parser');
const http         = require('http');
const flash        = require('connect-flash');
const compress     = require('compression');
const cors         = require('cors');
const debug        = require('debug')('RandomAPI:server');
const app          = express();
const server       = http.createServer(app);
const _            = require('lodash');
const logger       = require('./utils').logger;
const settings     = require('./utils').settings;

const User = require('./models/User');
const Tier = require('./models/Tier');

// Redis Session Store
const session      = require('express-session');
const redisStore   = require('connect-redis')(session);

// Initialize generators and list/api caches
const GeneratorForker = require('./api/0.1/GeneratorForker');
let Generators = {};

Object.keys(settings.generators).forEach(generator => {
  Generators[generator] = new Array(settings.generators[generator].count).fill().map((k, v) => {
    return new GeneratorForker({
      name: generator,
      execTime: settings.generators[generator].execTime,
      results: settings.generators[generator].results
    });
  });
});

// Store Generators in app
app.set("Generators", Generators);

// view engine setup
app.set('views', path.join(__dirname, '.viewsMin/pages'));
app.set('view engine', 'ejs');
app.set('port', settings.general.port);

// CORS and GZIP
app.use(cors());
app.use(compress());

// Session store
app.use(cookieParser);
let sessionSettings = {
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
app.use(bodyParser.json({limit: '8mb'}));
app.use(bodyParser.urlencoded({ limit: '8mb', extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Determine relative URLs (behindProxy)
let baseURL     = null;  // For redirects
let basehref    = null;  // For relative JS and CSS in pages
let defaultVars = {};    // Default vars to send into views
let firstRun    = false;

app.use('*', (req, res, next) => {
  // Skip if user is accessing api
  if (req.params[0].slice(0, 5) === '/api/') next();
  else {
    if (baseURL === null && basehref === null) firstRun = true;

    defaultVars = {messages: req.flash('info'), session: req.session, basehref, title: null, originalUrl: req.originalUrl };
    if (settings.general.behindReverseProxy) {
      let uri  = req.headers.uri.replace(/(\/)+$/,'');
      let path = req.originalUrl.replace(/(\/)+$/,'');

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

    app.set('defaultVars', defaultVars);

    if (firstRun) {
      firstRun = false;
      app.set('baseURL', baseURL);
      app.set('basehref', basehref);
      if (settings.general.behindReverseProxy) {
        res.redirect(baseURL + req.params[0]);
      } else {
        res.redirect(req.originalUrl);
      }
    } else {
      if (req.session.loggedin) {
        User.getCond({username: req.session.user.username}).then(data => {
          if (data === null) {
            delete req.session.loggedin;
            res.redirect(baseURL + '/logout');
            return;
          }
          Tier.getCond({id: data.tierID}).then(tier => {
            if (data === null) {
              delete req.session.loggedin;
              res.redirect(baseURL + '/logout');
            } else {
              req.session.user = data;
              req.session.tier = tier;
              next();
            }
          });
        });
      } else {
        next();
      }
    }
  }
});

// Routes
app.use('/', require('./routes/index'));
app.use('/charge', require('./routes/charge'));
app.use('/new', require('./routes/new'));
app.use('/view', require('./routes/view'));
app.use('/edit', require('./routes/edit'));
app.use('/delete', require('./routes/delete'));
app.use('/api', require('./routes/api'));

// production error handler
// no stacktraces leaked to user
app.use((req, res, next) => {
  res.redirect(baseURL + '/');
});

app.use((err, req, res, next) => res.send(err.stack));

module.exports = {
  server,
  app
};

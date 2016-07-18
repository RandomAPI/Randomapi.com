const express      = require('express');
const path         = require('path');
const favicon      = require('serve-favicon');
const cookieParser = require('cookie-parser')();
const bodyParser   = require('body-parser');
const http         = require('http');
const flash        = require('connect-flash');
const compress     = require('compression');
const cors         = require('cors');
const filesize     = require('filesize');
const debug        = require('debug')('RandomAPI:server');
const app          = express();
const server       = http.createServer(app);
const _            = require('lodash');
const logger       = require('./utils').logger;
const settings     = require('./utils').settings;

const User = require('./models/User');
const Tier = require('./models/Tier');
const Subscription = require('./models/Subscription');

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

// Cache removers
app.set("removeList", list => {
  Object.keys(settings.generators).forEach(generator => {
    Generators[generator].forEach(generator => {
      generator.removeList(list);
    });
  });
});

app.set("removeSnippet", snippet => {
  Object.keys(settings.generators).forEach(generator => {
    Generators[generator].forEach(generator => {
      generator.removeSnippet(snippet);
    });
  });
});
/////////////////

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
app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

let defaultVars = {};    // Default vars to send into views

app.use('*', (req, res, next) => {
  // Skip if user is accessing api
  if (req.params[0].slice(0, 5) === '/api/') next();
  else {
    let info = req.flash('info');
    let warning = req.flash('warning');

    if (info.length) {
      messages = ["info", info];
    } else if (warning.length) {
      messages = ["warning", warning];
    } else {
      messages = "";
    }

    app.set('baseURL', settings.general.baseURL);
    app.set('basehref', settings.general.basehref);

    defaultVars = {filesize, messages, session: req.session, recaptcha: settings.recaptcha.siteKey, publishableKey: settings.stripe.publishableKey, basehref: settings.general.basehref, title: null, originalUrl: req.originalUrl };
    app.set('defaultVars', defaultVars);
    if (req.session.loggedin) {
      User.getCond({username: req.session.user.username}).then(user => {
        if (user === null) {
          delete req.session.loggedin;
          res.redirect(settings.general.baseURL + '/logout');
          return;
        }
        Tier.getCond({id: user.tierID}).then(tier => {
          Subscription.getCond({uid: user.id}).then(subscription => {
            req.session.user = user;
            req.session.tier = tier;
            req.session.subscription = subscription;
            next();
          });
        });
      });
    } else {
      next();
    }
  }
});

// Routes
app.use('/', require('./routes/index'));
app.use('/ajax', require('./routes/ajax'));
app.use('/code', require('./routes/code'));
app.use('/publish', require('./routes/publish'));
app.use('/charge', require('./routes/charge'));
app.use('/new', require('./routes/new'));
app.use('/view', require('./routes/view'));
app.use('/edit', require('./routes/edit'));
app.use('/delete', require('./routes/delete'));
app.use('/api', require('./routes/api'));
app.use('/settings', require('./routes/settings'));

// production error handler
// no stacktraces leaked to user
app.use((req, res, next) => {
  res.sendStatus(404);
});

app.use((err, req, res, next) => res.send(err.stack));

module.exports = {
  server,
  app
};

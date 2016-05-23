var fs      = require('fs');
var os      = require('os');
var moment  = require('moment');
var cookie       = require('cookie');
var redis        = require('redis');
var sessionDB = redis.createClient();
var server  = require('./app').server;
var app     = require('./app').app;

var GeneratorForker = require('./api/0.1/GeneratorForker');

// Global Generators
Generators = {
  basic:     new Array(1).fill().map((k, v) => new GeneratorForker({name: 'basic_' + v, execTime: 1, memory: 5, results: 25})),
  standard:  new Array(2).fill().map((k, v) => new GeneratorForker({name: 'standard_' + v, execTime: 5, memory: 10, results: 250})),
  premium:   new Array(3).fill().map((k, v) => new GeneratorForker({name: 'premium_' + v, execTime: 10, memory: 25, results: 2500})),
  realtime:  new Array(3).fill().map((k, v) => new GeneratorForker({name: 'realtime_' + v, execTime: 1, memory: 1, results: 1})),
  speedtest: new Array(1).fill().map((k, v) => new GeneratorForker({name: 'speedtest_' + v, execTime: 5, memory: 5, results: 0}))
};

pad = function(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};

logger = function(msg) {
  if (typeof log === 'undefined') {
    log = {
      log: console.log
    };
  }
  // Clear log
  if (msg === true) {
    for (var i = 0; i < 10; i++) {
      log.log('');
    }
    log.logLines = [];
  } else {
    log.log(moment().format('LTS') + ' - ' + msg);
  }
};

// GUI - can be commented out if not required or too much overhead
require('./console.js');

require('./sockets.js');

io.use(function(socket, next) {
  var data = socket.handshake || socket.request;
  var sessionID = cookie.parse(data.headers.cookie)[settings.session.key].slice(2, 34);
  sessionDB.get('sess:' + sessionID, function(err, session) {
    socket.session = session;
    next();
  });
});

io.on('connection', function(socket) {
  socket.on('lintCode', function(msg){
    Generators.realtime[0].lint(msg, {user: socket.session.user}, function(data) {
      socket.emit('codeLinted', data);
    });
  });
});

// io.use(function(socket, next) {
//   logger("CONNECTED");
//   var data = socket.handshake || socket.request;
//   var sessionID = cookie.parse(data.headers.cookie)[settings.session.key].slice(2, 34);
//   sessionDB.get('sess:' + sessionID, function(err, session) {
//     socket.session = session;
//     next();
//   });

//   io.on('blah', function(socket) {
//     logger("BLAH");
//     console.log(socket);
//     socket.emit('blahback', {a: 123});
//   });
// });

server.listen(app.get('port'));
server.on('error', error => {
  var bind = app.get('port');
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
});

server.on('listening', () => {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  logger('Listening on ' + bind);
});
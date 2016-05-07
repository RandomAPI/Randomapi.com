var fs     = require('fs');
var async  = require('async');
var server = require('./app').server;
var app    = require('./app').app;

Generators       = {};
availableFuncs  = {};

// Load in all generators and datasets before starting the server
// Scan api folder for available versions
var versions = fs.readdirSync('./sandBox').filter(dir => ['.DS_Store', '.nextRelease'].indexOf(dir) === -1);

async.forEachOf(versions, (value, key, callback) => {
    Generators[value]      = require('./sandBox/' + value + '/Generator');
    availableFuncs[value] = fs.readFileSync('./sandBox/' + value + '/availableFuncs.js', 'utf8');
    callback();
}, function(err, results) {
    var gKeys = Object.keys(Generators);
    console.log("Loaded " + gKeys.length + " generator" + (gKeys.length == 1 ? "" : "s") + ".");
    startServer();
});

function startServer() {
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
    console.log('Listening on ' + bind);
  });

  // // Client limit reset
  // setInterval(() => {
  //   var offenders = {};
  //   Object.keys(clients).forEach(client => {
  //     if (clients[client] >= settings.limit) {
  //         offenders[client] = clients[client];
  //     }
  //   });
  //   if (Object.keys(offenders).length > 0) console.log(offenders);

  //   clients = {};
  //   global.gc();
  // }, settings.resetInterval);
}
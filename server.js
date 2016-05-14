var fs     = require('fs');
var async  = require('async');
var server = require('./app').server;
var app    = require('./app').app;
var GeneratorForker = require('./api/0.1/GeneratorForker');

Generators = {
  basic:    new Array(1).fill().map(() => new GeneratorForker({execTime: 1, memory: 5, results: 25})),
  //standard: new Array(3).fill().map(() => new GeneratorForker({execTime: 5, memory: 10, results: 250})),
  //premium:  new Array(5).fill().map(() => new GeneratorForker({execTime: 10, memory: 25, results: 2500}))
};
startServer();

// Generators['basic'] =
/*
// Load in all generators and datasets before starting the server
// Scan api folder for available versions
var versions = fs.readdirSync('./api').filter(dir => ['.DS_Store', '.nextRelease'].indexOf(dir) === -1);

async.forEachOf(versions, (value, key, callback) => {
    Generators[value]     = require('./api/' + value + '/Generator');
    callback();
}, function(err, results) {
    var gKeys = Object.keys(Generators);
    console.log("Loaded " + gKeys.length + " generator" + (gKeys.length == 1 ? "" : "s") + ".");
    startServer();
});
*/

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
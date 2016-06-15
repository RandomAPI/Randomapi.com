const cookie    = require('cookie');
const redis     = require('redis');
const sessionDB = redis.createClient();
const pad       = require('./utils').pad;
const logger    = require('./utils').logger;

const server = require('./app').server;
const app    = require('./app').app;

// GUI - can be commented out if not required or too much overhead
//require('./console.js');
require('./sockets.js');

// Attach db reference to app
// Conenct to database
const db = require('./models/db');
app.set('db', db);

server.listen(app.get('port'));
server.on('error', error => {
  let bind = app.get('port');
  switch (error.code) {
    case 'EACCES':
      logger('[server]: ' + bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger('[server]: ' + bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
});

server.on('listening', () => {
  let addr = server.address();
  let bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  logger('[server]: Listening on ' + bind);
});

const cookie     = require('cookie');
const pad        = require('./utils').pad;
const logger     = require('./utils').logger;
const sessionDB  = require('./utils').redis;

const server = require('./app').server;
const app    = require('./app').app;

const GUI = true;

const db = require('./models/db').init(() => {

  // GUI - can be commented out if not required or too much overhead
  if (GUI) require('./console.js');
  require('./sockets.js');

  server.listen(app.get('port'));
  server.on('error', error => {
    let bind = app.get('port');
    switch (error.code) {
      case 'EACCES':
        logger(`[server]: ${bind} requires elevated privileges`);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        logger(`[server]: ${bind} is already in use`);
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
    logger(`[server]: Listening on ${bind}`);
  });

  process.title = "RandomAPI_Server";
});

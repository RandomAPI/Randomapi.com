const mysql    = require('mysql');
const settings = require('../utils').settings;
const logger   = require('../utils').logger;

var connection = mysql.createConnection({
  host:       settings.db.host,
  socketPath: settings.db.socketPath,
  database:   settings.db.database,
  user:       settings.db.username,
  password:   settings.db.password
});

module.exports.init = function(cb) {

  connection.connect(err => {
    if (err) {
      logger('[db]: error connecting: ' + err.stack);
      return;
    }
    logger('[db]: connected as id ' + connection.threadId);
    cb();
  });

  // Keep connection alive
  setInterval(() => {
      connection.query('SELECT 1');
  }, settings.db.keepAliveInterval);
};

module.exports.connection = connection;

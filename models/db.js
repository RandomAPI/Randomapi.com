const mysql    = require('mysql');
const settings = require('../settings.json');
const logger   = require('../utils').logger;

const connection = mysql.createConnection({
  host:       settings.db.host,
  socketPath: settings.db.socketPath,
  database:   settings.db.database,
  user:       settings.db.username,
  password:   settings.db.password
});

connection.connect(err => {
  if (err) {
    logger('[db]: error connecting: ' + err.stack);
    return;
  }
  logger('[db]: connected as id ' + connection.threadId);
});

// Keep connection alive
setInterval(function () {
    connection.query('SELECT 1');
}, settings.db.keepAliveInterval);

module.exports = connection;

const mysql    = require('mysql2');
const settings = require('../settings.json');
const logger   = require('../utils').logger;

const connection = mysql.createConnection({
  host:     settings.db.host,
  database: settings.db.database,
  user:     settings.db.username,
  password: settings.db.password
});

connection.connect(err => {
  if (err) {
    logger('[db]: error connecting: ' + err.stack);
    return;
  }
  logger('[db]: connected as id ' + connection.connectionId);
});

module.exports = connection;

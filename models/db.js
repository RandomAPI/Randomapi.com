const mysql    = require('mysql');
const settings = require('../utils').settings;
const logger   = require('../utils').logger;

let db = settings.db.prod;

if (process.env.spec === "true") {
  db = settings.db.spec
}

var connection = mysql.createPool({
  connectionLimit: 10,
  host:       db.host,
  socketPath: db.socketPath,
  database:   db.database,
  user:       db.username,
  password:   db.password,
  charset: "UTF8_UNICODE_CI"
});

module.exports.init = function(cb) {

  connection.on('connection', connection => {
    logger('[db]: connected as id ' + connection.threadId);
    cb();
  });

  // Keep connection alive
  setInterval(() => {
      connection.query('SELECT 1');
  }, db.keepAliveInterval);
};

module.exports.connection = connection;

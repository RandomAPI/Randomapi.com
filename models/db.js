const mysql    = require('mysql');
const settings = require('../utils').settings;
const logger   = require('../utils').logger;
const dbStatus = require('../utils').dbStatus;

let db = settings.db.prod;
let initDone = false;

if (process.env.spec === "true") {
  db = settings.db.spec
}

var pool = mysql.createPool({
  connectionLimit: 10,
  host:       db.host,
  socketPath: db.socketPath,
  database:   db.database,
  user:       db.username,
  password:   db.password,
  charset: "UTF8_UNICODE_CI"
});

module.exports.init = function(cb) {

  pool.on('connection', connection => {
    logger('[db]: connected as id ' + connection.threadId);

    if (!initDone) {
      initDone = true;
      cb();
    }
  });

  pool.getConnection((err, connection) => {
    if (err) {
      return dbStatus(false);
    }
      connection.query('SELECT 1', [], () => {
        dbStatus(true);
        connection.release();
      });
    });

  // Keep connection alive
  setInterval(() => {
    pool.getConnection((err, connection) => {
      if (err) {
        return dbStatus(false);
      }
      connection.query('SELECT 1', [], () => {
        dbStatus(true);
        connection.release();
      });
    });
  }, db.keepAliveInterval);
};

module.exports.connection = {
  query: function () {
    let queryArgs = Array.prototype.slice.call(arguments),
        events = [],
        eventNameIndex = {};

    pool.getConnection((err, conn) => {
        if (err) {
            if (eventNameIndex.error) {
                eventNameIndex.error();
            }
        }
        if (conn) {
            let q = conn.query.apply(conn, queryArgs);
            q.on('end', () => {
                conn.release();
            });

            events.forEach(args => {
                q.on.apply(q, args);
            });
        }
    });

    return {
        on: function (eventName, callback) {
            events.push(Array.prototype.slice.call(arguments));
            eventNameIndex[eventName] = callback;
            return this;
        }
    };
  },
  escape: val => pool.escape(val)
};

//module.exports.connection = connection;

const moment   = require('moment');
const _        = require('lodash');
const redis    = require('redis').createClient();
const settings = require('./settings.json');
const stripe   = require("stripe")(settings.stripe.key);

redis.on('error',function(err){ module.exports.logger(err)})
module.exports = {
  pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  },
  logger(msg) {
    if (typeof log === 'undefined') {
      log = {
        log: console.log
      };
    }
    // Clear log
    if (msg === true) {
      for (let i = 0; i < 10; i++) {
        log.log('');
      }
      log.logLines = [];
    } else {
      log.log(moment().format('LTS') + ' - ' + msg);
    }
  },
  random(mode, length) {
    let result = '';
    let chars;

    if (mode === 1) {
      chars = 'abcdef1234567890';
    } else if (mode === 2) {
      chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    } else if (mode === 3) {
      chars = '0123456789';
    } else if (mode === 4) {
      chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    } else if (mode === 5) {
      chars = 'abcdefghijklmnopqrstuvwxyz1234567890';
    } else if (mode === 6) {
      chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    }

    for (let i = 0; i < length; i++) {
      result += chars[module.exports.range(0, chars.length - 1)];
    }

    return result;
  },
  range(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  andify(cond) {
    const db = require('./models/db').connection;
    var formatted = "";
    if (Object.keys(cond).length > 1) {
      _.each(cond, function(value, key) {
        formatted += "`" + key + "` = " + db.escape(value) + " AND ";
      });
      return {query: formatted.slice(0, -5)};
    } else {
      return cond;
    }
  },
  redis,
  stripe
};

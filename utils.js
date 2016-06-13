const moment = require('moment');

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
  }
};

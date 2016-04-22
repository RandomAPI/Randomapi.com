var deasync = require('deasync');
var fs = require('fs');
var crypto = require('crypto');
require('../../../models/db');
var List    = require('../../../models/List');
var lookupList = deasync(List.getListByRef);
var listResults = {};

var funcs = {
  random: {
    numeric: function(a, b) {
      return range(a, b);
    },
    special: function(mode, length) {
      return random(mode, length);
    }
  },
  list: function(obj) {
    if (Array.isArray(obj)) {
      return obj[range(0, obj.length-1)];
    } else {
      if (obj in listResults) {
        return randomItem(listResults[obj]);
      } else {
        var res = lookupList(obj);
        listResults[obj] = fs.readFileSync(process.cwd() + '/data/lists/' + res.id + '.list', 'utf8').split('\n');
        return randomItem(listResults[obj]);
      }
    }
  },
  hash: {
    md5: function(val) {
      return crypto.createHash('md5').update(String(val)).digest('hex');
    },
    sha1: function(val) {
      return crypto.createHash('sha1').update(String(val)).digest('hex');
    },
    sha256: function(val) {
      return crypto.createHash('sha256').update(String(val)).digest('hex');
    }
  },
  String: function(val) {
    return String(val);
  },
  timestamp: function() {
    return Math.floor(new Date().getTime()/1000);
  }
};

function randomItem(list) {
  return list[range(0, list.length-1)];
}

function random(mode, length) {
  var result = '';
  var chars;

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
  }

  for (var i = 0; i < length; i++) {
      result += chars[range(0, chars.length-1)];
  }

  return result;
}

function range(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = funcs;

var deasync   = require('deasync');
var fs        = require('fs');
var crypto    = require('crypto');
var mersenne  = require('mersenne');
mersenne.seed(MERSENNE_SEED);

// Connect to Mongo
require(process.cwd() + '/models/db');

var List        = require(process.cwd() + '/models/List');
var lookupList  = List.getListByRef;
var listResults = {}; // Hold cache of list results

var funcs = {
  random: {
    numeric: function(a, b) {
      return range(a, b);
    },
    special: function(mode, length) {
      return random(mode, length);
    }
  },
  list: function(obj, num) {
    if (num !== "" && num !== undefined) num = Number(num); // Convert string to num if it isn't undefined
    if (num === "") num = undefined;

    if (Array.isArray(obj)) {
      if (num !== undefined) {
        return obj[num-1];
      } else {
        return obj[range(0, obj.length-1)];
      }
    } else {
      if (!(obj in listResults)) {
        var res = lookupList(obj);
        if (res !== null) {
          listResults[obj] = fs.readFileSync(process.cwd() + '/data/lists/' + res.id + '.list', 'utf8').split('\n');
        } else {
          listResults[obj] = [undefined];
          throw 'INVALID_LIST' + String(obj + "|" + num);
        }
      }

      if (num !== undefined) {
        return listResults[obj][num-1];
      } else {
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
  } else if (mode === 6) {
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  }

  for (var i = 0; i < length; i++) {
      result += chars[range(0, chars.length - 1)];
  }

  return result;
}

function randomItem(arr) {
  return arr[range(0, arr.length-1)];
}

function range(min, max) {
  return min + mersenne.rand(max-min+1);
}

module.exports = funcs;
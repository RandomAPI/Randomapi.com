const _          = require('lodash');
const cookie     = require('cookie');
const sessionDB  = require('./utils').redis;
const settings   = require('./utils').settings;
const io         = require('socket.io')(settings.general.socket);
const app        = require('./app').app;
const Generators = app.get('Generators');

const Snippet = require('./models/Snippet');
const Version = require('./models/Version');

const abuseLimit = 20;
let abuseCache   = {};
let timeout      = {};

function checkAbuse(id) {
  // abuse is considered <abuseLimit> requests per second from same socket
  // Block further requests until until 5 seconds have passed without another barrage

  if (!(id in abuseCache)) {
    abuseCache[id] = {
      firstAccess: new Date().getTime(),
      lastAccess:  new Date().getTime(),
      total: 1
    };

  // Update current stats
  } else {
    abuseCache[id].lastAccess = new Date().getTime();
    abuseCache[id].total++;
  }

  // Check for abuse
  if (abuseCache[id] && abuseCache[id].total > abuseLimit && abuseCache[id].lastAccess - abuseCache[id].firstAccess < 1000) {
    timeout[id] = new Date().getTime(); // time they were placed into time out
    return true;
  }

  if (id in timeout) {
    return true;
  }
  return false;
}

function checkTimeout() {
  _.each(timeout, (a, b) => {
    if (new Date().getTime() - a > 1000) {
      delete timeout[b];
    }
  });
}

// Reset abuse cache every second
setInterval(() => {
  abuseCache = {};
}, 1000);

setInterval(checkTimeout, 2500);

// Attach the user's session to the socket object
// If user isn't logged in, set session to null for front page demo
io.use((socket, next) => {
  let data = socket.handshake || socket.request;
  try {
    let sessionID = cookie.parse(data.headers.cookie)[settings.session.key].slice(2, 34);
    sessionDB.get('sess:' + sessionID, (err, session) => {
      if (err) console.log(err);
      socket.session = session;
      next();
    });
  } catch(e) {
    socket.session = null;
    next();
  }
});

io.on('connection', socket => {

  // Search
  socket.on('search', msg => {
    if (checkAbuse(socket.id)) return socket.emit('abuse');

    let tags = _.uniq(msg.query.slice(0, 255).split(',').map(tag => tag.trim()).filter(tag => tag !== "")).filter(tag => tag.match(/^([a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{1,32})$/g) !== null);
    Snippet.search(tags).then(data => {
      let obj = data.reduce(function(o, v, i) {
        o[v.id] = v;
        return o;
      }, {});
      socket.emit('searchResults', obj);
    });
  });

  // Snippet info
  socket.on('snippet', msg => {
    if (checkAbuse(socket.id)) return socket.emit('abuse');

    Version.getCond({snippetID: msg.id}).then(snippet => {
      Snippet.getCond({['s.id']: snippet.snippetID}).then(orig => {
        if (snippet === null) {
          socket.emit('snippetResults', null);
        } else if (snippet.published === 0) {
          Version.getVersion(orig.ref, snippet.version-1).then(ver => {
            socket.emit('snippetResults', ver)
          });
        } else {
          socket.emit('snippetResults', snippet)
        }
      });
    });
  });

  // Generators
  socket.on('lintCode', msg => {
    if (checkAbuse(socket.id)) return socket.emit('abuse');

    msg.code = String(msg.code).slice(0, 8192);
    let shortest = Math.floor(Math.random() * Generators.realtime.length);
    for (let i = 0; i < Generators.realtime.length; i++) {
      if (Generators.realtime[i].queueLength() < Generators.realtime[shortest].queueLength()) {
        shortest = i;
      }
    }

    // Check if chosen Generator has crashed and is in middle of restarting
    if (!Generators.realtime[shortest].generator.connected) {
      socket.emit('codeLinted', {error: {formatted: "Something bad has happened...please try again later."}, results: [], fmt: null});
    } else {
      // Don't pass along ref/owner info if from front page demo
      if (JSON.parse(socket.session).loggedin === undefined) {
        Generators.realtime[shortest].queue.push({socket, data: {src: msg.code, ref: null, owner: 'demo', type: 'lint'}});
      } else {
        Generators.realtime[shortest].queue.push({socket, data: {src: msg.code, ref: msg.ref, owner: JSON.parse(socket.session).user, type: 'lint', uri: msg.uri}});
      }
    }
  });

  socket.on('lintDemoCode', msg => {
    if (checkAbuse(socket.id)) return socket.emit('abuse');

    msg.code = String(msg.code).slice(0, 8192);
    let shortest = Math.floor(Math.random() * Generators.demo.length);
    for (let i = 0; i < Generators.demo.length; i++) {
      if (Generators.demo[i].queueLength() < Generators.demo[shortest].queueLength()) {
        shortest = i;
      }
    }

    // Check if chosen Generator has crashed and is in middle of restarting
    if (!Generators.demo[shortest].generator.connected) {
      socket.emit('codeLinted', {error: {formatted: "Something bad has happened...please try again later."}, results: [], fmt: null});
    } else {
      // Don't pass along ref/owner info if from front page demo
      if (JSON.parse(socket.session).loggedin === undefined) {
        Generators.demo[shortest].queue.push({socket, data: {src: msg.code, ref: null, owner: 'demo', type: 'demo'}});
      } else {
        Generators.demo[shortest].queue.push({socket, data: {src: msg.code, ref: msg.ref, owner: JSON.parse(socket.session).user, type: 'demo'}});
      }
    }
  });

  socket.on('lintSnippetCode', msg => {
    if (checkAbuse(socket.id)) return socket.emit('abuse');

    msg.code = String(msg.code).slice(0, 8192);
    let shortest = Math.floor(Math.random() * Generators.realtime.length);
    for (let i = 0; i < Generators.realtime.length; i++) {
      if (Generators.realtime[i].queueLength() < Generators.realtime[shortest].queueLength()) {
        shortest = i;
      }
    }

    // Check if chosen Generator has crashed and is in middle of restarting
    if (!Generators.realtime[shortest].generator.connected) {
      socket.emit('codeLinted', {error: {formatted: "Something bad has happened...please try again later."}, results: [], fmt: null});
    } else {
      // Don't pass along ref/owner info if from front page demo
      if (JSON.parse(socket.session).loggedin === undefined) {
        Generators.realtime[shortest].queue.push({socket, data: {src: msg.code, ref: null, owner: 'demo', type: 'snippet'}});
      } else {
        Generators.realtime[shortest].queue.push({socket, data: {src: msg.code, ref: msg.ref, owner: JSON.parse(socket.session).user, type: 'snippet'}});
      }
    }
  });
});

module.exports = io;

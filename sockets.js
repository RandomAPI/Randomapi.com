const _          = require('lodash');
const cookie     = require('cookie');
const sessionDB  = require('./utils').redis;
const settings   = require('./utils').settings;
const io         = require('socket.io')(settings.general.socket);
const app        = require('./app').app;
const Generators = app.get('Generators');

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
  socket.on('lintCode', msg => {
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
      if (socket.session === null) {
        Generators.realtime[shortest].queue.push({socket, data: {src: msg.code, ref: null, owner: null}});
      } else {
        Generators.realtime[shortest].queue.push({socket, data: {src: msg.code, ref: msg.ref, owner: JSON.parse(socket.session).user}});
      }
    }
  });
});

module.exports = io;

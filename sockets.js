const _          = require('lodash');
const cookie     = require('cookie');
const redis      = require('redis');
const sessionDB  = redis.createClient();
const settings   = require('./settings.json');
const io         = require('socket.io')(settings.general.socket);
const app        = require('./app').app;
const Generators = app.get('Generators');

io.use((socket, next) => {
  let data = socket.handshake || socket.request;
  let sessionID = cookie.parse(data.headers.cookie)[settings.session.key].slice(2, 34);
  sessionDB.get('sess:' + sessionID, (err, session) => {
    socket.session = session;
    next();
  });
});

io.on('connection', socket => {
  socket.on('lintCode', msg => {
    Generators.realtime[0].queue.push({socket, data: {src: msg.code, apikey: JSON.parse(socket.session).user.key}});
  });
});

module.exports = io;

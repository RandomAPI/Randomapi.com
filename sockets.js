module.exports = function(cookie, sessionDB) {
  io.use(function(socket, next) {
    var data = socket.handshake || socket.request;
    var sessionID = cookie.parse(data.headers.cookie)[settings.session.key].slice(2, 34);
    sessionDB.get('sess:' + sessionID, function(err, session) {
      socket.session = session;
      next();
    });
  });

  io.on('connection', function(socket) {
    socket.on('lintCode', function(msg){
      Generators.realtime[0].lint(msg, {user: socket.session.user}, function(data) {
        socket.emit('codeLinted', data);
      });
    });
  });
};

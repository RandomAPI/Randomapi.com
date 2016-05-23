module.exports = (function() {
  logger("BLAH");
  io.on('blah', function(socket) {
    logger("BLAH");
    console.log(socket);
    socket.emit('blahback', {a: 123});
  });
})();

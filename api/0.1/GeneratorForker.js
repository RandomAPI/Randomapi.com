var fork = require('child_process').fork;
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var GeneratorForker = function(options) {
  var self = this;

  this.limits = {
    execTime: options.execTime,
    memory:   options.memory,
    results:  options.results
  };

  this.startTime = new Date().getTime();
  this.jobCount  = 0;

  this.fork();
};

util.inherits(GeneratorForker, EventEmitter);

GeneratorForker.prototype.fork = function() {
  var self = this;

  // Fork new Generator with provided limits
  this.generator = fork(__dirname + '/Generator', [JSON.stringify(this.limits)]);

  this.generator.on('message', m => {
    // Requesting API Lookup
    if (m.type === "API") {
      this.generator.send({type: 'API_RESPONSE', content: API.getAPIByRef(m.ref)});
    } else if (m.type === "USER") {
      this.generator.send({type: 'USER_RESPONSE', content: User.getByID(m.id)});
    } else if (m.type === "DONE") {
      self.emit('DONE', m.content);
    }
  });
};

GeneratorForker.prototype.send = function(msg) {
  this.generator.send(msg);
};

GeneratorForker.prototype.generate = function(opts, cb) {
  var self = this;
  this.generator.send({
    type: "task",
    options: opts
  });

  this.once('DONE', data => {
    cb(data.data);
  });
};

module.exports = GeneratorForker;

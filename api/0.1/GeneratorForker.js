var fork  = require('child_process').fork;
var util  = require('util');
var async = require('async');
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
  this.queue = async.queue(function (task, callback) {
    console.log("Current queue length: " + self.queue.length());
    var ref;
    if (task.req.params.ref === undefined) {
      ref = task.req.query.ref;
    } else {
      ref = task.req.params.ref;
    }
    _.merge(task.req.query, {ref});
    self.generate(task.req.query, function(data) {
      task.res.setHeader('Content-Type', 'application/json');
      task.res.send(data);
      callback();
    });
  }, 1);

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
    } else if (m.type === "LIST") {
      this.generator.send({type: 'LIST_RESPONSE', content: List.getListByRef(m.ref)});
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

GeneratorForker.prototype.queueLength = function() {
  return this.queue.length();
};

module.exports = GeneratorForker;

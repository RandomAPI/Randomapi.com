'use strict'
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

  this.name = options.name;
  this.startTime = new Date().getTime();
  this.jobCount = 0;

  // Queue to push generate requests into
  this.queue = async.queue(function(task, callback) {
    if (task.speedtest) {
      self.speedTest({ref: task.ref}, task.time, function(data) {
        task.cb(data)
        callback();
      });
    } else {
      var ref;
      if (task.req.params.ref === undefined) {
        ref = task.req.query.ref;
      } else {
        ref = task.req.params.ref;
      }
      _.merge(task.req.query, {ref});
      self.generate(task.req.query, function(data, fmt) {
        if (fmt === 'json') {
          task.res.setHeader('Content-Type', 'application/json');
        } else if (fmt === 'xml') {
          task.res.setHeader('Content-Type', 'text/xml');
        } else if (fmt === 'yaml') {
          task.res.setHeader('Content-Type', 'text/x-yaml');
        } else if (fmt === 'csv') {
          task.res.setHeader('Content-Type', 'text/csv');
        } else {
          task.res.setHeader('Content-Type', 'text/plain');
        }
        task.res.send(data);
        callback();
      });
    }
  }, 1);

  this.fork();
};

util.inherits(GeneratorForker, EventEmitter);

GeneratorForker.prototype.fork = function() {
  var self = this;

  // Fork new Generator with provided limits
  this.generator = fork(__dirname + '/Generator', [this.name, JSON.stringify(this.limits)]);

  this.generator.on('message', m => {
    // Requesting API Lookup
    if (m.type === 'API') {
      API.findOne({ref: m.ref}, function(err, doc) {
        self.generator.send({type: 'API_RESPONSE', content: doc});
      });
    } else if (m.type === 'USER') {
      User.findOne({id: m.id}, function(err, model) {
        self.generator.send({type: 'USER_RESPONSE', content: model});
      });
    } else if (m.type === 'LIST') {
      List.findOne({ref: m.ref}, function(err, doc) {
        self.generator.send({type: 'LIST_RESPONSE', content: doc});
      });
    } else if (m.type === 'DONE') {
      self.emit('DONE', {content: m.content.data, fmt: m.content.fmt});
    } else if (m.type === 'getMemory') {
      self.emit('getMemory', m.content);
    } else if (m.type === 'getLists') {
      self.emit('getLists', m.content);
    } else if (m.type === 'clearLists') {
      self.emit('clearLists', m.content);
    } else if (m.type === 'logger') {
      log.log(m.content);
    }
  });
};

GeneratorForker.prototype.send = function(msg) {
  this.generator.send(msg);
};

GeneratorForker.prototype.generate = function(opts, cb) {
  var self = this;

  if (this.jobCount++ % 100 === 0 && this.jobCount > 0) {
    // this.generator.send({
    //   type: 'command',
    //   content: 'gc'
    // });
  }

  this.generator.send({
    type: 'task',
    options: opts
  });

  this.once('DONE', data => {
    cb(data.content, data.fmt);
  });
};

GeneratorForker.prototype.speedTest = function(opts, num, cb) {
  this.jobCount++;
  _.merge(opts, {time: num});
  var self = this;

  this.generator.send({
    type: 'speedtest',
    options: opts
  });

  this.once('DONE', data => {
    cb(data.data);
  });
};

GeneratorForker.prototype.lint = function(code, user, cb) {
  this.jobCount++;
  this.generator.send({
    type: 'lint',
    code,
    user
  });

  this.once('DONE', data => {
    cb(data.data);
  });
};

GeneratorForker.prototype.gc = function() {
  this.generator.send({
    type: 'command',
    content: 'gc'
  });
};

GeneratorForker.prototype.queueLength = function() {
  return this.queue.length();
};

GeneratorForker.prototype.totalJobs = function() {
  return this.jobCount;
};

GeneratorForker.prototype.memUsage = function() {
  this.generator.send({
    type: 'command',
    content: 'getMemory'
  });
  var memory, done = false;
  this.once('getMemory', data => {
    memory = data;
    done = true;
  });

  require('deasync').loopWhile(function(){return !done;});
  return Math.floor(memory/1024/1024);
};

GeneratorForker.prototype.getCacheSize = function() {
  this.generator.send({
    type: 'command',
    content: 'getLists'
  });
  var lists, done = false;
  this.once('getLists', data => {
    lists = data;
    done = true;
  });

  require('deasync').loopWhile(function(){return !done;});
  return lists;
};

GeneratorForker.prototype.clearLists = function() {
  this.generator.send({
    type: 'command',
    content: 'clearLists'
  });
};

module.exports = GeneratorForker;

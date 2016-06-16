'use strict'
const fork    = require('child_process').fork;
const util    = require('util');
const async   = require('async');
const _       = require('lodash');
const EventEmitter = require('events').EventEmitter;
const logger  = require('../../utils').logger;

const API  = require('../../models/API');
const List = require('../../models/List');
const User = require('../../models/User');

const GeneratorForker = function(options) {
  let self = this;

  this.limits = {
    execTime: options.execTime,
    memory:   options.memory,
    results:  options.results
  };

  this.name      = options.name;
  this.startTime = new Date().getTime();
  this.jobCount  = 0;

  // Queue to push generate requests into
  this.queue = async.queue((task, callback) => {
    self.jobCount++;

    // Realtime or Speedtest
    if (task.socket !== undefined) {
      self.generate({mode: 'lint', options: {apikey: task.data.apikey, src: task.data.src}}, (err, results, fmt) => {
        if (results.length > 4096) {
          results = "Output has been truncated\n---------------\n" + results.slice(0, 4096);
        }
        task.socket.emit('codeLinted', results);
        callback();
      });
    } else {
      let ref;
      if (task.req.params.ref === undefined) {
        ref = task.req.query.ref;
      } else {
        ref = task.req.params.ref;
      }
      _.merge(task.req.query, {ref});

      self.generate({mode: 'generate', options: task.req.query}, (err, results, fmt) => {
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
        task.res.send(results);
        callback();
      });
    }
  }, 1);

  this.fork();
};

util.inherits(GeneratorForker, EventEmitter);

GeneratorForker.prototype.fork = function() {
  let self = this;

  // Fork new Generator with provided limits
  this.generator = fork(__dirname + '/Generator', [this.name, JSON.stringify(this.limits)]);

  // Handle all events
  // {type, mode, data}
  this.generator.on('message', msg => {
    if (msg.type === 'lookup') {
      if (msg.mode === 'api') {
        API.getAPIByRef(msg.data).then(doc => {
          self.generator.send({type: 'response', mode: 'api', data: doc});
        });
      } else if (msg.mode === 'user') {
        User.getCond({id: msg.data}).then(doc => {
          self.generator.send({type: 'response', mode: 'user', data: doc});
        });
      } else if (msg.mode === 'list') {
        List.getListByRef(msg.data).then(doc => {
          self.generator.send({type: 'response', mode: 'list', data: doc});
        });
      }
    } else if (msg.type === 'done') {
      self.emit('taskFinished', {err: msg.data.err, data: msg.data.data, fmt: msg.data.fmt});
    } else if (msg.type === 'cmdComplete') {
      if (msg.mode === 'memory') {
        self.emit('memComplete', msg.content);
      } else if (msg.mode === 'lists') {
        self.emit('listsComplete', msg.content);
      }
    } else if (msg.type === 'ping') {
      this.generator.send({
        type: 'pong'
      });
    }
  });
};

// Opts contains options and mode
// cb(err, results, fmt)
GeneratorForker.prototype.generate = function(opts, cb) {
  let self = this;

  // Send generator a new task using the given mode and options
  this.generator.send({
    type: 'task',
    mode: opts.mode,
    data: opts.options
  });

  // Wait for the task to finish and then send err, results, and fmt to cb.
  this.once('taskFinished', data => {
    cb(data.err, data.data, data.fmt);
  });
};

// Get current task queue length
GeneratorForker.prototype.queueLength = function() {
  return this.queue.length();
};

GeneratorForker.prototype.totalJobs = function() {
  return this.jobCount;
};

GeneratorForker.prototype.memUsage = function() {
  this.generator.send({
    type: 'cmd',
    data: 'getMemory'
  });

  let memory, done = false;
  this.once('memComplete', data => {
    memory = data;
    done   = true;
  });

  require('deasync').loopWhile(function(){return !done;});
  return Math.floor(memory/1024/1024);
};

GeneratorForker.prototype.gc = function() {
  this.generator.send({
    type: 'cmd',
    data: 'gc'
  });
};

GeneratorForker.prototype.getCacheSize = function() {
  this.generator.send({
    type: 'cmd',
    data: 'getLists'
  });
  let lists, done = false;
  this.once('listsComplete', data => {
    lists = data;
    done  = true;
  });

  require('deasync').loopWhile(function(){return !done;});
  return lists;
};

GeneratorForker.prototype.clearLists = function() {
  this.generator.send({
    type: 'cmd',
    data: 'clearLists'
  });
};

module.exports = GeneratorForker;

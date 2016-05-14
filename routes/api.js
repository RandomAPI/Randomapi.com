var express = require('express');
var async   = require('async');
var spawn   = require('child_process').spawn;
var router  = express.Router();

var q = async.queue(function (task, callback) {
  console.log(q.length());
  var ref;
  if (task.req.params.ref === undefined) {
    ref = task.req.query.ref;
  } else {
    ref = task.req.params.ref;
  }
  _.merge(task.req.query, {ref});
  Generators.basic[0].generate(task.req.query, function(data) {
    task.res.setHeader('Content-Type', 'application/json');
    task.res.send(data);
    callback();
  });
}, 1);

router.get('/:ref?', function(req, res, next) {
  q.push({req, res});

  // try {
  //   var child = spawn('node', ['./api/0.1/index', JSON.stringify(req.query)]);
  //   var out = "";
  //   child.stdout.setEncoding('utf8');
  //   child.stdout.on('data', (data) => {
  //     out += data;
  //     if (data.indexOf('_API_CLOSE_') !== -1) {
  //       child.kill('SIGHUP');
  //     }
  //   });
  //   child.stdout.on('end', function () {
  //     res.setHeader('Content-Type', 'application/json');
  //     res.send(out.slice(out.indexOf('I am opened!')+13, out.indexOf('_API_CLOSE_')));
  //   });
  // } catch (e) {
  //   console.log(e);
  // }

  // try {
  //   var version = Generator.getByID(API.getAPIByRef(ref).generator).version;
  //   new Generators[version](req.query).generate(function(data, fmt) {
  //     res.setHeader('Content-Type', 'application/json');
  //     if (fmt === "json" && JSON.parse(data).error === true) {
  //       var data = JSON.parse(data);
  //       try {
  //         var trace = JSON.stringify(data.results[0]).match(/>:(\d+):(\d+)/).slice(1);
  //         res.send(`Error on line ${trace[0]-8} col ${trace[1]-0}: ${data.results[0].API_ERROR}`);
  //       } catch(e) {
  //         res.send(`Error ${data.results[0].API_ERROR}`);
  //       }
  //     } else {
  //       res.send(data);
  //     }
  //   });
  // } catch (e) {
  //   console.log(e.stack);
  //   res.setHeader('Content-Type', 'text/plain');
  //   res.status(403).send(e);
  // }
});

module.exports = router;
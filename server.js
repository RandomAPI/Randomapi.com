var fs      = require('fs');
var os      = require('os');
var async   = require('async');
var blessed = require('blessed');
var contrib = require('blessed-contrib');
var moment  = require('moment');
var _       = require('lodash');

var screen  = blessed.screen();
var grid = new contrib.grid({rows: 12, cols: 12, screen: screen});

var server = require('./app').server;
var app    = require('./app').app;

var GeneratorForker = require('./api/0.1/GeneratorForker');

// Global Generators
Generators = {
  basic:     new Array(1).fill().map(() => new GeneratorForker({execTime: 1, memory: 5, results: 25})),
  standard:  new Array(2).fill().map(() => new GeneratorForker({execTime: 5, memory: 10, results: 250})),
  premium:   new Array(3).fill().map(() => new GeneratorForker({execTime: 10, memory: 25, results: 2500})),
  realtime:  new Array(3).fill().map(() => new GeneratorForker({execTime: 1, memory: 1, results: 1})),
  speedtest: new Array(1).fill().map(() => new GeneratorForker({execTime: 5, memory: 5, results: 1000000}))
};

var types = ['basic', 'standard', 'premium'];

// For graphing stats
var queueStats = {};
var memStats = {};

// Shared bar options
var barOpts = {
  barWidth: 3,
  barSpacing: 1,
  xOffset: 0,
  maxHeight: 50
};

var bars = {
  basic: grid.set(0, 0, 2, 1, contrib.bar, _.merge(barOpts, {label: 'Basic Queue', barBgColor: 'red'})),
  standard: grid.set(0, 1, 2, 1, contrib.bar, _.merge(barOpts, {label: 'Standard Queue', barBgColor: 'green'})),
  premium: grid.set(0, 2, 2, 1, contrib.bar, _.merge(barOpts, {label: 'Premium Queue', barBgColor: 'cyan'}))
};

_.each(bars, bar => screen.append(bar));

var tableOpts = {
  columnSpacing: 1,
  interactive: false,
  columnWidth: [4, 8, 3]
};

var tables = {
  basic: grid.set(0, 3, 2, 1, contrib.table, _.merge(tableOpts, {fg: 'red', label: 'Basic Generators'})),
  standard: grid.set(0, 4, 2, 1, contrib.table, _.merge(tableOpts, {fg: 'green', label: 'Standard Generators'})),
  premium: grid.set(0, 5, 2, 1, contrib.table, _.merge(tableOpts, {fg: 'cyan', label: 'Premium Generators'})),
};

function generateTables() {
  var data = {
    basic: [],
    standard: [],
    premium: []
  };

  for (var j = 0; j < 3; j++) {
    for (var i = 0; i < Generators[types[j]].length; i++) {
      var row = []
      row.push(i);
      row.push(Generators[types[j]][i].totalJobs());
      row.push(Generators[types[j]][i].memUsage());
      data[types[j]].push(row);
    }
  }

  _.each(tables, (table, val) => {
    table.setData({headers: ['#', 'Jobs', 'Mem'], data: data[val]});
  });
}

generateTables();

var totalQueues = grid.set(4, 0, 3, 6, contrib.line, {
  showNthLabel: 5,
  label: 'Total Queues',
  showLegend: false,
  legend: {width: 20},
  wholeNumbersOnly: true,
  style: {
    line: 'white',
    text: 'white'
  }
});

var basicStats = { title: 'Basic', style: {line: 'red'}, y: [] };
var standardStats = { title: 'Standard', style: {line: 'green'}, y: [] };
var premiumStats = { title: 'Premium', style: {line: 'cyan'}, y: [] };
var botline = { title: 'botline', style: {line: 'white'}, x:[], y: [] };

totalQueues.setData([botline, basicStats, standardStats, premiumStats]);

var time = Math.floor(new Date().getTime()/1000);
var elapsed;

log = grid.set(0, 6, 2, 6, contrib.log, {
  fg: "white",
  label: 'Server Log'
});

var loadOpts = {
  radius: 10,
  arcWidth: 4,
  yPadding: 2
};

var loads = {
  basic: grid.set(2, 0, 2, 1, contrib.donut, _.merge(loadOpts, {label: 'Basic Load', data: [{label: 'Basic Load', percent: 0}]})),
  standard: grid.set(2, 1, 2, 1, contrib.donut, _.merge(loadOpts, {label: 'Standard Load', data: [{label: 'Standard Load', percent: 0}]})),
  premium: grid.set(2, 2, 2, 1, contrib.donut, _.merge(loadOpts, {label: 'Premium Load', data: [{label: 'Premium Load', percent: 0}]})),
  overall: grid.set(2, 3, 2, 1, contrib.donut, _.merge(loadOpts, {label: 'Overall Load', data: [{label: 'Overall Load', percent: 0}]})),
};

var instructions = grid.set(11, 0, 1, 12, contrib.markdown, {
  markdown: "**^G** Manual Garbage Collection\n**^Q** Quit"
});

function updateDonut() {
  var overallPerc = 0;

  _.each(loads, (load, name) => {
    if (name === 'overall') return;

    var percent = _.sum(queueStats[name])/(Generators[name].length * 50) * 100 || 0;
    var color = "green";
    if (percent >= 50) color = "cyan";
    if (percent >= 75) color = "yellow";
    if (percent >= 90) color = "red";
    load.setData([
       {percent: percent, label: '', 'color': color}
    ]);
    overallPerc += percent;
  });

  overallPerc /= 3;
  var color = "green";
  if (overallPerc >= 50) color = "cyan";
  if (overallPerc >= 75) color = "yellow";
  if (overallPerc >= 90) color = "red";

  loads.overall.setData([
    {percent: Math.floor(overallPerc), label: 'Overall Load', 'color': color}
  ]);
}

// Hotkeys

screen.key(['C-q'], function(ch, key) {
  return process.exit(0);
});

screen.key(['C-g'], function(ch, key) {
  logger("Emitting Manual Garbage Collection Event");
  Generators.basic.forEach(gen => gen.gc());
  Generators.standard.forEach(gen => gen.gc());
  Generators.premium.forEach(gen => gen.gc());
});

//////////

screen.render();

// Intervals

// Queue length stats
setInterval(function() {
  types.forEach(type => {
    queueStats[type] = new Array(Generators[type].length).fill().slice(0, 3).map((v, k) => Generators[type][k].queueLength());
    bars[type].setData({
      titles: new Array(Generators[type].length).fill().slice(0, 3).map((v, k) => "#" + k),
      data: queueStats[type]
    });
  });

  screen.render();
}, 250);

// Generator Tables
setInterval(generateTables, 1000)

// Queue Chart
setInterval(function() {
  elapsed = Math.floor(new Date().getTime()/1000) - time;
  var fmt   = moment.duration(elapsed, 'seconds');
  var hours = Math.floor(fmt.asHours());
  var min   = Math.floor(Math.floor(fmt.asMinutes()) - (Math.floor(fmt.asHours()) * 60));
  var sec   = fmt.asSeconds() - Math.floor(fmt.asMinutes()) * 60;

  botline.x.push(Math.floor(fmt.asDays()) + ":" + pad(hours, 2) + ":" + pad(min, 2) + ":" + pad(sec, 2));
  botline.y.push(0);

  basicStats.y.push(_.sum(queueStats.basic));
  standardStats.y.push(_.sum(queueStats.standard));
  premiumStats.y.push(_.sum(queueStats.premium));

  if (botline.x.length > 25) {
    botline.x.shift();
    botline.y.shift();

    basicStats.y.shift();
    standardStats.y.shift();
    premiumStats.y.shift();
  }
  totalQueues.setData([botline, basicStats, standardStats, premiumStats]);
  screen.render();

  if (elapsed % 3600 === 0) {
    logger("Emitting Hourly Garbage Collection Event");
    Generators.basic.forEach(gen => gen.gc());
    Generators.standard.forEach(gen => gen.gc());
    Generators.premium.forEach(gen => gen.gc());
  }
}, 1000)

// Donut Loads
setInterval(function() {   
   updateDonut();
   screen.render()
}, 250)

////////////

startServer();
function startServer() {
  server.listen(app.get('port'));
  server.on('error', error => {
    var bind = app.get('port');
    switch (error.code) {
      case 'EACCES':
        console.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(bind + ' is already in use');
        process.exit(1);
        break;
      default:
        throw error;
    }
  });

  server.on('listening', () => {
    var addr = server.address();
    var bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
    logger('Listening on ' + bind);
  });
  
  // // Client limit reset
  // setInterval(() => {
  //   var offenders = {};
  //   Object.keys(clients).forEach(client => {
  //     if (clients[client] >= settings.limit) {
  //         offenders[client] = clients[client];
  //     }
  //   });
  //   if (Object.keys(offenders).length > 0) console.log(offenders);

  //   clients = {};
  //   global.gc();
  // }, settings.resetInterval);
}

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function logger(msg) {
  log.log(moment().format('LTS') + " - " + msg);
}
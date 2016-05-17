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

Generators = {
  basic:    new Array(5).fill().map(() => new GeneratorForker({execTime: 1, memory: 5, results: 25})),
  standard: new Array(5).fill().map(() => new GeneratorForker({execTime: 5, memory: 10, results: 250})),
  premium:  new Array(5).fill().map(() => new GeneratorForker({execTime: 10, memory: 25, results: 2500}))
};

// var queueStats = _.each(Generators.basic, gen => {
//   console.log(gen.queueLength());
// });

var queueStats = {

};

var basicBar = grid.set(0, 0, 2, 2, contrib.bar, {
  label: 'Basic Generators Queue Length',
  barWidth: 3,
  barSpacing: 1,
  xOffset: 0,
  maxHeight: 50,
  barBgColor: 'red'
});
screen.append(basicBar) //must append before setting data
setInterval(function() {
  queueStats.basic = new Array(Generators.basic.length).fill().map((v, k) => Generators.basic[k].queueLength());

  basicBar.setData({
    titles: new Array(Generators.basic.length).fill().map((v, k) => "#" + k),
    data: queueStats.basic
  });
  screen.render();
}, 250);

var standardBar = grid.set(0, 2, 2, 2, contrib.bar, {
  label: 'Standard Generators Queue Length',
  barWidth: 3,
  barSpacing: 1,
  xOffset: 0,
  maxHeight: 50,
  barBgColor: 'green'
});
screen.append(standardBar) //must append before setting data
setInterval(function() {
  queueStats.standard = new Array(Generators.standard.length).fill().map((v, k) => Generators.standard[k].queueLength());

  standardBar.setData({
    titles: new Array(Generators.standard.length).fill().map((v, k) => "#" + k),
    data: queueStats.standard
  });
  screen.render()
}, 100);

var premiumBar = grid.set(0, 4, 2, 2, contrib.bar, {
  label: 'Premium Generators Queue Length',
  barWidth: 3,
  barSpacing: 1,
  xOffset: 0,
  maxHeight: 50,
  barBgColor: 'cyan'
});
screen.append(premiumBar) //must append before setting data
setInterval(function() {
  queueStats.premium = new Array(Generators.premium.length).fill().map((v, k) => Generators.premium[k].queueLength());

  premiumBar.setData({
    titles: new Array(Generators.premium.length).fill().map((v, k) => "#" + k),
    data: queueStats.premium
  });
  screen.render()
}, 100);

var basicTable =  grid.set(0, 6, 2, 2, contrib.table, {
  fg: 'red',
  label: 'Basic Generators',
  columnSpacing: 1,
  interactive: false,
  columnWidth: [10, 6, 10],
});

var standardTable =  grid.set(0, 8, 2, 2, contrib.table, {
  fg: 'green',
  label: 'Standard Generators',
  columnSpacing: 1,
  interactive: false,
  columnWidth: [10, 6, 10]
});

var premiumTable =  grid.set(0, 10, 2, 2, contrib.table, {
  fg: 'cyan',
  label: 'Premium Generators',
  columnSpacing: 1,
  interactive: false,
  columnWidth: [10, 6, 10]
});

//set dummy data for table
function generateTable() {
  var types = ['basic', 'standard', 'premium'];
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

   basicTable.setData({headers: ['#', 'Jobs', 'Memory'], data: data.basic})
   standardTable.setData({headers: ['#', 'Jobs', 'Memory'], data: data.standard})
   premiumTable.setData({headers: ['#', 'Jobs', 'Memory'], data: data.premium})
}

generateTable();
setInterval(generateTable, 1000)


var totalQueues = grid.set(4, 0, 4, 12, contrib.line, {
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
setInterval(function() {
  var fmt = moment.duration(Math.floor(new Date().getTime()/1000) - time, 'seconds');
  var min = Math.floor(fmt.asMinutes());
  var sec = fmt.asSeconds() - Math.floor(fmt.asMinutes()) * 60;

  botline.x.push(pad(min, 2) + ":" + pad(sec, 2));
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
  screen.render()
}, 1000)

log = grid.set(2, 6, 2, 6, contrib.log, {
  fg: "white",
  label: 'Server Log'
});

var loadBasic = grid.set(2, 0, 2, 2, contrib.donut,
  {
  label: 'Basic Load',
  radius: 10,
  arcWidth: 4,
  yPadding: 2,
  data: [{label: 'Basic Load', percent: _.sum(queueStats.basic)/(Generators.basic.length * 50) * 100}]
});

var loadStandard = grid.set(2, 2, 2, 2, contrib.donut,
  {
  label: 'Standard Load',
  radius: 10,
  arcWidth: 4,
  yPadding: 2,
  data: [{label: 'Standard Load', percent: _.sum(queueStats.standard)/(Generators.standard.length * 50) * 100}]
});

var loadPremium = grid.set(2, 4, 2, 2, contrib.donut,
  {
  label: 'Premium Load',
  radius: 10,
  arcWidth: 4,
  yPadding: 2,
  data: [{label: 'Premium Load', percent: _.sum(queueStats.premium)/(Generators.premium.length * 50) * 100}]
});

function updateDonut() {
  var donuts = [loadBasic, loadStandard, loadPremium];
  var types = ['basic', 'standard', 'premium'];
  _.each(types, (load, num) => {
    var percent = _.sum(queueStats[load])/(Generators[load].length * 50) * 100 || 0;
    var color = "green";
    if (percent >= 25) color = "cyan";
    if (percent >= 50) color = "yellow";
    if (percent >= 90) color = "red";
    donuts[num].setData([
       {percent: percent, label: 'blah', 'color': color}
     ]);
  });
}

setInterval(function() {   
   updateDonut();
   screen.render()
}, 250)

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});
screen.render();

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
    log.log('Listening on ' + bind);
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
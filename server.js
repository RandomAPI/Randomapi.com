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



var basicBar = grid.set(0, 0, 2, 2, contrib.bar, {
  label: 'Basic Generators Queue Length',
  barWidth: 4,
  barSpacing: 6,
  xOffset: 0,
  maxHeight: 50,
  color: 'red'
});
screen.append(basicBar) //must append before setting data
basicBar.setData({
  titles: ['#0', '#1', '#2', '#3', '#4'],
  data: [
    Generators.basic[0].queueLength(),
    Generators.basic[1].queueLength(),
    Generators.basic[2].queueLength(),
    Generators.basic[3].queueLength(),
    Generators.basic[4].queueLength()
  ]
});
setInterval(function() {
  basicBar.setData({
    titles: ['#0', '#1', '#2', '#3', '#4'],
    data: [
      Generators.basic[0].queueLength(),
      Generators.basic[1].queueLength(),
      Generators.basic[2].queueLength(),
      Generators.basic[3].queueLength(),
      Generators.basic[4].queueLength()
    ]
  });
  screen.render()
}, 10);

var standardBar = grid.set(0, 2, 2, 2, contrib.bar, {
  label: 'Standard Generators Queue Length',
  barWidth: 4,
  barSpacing: 6,
  xOffset: 0,
  maxHeight: 50,
  color: 'green'
});
screen.append(standardBar) //must append before setting data
standardBar.setData({
  titles: ['#0', '#1', '#2', '#3', '#4'],
  data: [
    Generators.standard[0].queueLength(),
    Generators.standard[1].queueLength(),
    Generators.standard[2].queueLength(),
    Generators.standard[3].queueLength(),
    Generators.standard[4].queueLength()
  ]
});
setInterval(function() {
  standardBar.setData({
    titles: ['#0', '#1', '#2', '#3', '#4'],
    data: [
      Generators.standard[0].queueLength(),
      Generators.standard[1].queueLength(),
      Generators.standard[2].queueLength(),
      Generators.standard[3].queueLength(),
      Generators.standard[4].queueLength()
    ]
  });
  screen.render()
}, 10);

var premiumBar = grid.set(0, 4, 2, 2, contrib.bar, {
  label: 'Premium Generators Queue Length',
  barWidth: 4,
  barSpacing: 6,
  xOffset: 0,
  maxHeight: 50,
  color: 'cyan'
});
screen.append(premiumBar) //must append before setting data
premiumBar.setData({
  titles: ['#0', '#1', '#2', '#3', '#4'],
  data: [
    Generators.premium[0].queueLength(),
    Generators.premium[1].queueLength(),
    Generators.premium[2].queueLength(),
    Generators.premium[3].queueLength(),
    Generators.premium[4].queueLength()
  ]
});
setInterval(function() {
  premiumBar.setData({
    titles: ['#0', '#1', '#2', '#3', '#4'],
    data: [
      Generators.premium[0].queueLength(),
      Generators.premium[1].queueLength(),
      Generators.premium[2].queueLength(),
      Generators.premium[3].queueLength(),
      Generators.premium[4].queueLength()
    ]
  });
  screen.render()
}, 10);

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
    for (var i = 0; i < 5; i++) {
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

generateTable()
setInterval(generateTable, 1000)


// var basicGenLine = grid.set(0, 0, 4, 6, contrib.line, {
//   showNthLabel: 5,
//   label: 'Basic Generators',
//   showLegend: true,
//   legend: {width: 20}
// });

// var series1 = {
//   title: '#1',
//   style: {line: 'red'},
//   x: [],
//   y: []
//  }

// basicGenLine.setData([series1]);
// var blah = 0;
// setInterval(function() {
//   blah += 1;
//   var fmt = moment.duration(blah, 'seconds');
//   var min = Math.floor(fmt.asMinutes());
//   var sec = fmt.asSeconds() - Math.floor(fmt.asMinutes()) * 60;
//   series1.x.push(pad(min, 2) + ":" + pad(sec, 2));
//   series1.y.push(Generators.basic[0].queueLength());
//   if (series1.x.length > 25) {
//     series1.x.shift();
//     series1.y.shift();
//   }
//   basicGenLine.setData([series1]);
//   screen.render()
// }, 1000)

log = grid.set(2, 6, 2, 6, contrib.log, 
  { fg: "white"
  , label: 'Server Log'})



var load1 = grid.set(2, 0, 2, 2, contrib.donut, 
  {
  label: 'Load 1',
  radius: 10,
  arcWidth: 4,
  yPadding: 2,
  data: [{label: 'Load 1', percent: os.loadavg()[0]*100}]
});

var load5 = grid.set(2, 2, 2, 2, contrib.donut, 
  {
  label: 'Load 5',
  radius: 10,
  arcWidth: 4,
  yPadding: 2,
  data: [{label: 'Load 5', percent: os.loadavg()[1]*100}]
});

var load15 = grid.set(2, 4, 2, 2, contrib.donut, 
  {
  label: 'Load 15',
  radius: 10,
  arcWidth: 4,
  yPadding: 2,
  data: [{label: 'Load 15', percent: os.loadavg()[2]*100}]
});

function updateDonut() {
  var donuts = [load1, load5, load15];
  _.each(os.loadavg(), (load, num) => {
    load *= 100;
    var color = "green";
    if (load >= 200) color = "cyan";
    if (load >= 300) color = "yellow";
    if (load >= 400) color = "red";  
    donuts[num].setData([
       {percent: load, label: 'blah', 'color': color}
     ]);
  });
}

setInterval(function() {   
   updateDonut();
   screen.render()
}, 3000)

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
const async    = require('async');
const moment   = require('moment');
const _        = require('lodash');
const blessed  = require('blessed');
const contrib  = require('blessed-contrib');
const pad      = require('./utils').pad;
const logger   = require('./utils').logger;
const redis    = require('./utils').redis;
const settings = require('./utils').settings;
const app      = require('./app').app;

const screen  = blessed.screen();
const grid    = new contrib.grid({rows: 12, cols: 12, screen: screen});

const Generators = app.get('Generators');
const types      = Object.keys(settings.generators);

// For graphing stats
let queueStats     = {};
let memStats       = {};
let listCacheStats = {};
let jobStats       = {};

// Shared bar options
const barOpts = {
  barWidth: 3,
  barSpacing: 1,
  xOffset: 0,
  maxHeight: 50
};

const bars = {
  basic:    grid.set(0, 0, 2, 1, contrib.bar, _.merge(barOpts, {label: 'Basic', barBgColor: 'red'})),
  standard: grid.set(0, 1, 2, 1, contrib.bar, _.merge(barOpts, {label: 'Standard', barBgColor: 'green'})),
  premium:  grid.set(0, 2, 2, 1, contrib.bar, _.merge(barOpts, {label: 'Premium', barBgColor: 'cyan'}))
};

_.each(bars, bar => screen.append(bar));

const tableOpts = {
  columnSpacing: 1,
  interactive: false,
  columnWidth: [4, 8, 3]
};

const tables = {
  basic:    grid.set(0, 3, 2, 1, contrib.table, _.merge(tableOpts, {label: 'Basic', fg: 'red'})),
  standard: grid.set(0, 4, 2, 1, contrib.table, _.merge(tableOpts, {label: 'Standard', fg: 'green'})),
  premium:  grid.set(0, 5, 2, 1, contrib.table, _.merge(tableOpts, {label: 'Premium', fg: 'cyan'})),
};

const generateTables = () => {
  let data = {
    basic:    [],
    standard: [],
    premium:  []
  };

  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < Generators[types[j]].length; i++) {
      let row = [];
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

const totalQueues = grid.set(4, 0, 3, 4, contrib.line, {
  showNthLabel: 5,
  label: 'Generator Queues',
  showLegend: true,
  legend: {width: 10},
  wholeNumbersOnly: true,
  style: {
    line: 'white',
    text: 'white'
  }
});

const totalMemory = grid.set(4, 4, 3, 4, contrib.line, {
  showNthLabel: 5,
  label: 'Memory Usage',
  showLegend: true,
  legend: {width: 10},
  wholeNumbersOnly: true,
  style: {
    line: 'white',
    text: 'white'
  }
});

const eventLoopResponseAvg = grid.set(4, 8, 3, 4, contrib.line, {
  showNthLabel: 5,
  label: 'Event Loop Response Average',
  showLegend: true,
  legend: {width: 10},
  wholeNumbersOnly: true,
  style: {
    line: 'white',
    text: 'white'
  }
});

let basicStats    = { title: '', style: {line: 'red'}, y: [] };
let standardStats = { title: '', style: {line: 'green'}, y: [] };
let premiumStats  = { title: '', style: {line: 'cyan'}, y: [] };
let botline       = { title: '', style: {line: 'white'}, x:[], y: [] };

let redisLine     = { title: '', style: {line: 'red'}, x:[], y: [] };
let memoryLine    = { title: '', style: {line: 'green'}, x:[], y: [] };
let listCacheLine = { title: '', style: {line: 'cyan'}, x:[], y: [] };

let eventLine = { title: 'eventLine', style: {line: 'green'}, x:[], y: [] };

totalQueues.setData([botline, basicStats, standardStats, premiumStats]);
totalMemory.setData([botline, redisLine, memoryLine, listCacheLine]);

let time = Math.floor(new Date().getTime()/1000);
let elapsed;

log = grid.set(0, 6, 2, 6, contrib.log, {
  fg: 'white',
  label: 'Server Log'
});

let loadOpts = {
  radius: 10,
  arcWidth: 4,
  yPadding: 2
};

let loads = {
  basic:    grid.set(2, 0, 2, 1, contrib.donut, _.merge(loadOpts, {label: 'Basic Load', data: [{label: 'Basic Load', percent: 0}]})),
  standard: grid.set(2, 1, 2, 1, contrib.donut, _.merge(loadOpts, {label: 'Standard Load', data: [{label: 'Standard Load', percent: 0}]})),
  premium:  grid.set(2, 2, 2, 1, contrib.donut, _.merge(loadOpts, {label: 'Premium Load', data: [{label: 'Premium Load', percent: 0}]})),
  overall:  grid.set(2, 3, 2, 1, contrib.donut, _.merge(loadOpts, {label: 'Overall Load', data: [{label: 'Overall Load', percent: 0}]})),
};

let instructions = grid.set(11, 0, 1, 12, contrib.markdown, {
  markdown: '**^G** Manual GC\t**^V** Rebuild views\t**^R** Empty Redis List Cache\n**^Q** Quit\t\t **^C** Clear log\t\t**^L** Empty Generator List Cache'
});

const updateDonut = () => {
  let overallPerc = 0;

  _.each(loads, (load, name) => {
    if (name === 'overall') return;

    let percent = _.sum(queueStats[name])/(Generators[name].length * 50) * 100 || 0;
    let color = 'green';
    if (percent >= 50) color = 'cyan';
    if (percent >= 75) color = 'yellow';
    if (percent >= 90) color = 'red';
    load.setData([
       {percent: percent, label: '', 'color': color}
    ]);
    overallPerc += percent;
  });

  overallPerc /= 3;
  let color = 'green';
  if (overallPerc >= 50) color = 'cyan';
  if (overallPerc >= 75) color = 'yellow';
  if (overallPerc >= 90) color = 'red';

  loads.overall.setData([
    {percent: Math.floor(overallPerc), label: 'Overall Load', 'color': color}
  ]);
}

// Hotkeys
screen.key(['C-q'], (ch, key) => process.exit(0));

screen.key(['C-g'], (ch, key) => {
  logger('Emitting Manual Garbage Collection Event');
  Generators.basic.forEach(gen => gen.gc());
  Generators.standard.forEach(gen => gen.gc());
  Generators.premium.forEach(gen => gen.gc());
  Generators.realtime.forEach(gen => gen.gc());
  Generators.speedtest.forEach(gen => gen.gc());
});

screen.key(['C-r'], (ch, key) => {
  logger('Emptying Redis List Cache');
  redis.keys("*", (err, lists) => {
    lists
      .filter(item => item.match(/list\:/) !== null)
      .map(list => redis.del(list));
  });
});

screen.key(['C-l'], (ch, key) => {
  logger('Emptying Generator List Cache');
  Generators.basic.forEach(gen => gen.emptyListCache());
  Generators.standard.forEach(gen => gen.emptyListCache());
  Generators.premium.forEach(gen => gen.emptyListCache());
  Generators.realtime.forEach(gen => gen.emptyListCache());
  Generators.speedtest.forEach(gen => gen.emptyListCache());
});

screen.key(['C-v'], (ch, key) => {
  logger('Rebuilding views');
  let gulp = require('child_process').spawn('gulp');
  gulp.on('close', (code) => {
    logger('Finished rebuilding views');
  });
});

screen.key(['C-c'], (ch, key) => {
  logger(true);
});

//////////

screen.render();

// Intervals

// Queue length stats
setInterval(() => {
  types.forEach(type => {
    queueStats[type] = new Array(Generators[type].length).fill().map((v, k) => Generators[type][k].queueLength());
    memStats[type] = new Array(Generators[type].length).fill().map((v, k) => Generators[type][k].memUsage());
    listCacheStats[type] = new Array(Generators[type].length).fill().map((v, k) => Generators[type][k].listCacheUsage());
    jobStats[type] = new Array(Generators[type].length).fill().map((v, k) => Generators[type][k].totalJobs());

    if (type === 'speedtest' || type === 'realtime') return;
    bars[type].setData({
      titles: new Array(Generators[type].length).fill().map((v, k) => '#' + k),
      data: queueStats[type]
    });
  });

  screen.render();
}, 250);

// Generator Tables
setInterval(generateTables, 1000)

// Queue, Memory, and Event Chart
let oldEventTime = Math.floor(new Date().getTime());
setInterval(() => {
  let tmp = Math.floor(new Date().getTime());
  elapsed = Math.floor(new Date().getTime()/1000) - time;
  let fmt   = moment.duration(elapsed, 'seconds');
  let hours = Math.floor(fmt.asHours()) - Math.floor(fmt.asDays()) * 24;
  let min   = Math.floor(Math.floor(fmt.asMinutes()) - (Math.floor(fmt.asHours()) * 60));
  let sec   = fmt.asSeconds() - Math.floor(fmt.asMinutes()) * 60;

  botline.x.push(Math.floor(fmt.asDays()) + ':' + pad(hours, 2) + ':' + pad(min, 2) + ':' + pad(sec, 2));
  botline.y.push(0);

  basicStats.y.push(_.sum(queueStats.basic));
  basicStats.title = String(_.sum(queueStats.basic));

  standardStats.y.push(_.sum(queueStats.standard));
  standardStats.title = String(_.sum(queueStats.standard));

  premiumStats.y.push(_.sum(queueStats.premium));
  premiumStats.title = String(_.sum(queueStats.premium));

  let memSum   = _.sum([_.sum(memStats.basic), _.sum(memStats.standard), _.sum(memStats.premium)]);
  let cacheSum = _.sum([_.sum(listCacheStats.basic), _.sum(listCacheStats.standard), _.sum(listCacheStats.premium)]);

  memoryLine.y.push(memSum);
  memoryLine.title = String(memSum + ' MB');

  redis.info('memory', (err, info) => {
    redisLine.y.push(Math.floor(info.split('\r\n')[1].slice(12)/1024/1024));
    redisLine.title = String(Math.floor(info.split('\r\n')[1].slice(12)/1024/1024) + ' MB');
  });

  listCacheLine.y.push(cacheSum);
  listCacheLine.title = String(cacheSum + ' MB');

  eventLine.y.push(tmp - oldEventTime);
  eventLine.title = String(tmp - oldEventTime + ' ms');

  oldEventTime = tmp;

  if (botline.x.length > 60) {
    botline.x.shift();
    botline.y.shift();

    basicStats.y.shift();
    standardStats.y.shift();
    premiumStats.y.shift();
    memoryLine.y.shift();
    redisLine.y.shift();
    listCacheLine.y.shift();
    eventLine.y.shift();
  }
  totalQueues.setData([botline, basicStats, standardStats, premiumStats]);
  totalMemory.setData([botline, memoryLine, redisLine, listCacheLine]);

  eventLoopResponseAvg.setData([botline, eventLine]);
  oldEventTime = tmp;

  screen.render();
}, 1000)

// Donut Loads
setInterval(() => {
   updateDonut();
   screen.render()
}, 250)
////////////

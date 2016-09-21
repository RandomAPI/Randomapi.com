const express  = require('express');
const router   = express.Router();
const settings = require('../utils').settings;

let startTime = currentTime();
let cache, cacheTime = 0;

router.get('/', (req, res, next) => {
  res.render('stats', {basehref: settings.general.basehref, messages: null, title: 'RandomAPI Stats', path: settings.general.statsPath});
});

router.get('/data', (req, res, next) => {
  if (currentTime() - cacheTime < 1000) {
    return res.send(cache);
  }
  const Generators = req.app.get('Generators');
  const types      = Object.keys(settings.generators);

  let data = {
    basic:    [],
    standard: [],
    premium:  [],
    realtime: [],
    demo:     []
  };

  for (let j = 0; j < 5; j++) {
    let row = [];
    let jobs = 0;
    let mem  = 0;

    row.push(Generators[types[j]].length);
    for (let i = 0; i < Generators[types[j]].length; i++) {
      jobs += Generators[types[j]][i].totalJobs();
      mem  += Generators[types[j]][i].memUsage();
    }
    row.push(jobs);
    row.push(mem);
    data[types[j]].push(row);
  }

  data.uptime = currentTime() - startTime;
  cache = data;
  cacheTime = currentTime();
  res.send(data);
});

function currentTime() {
  return new Date().getTime();
}

module.exports = router;

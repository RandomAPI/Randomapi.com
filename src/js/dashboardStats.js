$(() => {
  $.get('statistics/data', data => {
    data = data.map(hour => {
      let total = 0;
      hour.forEach(entry => {
        total += JSON.parse(entry).results;
      });
      return total;
    });

    $('#container').highcharts({
      chart: {
        type: 'column'
      },
      title: {
        text: 'API usage in last 24 hours'
      },
      // subtitle: {
      //   text: 'Updated hourly'
      // },
      xAxis: {
        title: {
          text: 'Hour'
        },
        categories: calcHours()
      },
      yAxis: [{
        min: 0,
        title: {
          text: 'Value'
        },
        plotLines: [{
          value: 0,
          width: 1,
          color: '#808080'
        }]
      }],
      series: [{
        name: 'Results',
        data,
        color: '#00FF00'
      }],
      tooltip: {
        shared: true
      }
    });
  });
});

function calcHours(init=new Date().getHours()) {
  let hours = [];
  for (let i = 0; i < 24; i++) {
    hours.push(`${i%12+1} ${i<11 || i == 23 ? "AM" : "PM"}`);
  }

  for (let i = init; i < 24; i++) {
    hours.unshift(hours.pop());
  }

  return hours;
}

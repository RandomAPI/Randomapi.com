const db = require('./models/db').connection;

db.query('UPDATE `user` SET `results` = 0 WHERE ?', {timezone: currentMidnight()}, (a, b) => {
  console.log(a, b);
  process.exit();
});

function currentMidnight() {
  function calcTime(offset) {
    var d = new Date();
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    var dstoffset = 0;
    if (dst(new Date())) dstoffset = 3600000
    var nd = new Date(utc + (3600000*offset));

    return nd
  }
  function stdTimezoneOffset(time) {
    var jan = new Date(time.getFullYear(), 0, 1);
    var jul = new Date(time.getFullYear(), 6, 1);
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  }

  function dst(time) {
    return time.getTimezoneOffset() < stdTimezoneOffset(time);
  }

  var timezones = [
    -12.0, -11.0, -10.0, -9.0, -8.0, -7.0, -6.0,
    -5.0, -4.0, -3.5, -3.0, -2.0, -1.0, 0.0, 1.0,
    2.0, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 5.75, 6.0,
    7.0, 8.0, 9.0, 9.5, 10.0, 11.0, 12.0];

  for (let i = 0; i < timezones.length; i++) {
    let hours = calcTime(timezones[i]).getHours();
    let mins = calcTime(timezones[i]).getMinutes();
    if (hours === 0 && mins <= 5 || hours === 23 && mins >= 55) {
      return timezones[i];
    }
  }
  return null;
}

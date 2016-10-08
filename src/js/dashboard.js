$(() => {
  $('#quotaResults').html(numeral(Number($('#quotaResults').html())).format(','))
  if ($('#tierResults').html() !== 'unlimited') {
    $('#tierResults').html(numeral(Number($('#tierResults').html())).format(','))
  }
});

window.twttr = (function(d, s, id) {
  var js, fjs = d.getElementsByTagName(s)[0],
    t = window.twttr || {};
  if (d.getElementById(id)) return t;
  js = d.createElement(s);
  js.id = id;
  js.src = "https://platform.twitter.com/widgets.js";
  fjs.parentNode.insertBefore(js, fjs);

  t._e = [];
  t.ready = function(f) {
    t._e.push(f);
  };

  return t;
}(document, "script", "twitter-wjs"));

twttr.ready(() => {
  window.twttr.events.bind(
    'click',
    function (ev) {
      window.location.href = 'twitterpromo';
    }
  );
});

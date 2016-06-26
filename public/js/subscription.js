$(function() {
  var renewalDate = $('#renewalDate');
  var dailyResults = $('#dailyResults');
  var resultsPerRequest = $('#resultsPerRequest');
  var price = $('#price');

  renewalDate.html(moment(new Date(renewalDate.html())).format('LL'));

  if (dailyResults.html() !== 'unlimited') {
    dailyResults.html(numeral(Number(dailyResults.html())).format(','))
  }
  resultsPerRequest.html(numeral(Number(resultsPerRequest.html())).format(','))
  price.html(numeral(price.html()).format('$0.00'))

  $("#premiumUpgrade").click(function() {
    $.post('', {code: editor.getValue()}, function(url) {
      window.location.replace(url);
    });
  });

  $("#cancelSubscription").click(() => {
    $.get('settings/subscription/cancel', function() {
      window.location.replace('settings/subscription');
    });
  });
});

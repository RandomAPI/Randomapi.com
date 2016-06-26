$(() => {
  let renewalDate = $('#renewalDate');
  let dailyResults = $('#dailyResults');
  let resultsPerRequest = $('#resultsPerRequest');
  let price = $('#price');

  renewalDate.html(moment(new Date(renewalDate.html())).format('LL'));

  if (dailyResults.html() !== 'unlimited') {
    dailyResults.html(numeral(Number(dailyResults.html())).format(','))
  }
  resultsPerRequest.html(numeral(Number(resultsPerRequest.html())).format(','))
  price.html(numeral(price.html()).format('$0.00'))

  $("#premiumUpgrade").click(() => {
    $.post('', {code: editor.getValue()}, url => {
      window.location.replace(url);
    });
  });

  $("#cancelSubscription").click(() => {
    $.get('settings/subscription/cancel', () => {
      window.location.replace('settings/subscription');
    });
  });

  $("#restartSubscription").click(() => {
    $.get('settings/subscription/restart', () => {
      window.location.replace('settings/subscription');
    });
  });

  $("#upgradeSubscription").click(() => {
    $.get('settings/subscription/upgrade', () => {
      window.location.replace('settings/subscription');
    });
  });
});

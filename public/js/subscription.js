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


  $("#cancelSubscription").click(() => {
    notyPrompt(`Are you sure you want to cancel your subscription?`, () => {
      $.get('settings/subscription/cancel', () => {
        window.location.replace('settings/subscription');
      });
    });
  });

  $("#restartSubscription").click(() => {
    notyPrompt(`Are you sure you want to restart your subscription?`, () => {
      $.get('settings/subscription/restart', () => {
        window.location.replace('settings/subscription');
      });
    });
  });

  $("#upgradeSubscription").click(() => {
    notyPrompt(`Are you sure you want to upgrade to the Premium Tier?`, () => {
      $.get('settings/subscription/upgrade', () => {
        window.location.replace('settings/subscription');
      });
    });
  });

  $("#attemptPayment").click(() => {
    $.get('settings/subscription/attemptPayment', () => {
      window.location.replace('settings/subscription');
    });
  });
});

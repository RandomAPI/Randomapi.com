$(() => {
  let text = $('message').html();
  let type;

  if (text !== "") {
    if (text.slice(0, 4) === 'info') {
      type = 'success';
      text = text.slice(5);
    } else if (text.slice(0, 5) === 'token') {
      type = 'success';
      text = text.slice(6);
      noty({
        text: "Make sure to copy your new authToken now. You won’t be able to see it again!<br><br>" + text.slice(text.indexOf('!')+1),
        layout: 'center',
        type: 'confirm',
        theme: 'relax',
        buttons: [{
          addClass: 'button greenButton',
          text: 'Close',
          onClick: function ($noty) {
            $noty.close();
          }
        }]
      });
    } else {
      type = 'error';
      text = text.slice(8);
    }
    noty({
      text,
      layout: 'top',
      type,
      theme: 'relax',
      timeout: 2500,
      closeWith: ['click'],
      animation: {
        open: 'animated flipInX',
        close: 'animated flipOutX'
      }
    });
  }

  $('#signupButton').click(() => {
    window.location.href = 'register';
  });

  $('#homepageSignupButton').click(() => {
    window.location.href = 'register';
  });

  updateDates()
  setInterval(() => {
    updateDates();
  }, 60000);

  $('.toggleButton').click(function() {
    $(this).toggleClass('expanded').siblings('div').slideToggle();
  });
});

function notyPrompt(text, yes, no) {
  noty({
    text,
    layout: 'center',
    type: "confirm",
    theme: 'relax',
    buttons: [{
      addClass: 'button greenButton',
      text: 'Yes',
      onClick: function ($noty) {
        $noty.close();
        yes();
      }
    },
    {
      addClass: 'button redButton',
      text: 'No',
      onClick: function ($noty) {
        $noty.close();
        no();
      }
    }]
  });
}

function apiDeletePrompt(ref) {
  notyPrompt(`Are you sure you want to delete API ${ref}?`, () => {
    window.location.href = `delete/api/${ref}`;
  }, () => {

  });
}

function listDeletePrompt(ref) {
  notyPrompt(`Are you sure you want to delete List ${ref}?`, () => {
    window.location.href = `delete/list/${ref}`;
  }, () => {

  });
}

function snippetDeletePrompt(ref, name) {
  notyPrompt(`Are you sure you want to delete Snippet ${name}?`, () => {
    window.location.href = `delete/snippet/${ref}`;
  }, () => {

  });
}

function tokenRevokePrompt(ref, name) {
  notyPrompt(`Are you sure you want to revoke Token ${name}?`, () => {
    window.location.href = `settings/revokeToken/${ref}`;
  }, () => {

  });
}

function updateDates() {
  $('.date').each((index, date) => {
    if ($(date).data('date') !== "Never") {
      $(date).html(moment(new Date($(date).data('date'))/*, "MMDDYYHHmmss"*/).fromNow());
    } else {
      $(date).html("Never");
    }
  });
}

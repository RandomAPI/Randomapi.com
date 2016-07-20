$(() => {
  let text = $('message').html();
  let type;

  if (text !== "") {
    if (text.slice(0, 4) === 'info') {
      type = 'success';
      text = text.slice(5);
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
    window.location.replace(`register`);
  });

  updateDates()
  setInterval(() => {
    updateDates();
  }, 60000);
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
    window.location.replace(`delete/api/${ref}`);
  }, () => {

  });
}

function listDeletePrompt(ref) {
  notyPrompt(`Are you sure you want to delete List ${ref}?`, () => {
    window.location.replace(`delete/list/${ref}`);
  }, () => {

  });
}

function snippetDeletePrompt(ref, name) {
  notyPrompt(`Are you sure you want to delete Snippet ${name}?`, () => {
    window.location.replace(`delete/snippet/${ref}`);
  }, () => {

  });
}

function snippetDeletePrompt(ref, name) {
  notyPrompt(`Are you sure you want to delete Snippet ${name}?`, () => {
    window.location.replace(`delete/snippet/${ref}`);
  }, () => {

  });
}

function updateDates() {
    $('.date').each((index, date) => {
      $(date).html(moment(new Date($(date).data('date'))/*, "MMDDYYHHmmss"*/).fromNow());
    });
  }

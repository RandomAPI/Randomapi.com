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
});

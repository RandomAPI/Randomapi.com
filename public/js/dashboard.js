$(() => {
  $('#results').html(numeral(Number($('#results').html())).format(','))
  if ($('#tierResults').html() !== 'unlimited') {
    $('#tierResults').html(numeral(Number($('#tierResults').html())).format(','))
  }
});

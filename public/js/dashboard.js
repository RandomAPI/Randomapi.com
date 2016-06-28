$(() => {
  $('#quotaResults').html(numeral(Number($('#quotaResults').html())).format(','))
  if ($('#tierResults').html() !== 'unlimited') {
    $('#tierResults').html(numeral(Number($('#tierResults').html())).format(','))
  }
});

$(function() {
  $('#results').html(numeral(Number($('#results').html())).format(','))
  $('#tierResults').html(numeral(Number($('#tierResults').html())).format(','))
});

$(() => {
  $('#quotaResults').html(numeral(Number($('#quotaResults').html())).format(','))
  if ($('#tierResults').html() !== 'unlimited') {
    $('#tierResults').html(numeral(Number($('#tierResults').html())).format(','))
  }

  updateDates()
  setInterval(() => {
    updateDates();
  }, 60000);

  function updateDates() {
    $('#date').each((index, date) => {
      $(date).html(moment($(date).data('date'), "MMDDYYHHmmss").fromNow());
    });
  }
});

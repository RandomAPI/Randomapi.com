$(() => {
  let limitsBad = false, tagsBad = false;
  $('#limitsInput').on('input', function() {

    limitsBad = $(this).val().match(/^[a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{0,32}$/) === null
    badCheck();
  });

  $('#tagsInput').on('input', function() {
    let tags = $(this).val().split(',').map(tag => tag.trim()).filter(tag => tag !== "");
    let rejects = tags.filter(tag => tag.match(/^([a-zA-Z0-9 _\-\.+\[\]\{\}\(\)]{0,32})$/g) === null);
    tagsBad = rejects.length > 0;
    badCheck();
  });

  badCheck();

  function badCheck() {
    if (limitsBad) {
      $('#limits').show();
    } else {
      $('#limits').hide();
    }
    if (tagsBad) {
      $('#tagLimits').show();
    } else {
      $('#tagLimits').hide();
    }
    if (tagsBad || limitsBad) {
      $("#submit").prop('disabled', true);
    } else {
      $("#submit").prop('disabled', false);
    }
  }
});




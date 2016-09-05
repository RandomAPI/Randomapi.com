$(function() {
  setTimeout(() => {
    window.scrollTo(0, 0);
  }, 0);
  $('ul.tab-nav li a.button').click(function(e) {
    e.preventDefault();
    activeTab($(this).attr('href'));
    return false;
  });

  if (location.hash !== '') {
    activeTab(location.hash);
  } else {
    activeTab('#active');
  }

  function activeTab(tab) {

    let button = $('ul.tab-nav li a.button[href="' + tab + '"]');
    let pane = $('div.tab-content div.tab-pane[id="' + tab.slice(1) + '"]');

    $('ul.tab-nav li a.button.active').removeClass('active');
    button.addClass('active');

    $('div.tab-content div.tab-pane.active').removeClass('active');
    pane.addClass('active');

    if (history.pushState) {
        history.pushState({}, 'RandomAPI :: Offline', `settings/offline${tab}`);
    } else {
        location.hash = tab;
    }

    return false;
  }

  $('select').each(function () {
    var select = $(this);
    var selectedValue = select.find('option[selected]').val();

    if (selectedValue) {
      select.val(selectedValue);
    } else {
      select.prop('selectedIndex', 0);
    }
  });
});

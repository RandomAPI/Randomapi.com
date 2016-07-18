$(function() {
    $('ul.tab-nav li a.button').click(function(e) {
      e.preventDefault();
      activeTab($(this).attr('href'));
      return false;
    });

    if (location.hash !== '') {
      activeTab(location.hash);
    } else {
      activeTab('#private');
    }

    function activeTab(tab) {

      let button = $('ul.tab-nav li a.button[href="' + tab + '"]');
      let pane = $('div.tab-content div.tab-pane[id="' + tab.slice(1) + '"]');

      $('ul.tab-nav li a.button.active').removeClass('active');
      button.addClass('active');

      $('div.tab-content div.tab-pane.active').removeClass('active');
      pane.addClass('active');

      location.hash = tab;

      return false;
    }

    $("select[name='revision']").change(updateRevision);

    function updateRevision() {
      let self = this;
      let code = $(this).parent().siblings('td').children('a[name="codeSnippet"]');
      let edit = $(this).parent().siblings('td').children('a[name="editSnippet"]');

      let codeIndex = code.attr('href').lastIndexOf('/');
      let editIndex = edit.attr('href').lastIndexOf('/');

      code.attr('href', code.attr('href').slice(0, codeIndex) + '/' + $(this).val());
      edit.attr('href', edit.attr('href').slice(0, editIndex) + '/' + $(this).val());

      let created  = $(this).parent().siblings('td').children('span[name="created"]');
      let modified = $(this).parent().siblings('td').children('span[name="modified"]');

      $.when($.ajax(`ajax/snippetLookup/${$(this).closest('tr').data('ref')}/${$(this).val()}`)).then(function(data) {
        if (data.published === 1) {
          code.html('View Snippet');
        } else {
          code.html('Code Snippet');
        }
      });
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

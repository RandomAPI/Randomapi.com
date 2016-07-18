$(() => {
  hljs.initHighlightingOnLoad();

  $("#noPublish").click(() => {
    window.location.replace('view/snippet');
  });

  $("#confirmPublish").click(() => {
    $.get('publish/snippet/' + $('snippet').html() + '/confirm', (loc) => {
      window.location.replace(loc);
    });
  });

});

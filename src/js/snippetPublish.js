$(() => {
  hljs.initHighlightingOnLoad();

  $("#noPublish").click(() => {
    window.location.href = 'view/snippet';
  });

  $("#confirmPublish").click(() => {
    $.get('publish/snippet/' + $('snippet').html() + '/confirm', (loc) => {
      window.location.href = loc;
    });
  });

});

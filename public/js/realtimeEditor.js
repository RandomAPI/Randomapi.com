socket = io($('server').html());
var editor = ace.edit("aceEditor");
editor.setTheme("ace/theme/twilight");
editor.session.setMode("ace/mode/javascript");
editor.focus();
$("#submit").click(function() {
  $.post('', {code: editor.getValue()}, function(url) {
    window.location.replace(url);
  });
});
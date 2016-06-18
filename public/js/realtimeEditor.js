socket = io($('server').html());
ref = $('ref').html();

var editor = ace.edit("aceEditor");
editor.setTheme("ace/theme/twilight");
editor.session.setMode("ace/mode/javascript");
editor.focus();

$("#submit").click(function() {
  $.post('', {code: editor.getValue()}, function(url) {
    window.location.replace(url);
  });
});

lintCode();

var typingTimer;
var codeArea = $(editor.textInput.getElement());
codeArea.keyup(function(){
  clearTimeout(typingTimer);
  typingTimer = setTimeout(lintCode, 250);
});

codeArea.keydown(function(){
  clearTimeout(typingTimer);
});

socket.on('codeLinted', function(msg) {
  console.log(msg);
  if (msg.error === null) {
    $('#results').html(JSON.stringify(msg.results, null, 2));
  } else {
    //$('#results').html(msg.error.error + "\n" + msg.error.stack);
    $('#results').html(msg.error.formatted);
  }
});

function lintCode() {
  socket.emit('lintCode', {code: editor.getValue(), ref});
};

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

updateCharCount();
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

codeArea.bind('change keyup paste', updateCharCount);

socket.on('codeLinted', function(msg) {
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

function updateCharCount() {
  let len = editor.getValue().length;
  if (len > 8192) {
    $("#currentCharCount").css('color', 'red');
  } else {
    $("#currentCharCount").css('color', 'black');
  }
  $("#currentCharCount").html(numeral(len).format(','));
}

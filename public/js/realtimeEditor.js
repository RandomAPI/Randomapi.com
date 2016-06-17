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
  // var result = JSON.parse(msg.results);
  // console.dir(JSON.parse(msg.results));
  // if (JSON.parse(msg.results).error) {
  //   var stack
  //   if (result.results[0].API_STACK !== undefined) {
  //     stack = result.results[0].API_STACK.replace(/\\n/g, '<br>')
  //   } else {
  //     stack = "";
  //   }
  //   $('#results').html(result.results[0].API_ERROR + "<br><br>" + stack);
  // } else {
  //   $('#results').html(JSON.stringify(result.results));
  // }
  $('#results').html(msg);
  try {
    let json = JSON.parse(msg);
    if (json.error) {
      $('#results').html(json.results[0].API_ERROR);
    } else {
      $('#results').html(msg);
    }
  } catch (e) {
    $('#results').html(msg);
  }
});

function lintCode() {
  console.log("Sending code to lint");
  socket.emit('lintCode', {code: editor.getValue()});
};

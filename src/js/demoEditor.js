socket = io($('server').html());

let editor = ace.edit("aceEditor");
editor.setTheme("ace/theme/twilight");
editor.session.setMode("ace/mode/javascript");
editor.setValue(editor.getValue(), 1);
editor.focus();

lintCode();

let typingTimer;
let codeArea = $(editor.textInput.getElement());
codeArea.keyup(() => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(lintCode, 250);
});

codeArea.keydown(() => {
  clearTimeout(typingTimer);
});

socket.on('codeLinted', msg => {
  if (msg.error === null) {
    $('#results').html(msg.results);
  } else {
    $('#results').html(msg.error.formatted);
  }
});

function lintCode() {
  socket.emit('lintDemoCode', {code: String(editor.getValue()).slice(0, 8192), ref: null});
};

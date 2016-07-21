socket = io($('server').html());
ref = $('ref').html();

let typingTimer, lastAbuse;
let editor = ace.edit("aceEditor");
let codeArea = $(editor.textInput.getElement());

editor.setTheme("ace/theme/twilight");
editor.session.setMode("ace/mode/javascript");
editor.setValue(editor.getValue(), 1);
editor.focus();
updateCharCount();
lintCode();

$("#submit").click(() => {
  $.post('', {rename: $("#limitsInput").val(), code: editor.getValue()}, url => {
    window.location.replace(url);
  });
});

codeArea.keyup(() => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(lintCode, 250);
});

codeArea.keydown(() => {
  clearTimeout(typingTimer);
});

codeArea.bind('change keyup paste', updateCharCount);

socket.on('codeLinted', msg => {
  if (msg.error === null) {
    $('#results').html(msg.results);
  } else {
    $('#results').html(msg.error.formatted);
  }
});

socket.on('abuse', msg => {
  if (new Date().getTime() - lastAbuse < 1000) return;
  lastAbuse = new Date().getTime();
  noty({
    text: "An error has occurred, please try again later.",
    layout: 'top',
    type: 'error',
    theme: 'relax',
    timeout: 2500,
    closeWith: ['click'],
    animation: {
      open: 'animated flipInX',
      close: 'animated flipOutX'
    }
  });
});

function lintCode() {
  socket.emit('lintCode', {code: String(editor.getValue()).slice(0, 8192), ref});
};

function updateCharCount() {
  let len = editor.getValue().length;
  if (len >= 8192) {
    editor.setValue(editor.getValue().slice(0, 8192), 1);
  }
  $("#currentCharCount").html(numeral(len).format(','));
}

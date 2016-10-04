let socket = io($('server').html());
let ref    = $('ref').html();
let readonly = $('readonly').html();

let typingTimer, lastAbuse;
let editor = ace.edit("aceEditor");
let codeArea = $(editor.textInput.getElement());
let changed = false;

editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/javascript");
editor.setValue(editor.getValue(), 1);
editor.focus();
updateCharCount();
lintCode();

if (readonly == "true") {
  editor.setReadOnly(true);
}

$("#submit").click(() => {
  $.post('', {code: editor.getValue()}, url => {
    changed = false;
    window.location.href = url;
  });
});

codeArea.keyup(() => {
  changed = true;
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

  if (msg.logs) {
    let logs = "";
    msg.logs.forEach(log => {
      logs += log + "\n";
    });

    $("#log").val(logs + $("#log").val());
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
  socket.emit('lintSnippetCode', {code: String(editor.getValue()).slice(0, 8192), ref});
};

function updateCharCount() {
  let len = editor.getValue().length;
  if (len >= 8192) {
    editor.setValue(editor.getValue().slice(0, 8192), 1);
  }
  $("#currentCharCount").html(numeral(len).format(','));
}

function clearLog() {
  $("#log").val('');
}


window.onbeforeunload = function() {
  if (changed) {
    return "You haven't saved your changes.";
  }
};

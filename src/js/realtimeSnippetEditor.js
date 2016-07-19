socket = io($('server').html());
ref = $('ref').html();

let editor = ace.edit("aceEditor");
editor.setTheme("ace/theme/twilight");
editor.session.setMode("ace/mode/javascript");
editor.setValue(editor.getValue(), 1);
editor.focus();

$("#submit").click(() => {
  $.post('', {code: editor.getValue()}, url => {
    window.location.replace(url);
  });
});

updateCharCount();
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

codeArea.bind('change keyup paste', updateCharCount);

socket.on('codeLinted', msg => {
  if (msg.error === null) {
    $('#results').html(msg.results);
  } else {
    $('#results').html(msg.error.formatted);
  }
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

function revisionPublishPrompt(ref, name, rev) {
  notyPrompt(`Are you sure you want to publish revision ${rev} of Snippet ${name}?`, () => {
    $.post('', {code: editor.getValue()}, () => {
      $.get('publish/snippet/' + ref + '/confirm', function (loc) {
        window.location.replace(loc);
      });
    });
  }, () => {

  });
}

let typingTimer;
let search = $('#search');
let socket = io($('server').html());
let selected, snippets;

$(() => {
  search.keyup(() => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(submitQuery, 250);
  });

  search.keydown(() => {
    clearTimeout(typingTimer);
  });

  socket.on('searchResults', msg => {
    $('#found').css('visibility', 'visible');
    if (search.val() === "") $('#found').css('visibility', 'hidden');

    let total = Object.keys(msg).length;
    snippets  = msg;

    $('#foundNum').html(total);
    $('#s').html(total === 1 ? '' : 's');
    $('#results tbody').empty();
    $('#snippetInfo').empty();
    _.each(msg, result => {
      $('#results tbody').append(`
        <tr data-id="${result.id}">
          <td>${result.name}</td>
          <td class="date" data-date="${result.created}"></td>
          <td class="date" data-date="${result.modified}"></td>
          <td>${result.user}</td>
        </tr>`);
    });
    updateDates();
    $('#results tbody tr').click(function() {
      $('#results tbody tr').removeClass('selected');
      selected = $(this).data('id');
      $(this).addClass('selected');
      snippetInfo($(this).data('id'))
    });
  });

  socket.on('snippetResults', msg => {
    $('#snippetInfo').empty();

    let revisions = "<select name='revision'>";
    for (let i = msg.version; i >= 1; i--) {
      revisions += `<option value='${i}'>${i}</option>`;
    }
    revisions += "</select>";
    $('#snippetInfo').append(`
      <h3>${snippets[msg.snippetID].name}</h3>
      Choose a revision:
      ${revisions}
      <p>Owner: ${snippets[msg.snippetID].user}<br>
      Total revisions: ${msg.version}<br>
      Tags: ${snippets[msg.snippetID].tags.join(", ")}
      </p>
      <div id="revisionInfo">
        <p>
        Created: <span id="created" class="date" data-date="${snippets[msg.snippetID].created}"></span><br>
        Modified: <span id="modified" class="date" data-date="${snippets[msg.snippetID].modified}"></span><br>
        </p>
        Description<br>
        <textarea id='description' rows='7' readonly>${snippets[msg.snippetID].description}</textarea>
        Usage
        <pre><code id='usage' class="javascript">const mySnippet = require('${snippets[msg.snippetID].user}/${snippets[msg.snippetID].name}/${msg.version}');</code></pre>
      </div>
    `);

    $('pre code').each(function(i, block) {
      hljs.highlightBlock(block);
    });

    $("select[name='revision']").change(updateRevision);

    updateDates();
  });
});

function updateRevision() {
  let self = this;
  $.when($.ajax(`ajax/snippetLookup/${snippets[selected].ref}/${$(this).val()}`)).then(function(data) {
    console.log(data);
    $('#created').data('date', data.created);
    $('#modified').data('date', data.modified);
    $('#description').val(data.description);
    $('#usage').html(`const mySnippet = require('${snippets[selected].user}/${snippets[selected].name}/${$(self).val()}');`);

    $('pre code').each(function(i, block) {
      hljs.highlightBlock(block);
    });
    
    updateDates();
  });
}

function submitQuery() {
  socket.emit('search', {query: search.val().slice(0, 255)});
}

function snippetInfo(id) {
  socket.emit('snippet', {id});
}

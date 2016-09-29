socket = io($('server').html());

let typingTimer, lastAbuse;
let editor   = ace.edit("aceEditor");
let codeArea = $(editor.textInput.getElement());

editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/javascript");
editor.setValue(editor.getValue(), 1);
editor.focus();
lintCode();

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
  socket.emit('lintDemoCode', {code: String(editor.getValue()).slice(0, 8192), ref: null});
};

function example() {
  $('html, body').animate({scrollTop:0}, 'medium', () => {
    editor.setValue(`const faker  = require('faker');
const moment = require('moment');

// Name
api.first = faker.name.firstName();
api.last  = faker.name.lastName();

// Choose a random email format
api.email = list([
    \`\${api.first}.\${api.last}@\${faker.internet.domainName()}\`,
    randomEmail()
]).replace(/ /g, '');

api.address = faker.address.streetAddress();

// Created 30 - 900 days ago
let created = timestamp() - 86400 * random.numeric(30, 3600);
api.created = moment(created * 1000).format('LL');

api.balance = (random.numeric(1, 1000000) * .01)
  .toLocaleString("en-US", {
      style: "currency",
      currency: "usd",
      minimumFractionDigits: 2
  }
);

function randomEmail() {
    return faker.commerce.color() +
    list(['rabbit', 'wolf', 'frog', 'turtle', 'giraffe', 'squirrel']) +
    String(random.special(4, 2)) + "@gmail.com";
}`, -1);
  lintCode();
  });
}

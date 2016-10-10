$(() => {
  newExample();
});

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

// Created 30 - 3600 days ago
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


function newExample() {
  let samples = [
`// Example of a random customer generator
const faker = require('faker'); // Faker.js

api.customer  = {
    id:    random.special(4, 8),
    name:  faker.name.findName(),
    phone: faker.phone.phoneNumber("(###) ###-####"),
    address: {
        street: faker.address.streetAddress(),
        city: faker.address.city(),
        state: faker.address.state(),
    }
};`,

`// Example of a random user purchase invoice
const moment = require('moment'); // moment.js to format dates

// Generate fake credit card numbers
const cc = require('keith/Credit Card Generator/2');

// User defined code to generate invoice numbers
api.invoiceID = require('keith/invoice number generator/1')();
api.date = moment().format('LLL');

// Inline list of products to choose from
let products = {
    milk: 229, eggs: 100, bread: 243, butter: 200,
    juice: 369, cereal: 312, poptarts: 371, sprite: 1077,
    mentos: 330, beer: 945, apple: 75, avocado: 85
};

api.itemsPurchased = random.numeric(1, 10);
api.items = [];

let total = 0;
for (let i = 0; i < api.itemsPurchased; i++) {
    let item = list(products);
    api.items.push(item);
    total += products[item];
}
api.items = api.items.toString();
api.card  = cc('VISA').toString().match(/.{4}/g).join('-');
api.total = \`$\${total/100}\`;`,

`// Example of a random user generator
const faker = require('faker'); // Faker.js library

// Custom user snippet to generate formatted phone numbers
const phonenum = require('keith/phonenum/1');

api.company  = faker.company.companyName();
api.username = faker.internet.userName();
api.password = faker.internet.password();
api.role     = list(['guest', 'user', 'administrator']);
api.phone    = phonenum();
api.cell     = phonenum(\`(\${list(['214', '469', '972'])}) xxx-xxxx\`);`,

`// Geocaching API demo from http://blog.randomapi.com/geocaching-api-demo/
const faker  = require('faker'); // Faker.js library
const moment = require('moment');

api.name       = trailname();
api.username   = faker.internet.userName();
api.rating     = random.numeric(0, 50) / 10;
api.favorites  = Math.ceil(api.rating * random.numeric(1, 15));
api.visits     = api.favorites * random.numeric(1, 15)
api.difficulty = random.numeric(1, 5);
api.terrain    = random.numeric(1, 5);
api.size       = list(['mini', 'small', 'medium', 'big', 'large']);

// Created 30 - 900 days ago
let created = timestamp() - 86400 * random.numeric(30, 900);

// Moment accepts timestamps in milliseconds
api.created = moment(created * 1000).format('LL');

// Updated date will be before the present but after the creation date
let updated = timestamp() - random.numeric(0, timestamp() - created);
api.updated = moment(updated * 1000).format('LL');

api.coords = \`\${faker.address.latitude()} \${faker.address.longitude()}\`;

// Snippet code
function trailname() {
    let trails     = ["trail", "path", "route", "stream", "walkway", "beaten path", "footpath"]
    let adjectives = ["dusty", "old", "scenic", "historic", "shady", "sunny"];
    let colors     = ["red", "orange", "yellow", "green", "blue", "indigo", "violet"];

    let combos = [
        [colors, trails],
        [adjectives, trails],
        [colors, adjectives, trails]
    ];

    let trailName = "";
    list(combos).forEach(part => trailName += " " + capitalize(list(part)));

    return trailName.trim();

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}`];

  let currentSample = Math.floor(Math.random()*samples.length);

  editor.setValue(samples[++currentSample%samples.length], -1);
  lintCode();

  newExample = () => {
    editor.setValue(samples[++currentSample%samples.length], -1);
    lintCode();
  };
}

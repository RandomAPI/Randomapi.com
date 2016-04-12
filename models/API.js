var mongoose     = require('mongoose');
var findOrCreate = require('mongoose-findorcreate')

var APISchema = mongoose.Schema({
    name: String,
    id: String
});

APISchema.plugin(findOrCreate);

var API = mongoose.model('API', APISchema);

module.exports = API;

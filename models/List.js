var mongoose     = require('mongoose');
var findOrCreate = require('mongoose-findorcreate')

var ListSchema = mongoose.Schema({
    name: String,
    id: String
});

ListSchema.plugin(findOrCreate);

var List = mongoose.model('List', ListSchema);

module.exports = List;

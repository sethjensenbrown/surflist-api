const mongoose = require ('mongoose');

const boardSchema = mongoose.Schema({
	'title': {type: String, required: true},
	'price': {type: Number, required: true},
	'description': {type: String, required: true},
	'state': {type: String, required: true},
	'zip': {type: Number, required: true},
	'location': {
		'type': {type: String, required: true},
		'coordinates': {type: Array, required: true}
	},
	'board-type': {type: String, required: true},
	'board-condition': {type: String, required: true},
	'image': {type: String, required: true},
	'email': {type: String, required: true}
});

boardSchema.index({location : "2dsphere" });

const Boards = mongoose.model('Boards', boardSchema);

module.exports = {Boards};
const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');

const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');
const {TEST_BOARDS_SEED_DATA} = require('../TEST_BOARDS_SEED_DATA');
const {Boards} = require('../models')

const should = chai.should();
chai.use(chaiHttp);

function seedDb() {
	console.log('seeding database');
	Boards.insertMany(TEST_BOARDS_SEED_DATA);
	return Boards.ensureIndexes();
};

function tearDownDb() {
	console.warn('deleting database');
	return mongoose.connection.dropDatabase();
};

describe('Surflist API', function() {

	before(function() {
		return runServer(TEST_DATABASE_URL);
	});

	beforeEach(function() {
		return seedDb();
	});

	afterEach(function() {
		return tearDownDb();
	});

	after(function() {
		return closeServer();
	});

	describe('/boards GET endpoint', function() {

		it('should return boards on GET requests', function() {
		    return chai.request(app)
		    	.get('/api/boards')
		    	.then(function(res) {
		        	res.should.have.status(200);
		        	res.should.be.json;
		        	res.body.forEach(function(board) {
			        	board.should.have.keys("_id", "title", "price", 
			        		"description", "state", "zip", "board-type", 
			        		"board-condition", "email", "image", "__v", "location");
			        	board.location.should.have.all.keys('type', 'coordinates');
						board.location.type.should.equal('Point');
					});
		    	});
		});

		it('should filter results when given a query', function() {
			return chai.request(app)
		    	.get('/api/boards?state=CA')
		    	.then(function(res) {
		        	res.should.have.status(200);
		        	res.should.be.json;
		        	res.body.forEach(function(board) {
		        		board.state.should.equal('CA');
		        	});
		    	});
		});	

		it('should be able to filter results geospatially', function() {
			return chai.request(app)
				//filters for location in CA, so all results should be in CA
		    	.get('/api/boards?radius=15&lat=34.1657707&lng=-118.1181199')
		    	.then(function(res) {
		        	res.should.have.status(200);
		        	res.should.be.json;
		        	res.body.forEach(function(board) {
		        		board.state.should.equal('CA');
		        	});
		    	});
		});	

	});

	describe('/boards POST endpoint', function() {

		it('should add a new board to the database and send a verification email', function() {
			let testBoard = {
				"title": "Funny Shaped Board",
				"price": 230,
				"description": "fun, good condition. Just has a funny shape.",
				"state": "CA",
				"zip": 91210,
				"board-type": "shortboard",
				"board-condition": "decent",
				"email": "sethjensenbrown@gmail.com",
				"image": "https://res.cloudinary.com/sethjensenbrown/image/upload/v1510220144/kukqbkunx8jmby09rb1e.jpg",
				"location": {
					"type": "Point",
					"coordinates": [-118.2563169, 34.144801]
				}
			}
			return chai.request(app)
				.post(`/api/boards`)
				.send(testBoard)
				.then(function(res) {
					res.should.have.status(201);
					res.should.be.json;
					res.body.message.should.equal('Board successfully added');
					res.body.id.should.not.be.null;
					res.body.emailSent.should.be.true;
					return Boards.findById(res.body.id);
				})
				.then(function(board) {
					board.title.should.equal(testBoard.title);
					board.price.should.equal(testBoard.price);
					board.description.should.equal(testBoard.description);
					board.state.should.equal(testBoard.state);
					board.zip.should.equal(testBoard.zip);
					board['board-type'].should.equal(testBoard['board-type']);
					board['board-condition'].should.equal(testBoard['board-condition']);
					board.email.should.equal(testBoard.email);
					board.image.should.equal(testBoard.image);
					board.location.type.should.equal(testBoard.location.type);
					board.location.coordinates[0].should.equal(testBoard.location.coordinates[0]);
					board.location.coordinates[1].should.equal(testBoard.location.coordinates[1]);
				});
		});

	});

	describe('/boards PUT endpoint', function() {

		it('should update an existing spot', function() {
			let updateBoard = {
				"title": "Funny Shaped Board",
				"price": 230,
				"description": "fun, good condition. Just has a funny shape.",
				"state": "CA",
				"zip": 91210,
				"board-type": "shortboard",
				"board-condition": "decent",
				"email": "surflist.info@gmail.com",
				"image": "https://res.cloudinary.com/sethjensenbrown/image/upload/v1510220144/kukqbkunx8jmby09rb1e.jpg",
				"location": {
					"type": "Point",
					"coordinates": [-118.2563169, 34.144801]
				}
			};
			return Boards.findOne()
				.then(function(board) {
					updateBoard._id = board._id;
					return chai.request(app)
						.put(`/api/boards?_id=${board._id}`)
						.send(updateBoard);
				})
				.then(function(res) {
					res.should.have.status(201);
					res.should.be.json;
					res.body.message.should.equal('Board successfully updated');
					res.body.id.should.not.be.null;
					return Boards.findById(res.body.id);
				})
				.then(function(board) {
					board.title.should.equal(updateBoard.title);
					board.price.should.equal(updateBoard.price);
					board.description.should.equal(updateBoard.description);
					board.state.should.equal(updateBoard.state);
					board.zip.should.equal(updateBoard.zip);
					board['board-type'].should.equal(updateBoard['board-type']);
					board['board-condition'].should.equal(updateBoard['board-condition']);
					board.email.should.equal(updateBoard.email);
					board.image.should.equal(updateBoard.image);
					board.location.type.should.equal(updateBoard.location.type);
					board.location.coordinates[0].should.equal(updateBoard.location.coordinates[0]);
					board.location.coordinates[1].should.equal(updateBoard.location.coordinates[1]);
				});
		});

	});

	describe('/boards DELETE endpoint', function() {

		it('should delete a board', function() {
			let deleteID;
			return Boards
				.findOne()
				.then(function(board) {
					deleteID = board._id
					return chai.request(app)
						.delete(`/api/boards?_id=${deleteID}`)
				})
				.then(function(res) {
					res.should.have.status(204);
					return Boards.findById(deleteID);
				})
				.then(function(nonSpot) {
					should.not.exist(nonSpot);
				});
		});

	});

	describe('/offers POST endpoint', function() {

		it('should send an email to the seller', function() {
			let offer = {
				email: 'surflist.info@gmail.com',
				message: 'how about $100000?!!!'
			};
			return Boards.findOne()
				.then(function(board) {
					return chai.request(app)
						.post(`/api/offer?_id=${board._id}`)
						.send(offer);
				})
				.then(function(res) {
					res.should.have.status(200);
					res.should.be.json;
					res.body.message.should.equal('Offer successfully sent');
					res.body.id.should.not.be.null;
					res.body.emailSent.should.be.true;
				})
		});

	});
	
});
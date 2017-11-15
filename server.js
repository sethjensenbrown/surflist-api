//SETUP

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
var request = require("request");

//forces mongoose to use es6 promises instead of it's own
mongoose.Promise = global.Promise;

const app = express();
const {PORT, DATABASE_URL, CLIENT_ORIGIN, SENDINBLUE_API_KEY} = require('./config');
const {Boards} = require('./models');

app.use(
    cors({
        origin: CLIENT_ORIGIN
    })
);
app.use(bodyParser.json());
app.use(morgan('common'));

/************************************************************/

//API

//GET request returns boards filtered by query
app.get('/api/boards/', (req, res) => {
	let query = req.query;
	//now sort query and convert to mongoDB query notation
	let dbQuery = {};
	if(query._id) {
		dbQuery._id = query._id;
	}
	//this is the mongoDB geolocation query format
	if(query.lat && query.lng && query.radius) {
        dbQuery.location = { 
            $near: {
                $geometry: { 
                    type: "Point",  
                    coordinates: [
                        parseFloat(query.lng, 10), 
                        parseFloat(query.lat, 10)
                    ] 
                },
                $maxDistance: (parseInt(query.radius, 10)*1609) //conversion from mi to m
            }
        }
	}
	//matches state name
	if(query.state) {
	    dbQuery.state = query.state;
	}
	//filters price
	if (query['price-min']) {
	    dbQuery.price = {$gt: query['price-min']};
	}
	if (query['price-max']) {
	    dbQuery.price = Object.assign({}, dbQuery.price, {$lt: query['price-max']});
	}
	//filters board-condition using $in: array format
	//allows for multiple conditions
	if (query['new'] === 'true') {
	    dbQuery['board-condition'] = {'$in': ['new']};
	}
	if (query['great'] === 'true') {
	    if(dbQuery['board-condition']) {
	        dbQuery['board-condition']['$in'].push('great');
	    }
	    else {
	        dbQuery['board-condition'] = {'$in': ['great']};
	    }
	}
	if (query['decent'] === 'true') {
	    if(dbQuery['board-condition']) {
	        dbQuery['board-condition']['$in'].push('decent');
	    }
	    else {
	        dbQuery['board-condition'] = {'$in': ['decent']};
	    }
	}
	if (query['wrecked'] === 'true') {
	    if(dbQuery['board-condition']) {
	        dbQuery['board-condition']['$in'].push('wrecked');
	    }
	    else {
	        dbQuery['board-condition'] = {'$in': ['wrecked']};
	    }
	}
	//filters board-type using $in: array format
	//allows for multiple conditions
	if (query['shortboard'] === 'true') {
	    dbQuery['board-type'] = {'$in': ['shortboard']};
	}
	if (query['funboard'] === 'true') {
	    if(dbQuery['board-type']) {
	        dbQuery['board-type']['$in'].push('funboard');
	    }
	    else {
	        dbQuery['board-type'] = {'$in': ['funboard']};
	    }
	}
	if (query['longboard'] === 'true') {
	    if(dbQuery['board-type']) {
	        dbQuery['board-type']['$in'].push('longboard');
	    }
	    else {
	        dbQuery['board-type'] = {'$in': ['longboard']};
	    }
	}
	if (query['sup'] === 'true') {
	    if(dbQuery['board-type']) {
	        dbQuery['board-type']['$in'].push('sup');
	    }
	    else {
	        dbQuery['board-type'] = {'$in': ['sup']};
	    }
	}
	console.log(dbQuery);
	//then does the actual db query
	Boards
		.find(dbQuery)
		.then((results) => res.status(200).json(results))
		.catch((err) => {
			console.error(err);
			res.status(500).json({message: 'Internal server error'});
		});
});;

//POST request adds new board to database and sends conrol email to user's provided email
app.post('/api/boards/', (req, res) => {
	Boards
		.create(req.body)
		.then((newBoard) => {
			console.log(`Added Board with _id: ${newBoard._id}`);

			//sends email to user when board is posted using SendInBlue API
			//email contains link to the posting and edit/delete portal
			var options = { method: 'POST',
			  url: 'https://api.sendinblue.com/v3/smtp/email',
			  body: 
			   { sender: { email: 'surflist.info@gmail.com' },
			   	 to: [ { email: `${newBoard.email}` } ],
			     htmlContent: '<h1 style="font-family: Helvetica;font-weight: normal;font-size: 40px">surflist.</h1>' +
        			'<h5 style="font-family: Helvetica;font-weight: normal;font-size: 16px">buy + sell surfboards</h5>' +
			        '<hr />' +
			        '<p>Congratulations! Your board is all set up on Surflist! ' + 
			        'To see your post or share it with your friends, check out this link: </p>' +
			        `<a href="${CLIENT_ORIGIN}/board?_id=${newBoard._id}">${CLIENT_ORIGIN}/board?_id=${newBoard._id}</a>` +
			        '<p>If you want to make any changes to what you posted, ' +
			        'or delete your board from SurfList, check out this link:</p>' +
			        `<a href="${CLIENT_ORIGIN}/edit-board?_id=${newBoard._id}">${CLIENT_ORIGIN}/edit-board?_id=${newBoard._id}</a>` +
			        '<p>Otherwise, sit back and watch the offers roll in! ' +
			        'If you have any questions, reach out to us by email at ' + 
			        '<a href="mailto:surflist.info@gmail.com?Subject=SurfList%20 Seller%20Question">' +
			        'surflist.info@gmail.com</a></p>',
			     subject: `Your Board for Sale on SurfList`,
			     replyTo: { email: 'surflist.info@gmail.com' } },
			  json: true, 
			  headers: { 
			  	'api-key': SENDINBLUE_API_KEY
			  }
			};
			request(options, function (error, response, body) {
			  if (error) throw new Error(error);
			  console.log(body);
			  res.status(201).json({
				message: `Board successfully added`,
				id: `${newBoard._id}`,
				emailSent: true});
			});
		})
		.catch(err => {
			console.error(err);
			response.status(500).json({message: 'Internal server error'});
		});
});

//PUT endpoint for editing boards
app.put('/api/boards/', (req, res) => {
	if (!(req.query._id === req.body._id)) {
		res.status(400).json({error: 'Request path id must match request body id'});
	}
	else {
		Boards
			.findByIdAndUpdate(req.query._id, {$set: req.body}, {new: true})
			.then(() => {
				console.log(`Updated Board with _id: ${req.query._id}`);
				res.status(201).json({message: 'Board successfully updated',
					id: `${req.query._id}`});
			})
			.catch(err => {
				console.error(err);
				response.status(500).json({message: 'Internal server error'});
			});
	}

});

//DELETE endpoint for boards
app.delete('/api/boards/', (req,res) => {
	Boards
		.findByIdAndRemove(req.query._id)
		.then(() => {
			console.log(`Deleted Board with _id: ${req.query._id}`);
			res.status(204).end();
		})
		.catch((err) => {
			console.error(err)
			res.status(500).json({message: 'Internal server error'});
		});
}); 

//Make an Offer email endpoint
app.post('/api/offer/', (req, res) => {
	//find the board info for the board being offered
	let board = {};
	Boards
		.find({_id: req.query._id})
		.then(_res => {
			let board = _res[0];
			//sends email to user who posted the board with the message and email address provided by the user making the offer
			var options = { method: 'POST',
			  url: 'https://api.sendinblue.com/v3/smtp/email',
			  body: 
			   { sender: { email: 'surflist.info@gmail.com' },
			   	 to: [ { email: `${board.email}` } ],
			     htmlContent: '<h1 style="font-family: Helvetica;font-weight: normal;font-size: 40px">surflist.</h1>' +
					'<h5 style="font-family: Helvetica;font-weight: normal;font-size: 16px">buy + sell surfboards</h5>' +
			        '<hr />' +
			        '<p>You got an offer for the board at this link: </p>' +
			        `<a href="${CLIENT_ORIGIN}/board?_id=${board._id}">${CLIENT_ORIGIN}/board?_id=${board._id}</a>` +
			        "<p>Here's the message and the email of the person making the offer. " +
			        "It's up to you to decide if you want to reply. Good luck, and happy haggling!</p><hr/>" +
			        `<p>Email: <a href="mailto:${req.body.email}?Subject=SurfList%20Seller%20Response">${req.body.email}</a></p>` +
			        `<p>Message: ${req.body.message}</p>`,
			     subject: `You Got an Offer on Your Board!`,
			     replyTo: { email: 'surflist.info@gmail.com' } },
			  json: true, 
			  headers: { 
			  	'api-key': SENDINBLUE_API_KEY
			  }
			};
			let responseBody;
			request(options, function (error, response, body) {
			  if (error) throw new Error(error);
			  console.log(body);
			  res.status(200).json({message: 'Offer successfully sent',
					id: `${req.query.id}`,
					emailSent: true});
			}); 

		})
		.catch((err) => {
			console.error(err)
			res.status(500).json({message: 'Internal server error'});
		});
});


/************************************************************/

//SERVER CONTROLS

// closeServer needs access to a server object, but that only
// gets created when `runServer` runs, so we declare `server` here
// and then assign a value to it in run
let server;

// this function connects to our database, then starts the server
function runServer(databaseUrl, port=PORT) {

  return new Promise((resolve, reject) => {
    mongoose.connect(databaseUrl || DATABASE_URL, {useMongoClient: true} ,err => {
      if (err) {
        return reject(err);
      }
      server = app.listen(port, () => {
        console.log(`Your app is listening on port ${port}`);
        resolve();
      })
      .on('error', err => {
        mongoose.disconnect();
        reject(err);
      });
    });
  });
}

// this function closes the server, and returns a promise. we'll
// use it in our integration tests later.
function closeServer() {
  return mongoose.disconnect().then(() => {
     return new Promise((resolve, reject) => {
       console.log('Closing server');
       server.close(err => {
           if (err) {
               return reject(err);
           }
           resolve();
       });
     });
  });
}

// if server.js is called directly (aka, with `node server.js`), this block
// runs. but we also export the runServer command so other code (for instance, test code) can start the server as needed.
if (require.main === module) {
  runServer().catch(err => console.error(err));
};

module.exports = {app, runServer, closeServer};
//SETUP

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

//forces mongoose to use es6 promises instead of it's own
mongoose.Promise = global.Promise;

const app = express();
const {PORT, DATABASE_URL, CLIENT_ORIGIN} = require('./config');
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
	if(query.zip) {
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
	if (query['condition-new']) {
	    dbQuery['board-condition'] = {'$in': ['condition-new']};
	}
	if (query['condition-great']) {
	    if(dbQuery['board-condition']) {
	        dbQuery['board-condition']['$in'].push('condition-great');
	    }
	    else {
	        dbQuery['board-condition'] = {'$in': ['condition-great']};
	    }
	}
	if (query['condition-decent']) {
	    if(dbQuery['board-condition']) {
	        dbQuery['board-condition']['$in'].push('condition-decent');
	    }
	    else {
	        dbQuery['board-condition'] = {'$in': ['condition-decent']};
	    }
	}
	if (query['condition-wrecked']) {
	    if(dbQuery['board-condition']) {
	        dbQuery['board-condition']['$in'].push('condition-wrecked');
	    }
	    else {
	        dbQuery['board-condition'] = {'$in': ['condition-wrecked']};
	    }
	}
	//filters board-condition using $in: array format
	//allows for multiple conditions
	if (query['type-short']) {
	    dbQuery['board-type'] = {'$in': ['type-short']};
	}
	if (query['type-fun']) {
	    if(dbQuery['board-type']) {
	        dbQuery['board-type']['$in'].push('type-fun');
	    }
	    else {
	        dbQuery['board-type'] = {'$in': ['type-fun']};
	    }
	}
	if (query['type-long']) {
	    if(dbQuery['board-type']) {
	        dbQuery['board-type']['$in'].push('type-long');
	    }
	    else {
	        dbQuery['board-type'] = {'$in': ['type-long']};
	    }
	}
	if (query['type-sup']) {
	    if(dbQuery['board-type']) {
	        dbQuery['board-type']['$in'].push('type-sup');
	    }
	    else {
	        dbQuery['board-type'] = {'$in': ['type-sup']};
	    }
	}
	//then does the actual db query
	Boards
		.find(dbQuery)
		.then((results) => res.status(200).json(results))
		.catch((err) => {
			console.error(err);
			res.status(500).json({message: 'Internal server error'});
		});
});;

//POST request adds new board to database
app.post('/api/boards/', (req, res) => {
	Boards
		.create(req.body)
		.then((newBoard) => {
			console.log(`Added Board with _id: ${newBoard._id}`)
			res.status(201).json({message: 'Board successfully added'});
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
				res.status(201).json({message: 'Board successfully updated'});
			})
			.catch(err => {
				console.error(err);
				response.status(500).json({message: 'Internal server error'});
			});
	}

});

//DELETE endpoint
app.delete('/api/boards/', (req,res) => {
	Boards
		.findByIdAndRemove(req.query._id)
		.then(() => {
			console.log(`Deleted Board with _id: ${req.query._id}`);
			res.status(204).json({message: 'Board successfully deleted'});
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
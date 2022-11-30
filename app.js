const express = require('express');
const app = express();

const { Datastore } = require('@google-cloud/datastore');
const datastore = new Datastore();
const { entity } = require('@google-cloud/datastore/build/src/entity');

const bodyParser = require('body-parser');
app.use(bodyParser.json());

app.enable('trust proxy');

const USER = 'User'; 
const BOAT = 'Boat';
const LOAD = 'Load'; 

var errorRes = {
  400: {"Error": "At least one attribute is missing and/or invalid"}, 
  406: {"Error": "MIME type not acceptable, response must be JSON"},
  415: {"Error": "MIME type not acceptable, request must be JSON"}
};

/* ------------- GENERAL FUNCTIONS (start) ------------- */
function catchAddBoatErr(req) {
  const accepts = req.accepts(['application/json']);
  if(req.get('content-type') !== 'application/json'){          
    // Status 415 MIME type request not acceptable
    return 415
  } else if (!accepts) {                                       
    // Status 406 MIME type response not acceptable
    return 406
  } else if (req.body.name == undefined || req.body.type == undefined || req.body.length == undefined ){   
    // Status 400 missing attribute
    return 400
  } else if (Object.keys(req.body).length > 3) {
    // Status 400 extra invalid attributes
    return 400
  } else if (Object.keys(req.body.name).length > 20 || Object.keys(req.body.type).length > 20) {
    // Status 400 attributes too long
    return 400
  } else if (typeof req.body.name != 'string' || typeof req.body.type != 'string' || typeof req.body.length != 'number') {
    // Status 400 invalid attributes types
    return 400
  } else if (req.body.name == "" || req.body.type == "" || req.body.length <= 0 || req.body.length > 100000) {
    // Status 400 invalid attributes
    return 400
  } 
}

function catchAddLoadErr(req) {
  const accepts = req.accepts(['application/json']);
  if(req.get('content-type') !== 'application/json'){          
    // Status 415 MIME type request not acceptable
    return 415
  } else if (!accepts) {                                       
    // Status 406 MIME type response not acceptable
    return 406
  } else if (req.body.volume == undefined || req.body.item == undefined || req.body.creationDate == undefined ){   
    // Status 400 missing attribute
    return 400
  } else if (Object.keys(req.body).length > 3) {
    // Status 400 extra invalid attributes
    return 400
  } else if (Object.keys(req.body.item).length > 20 || Object.keys(req.body.creationDate).length > 20) {
    // Status 400 attributes too long
    return 400
  } else if (typeof req.body.volume != 'number' || typeof req.body.item != 'string' || typeof req.body.creationDate != 'string') {
    // Status 400 invalid attributes types
    return 400
  } else if (req.body.volume <= 0 || req.body.item == "" || req.body.creationDate == "" || req.body.volume > 100000) {
    // Status 400 invalid attributes
    return 400
  } 
}

/* ------------- GENERAL FUNCTIONS (end) ------------- */


/* ------------- MODEL FUNCTIONS (start) ------------- */
async function addBoat(req) {
  const isError = catchAddBoatErr(req)
  if (isError != null ) {
    return isError
  } else {
    var key = datastore.key(BOAT);
    let newBoat = { "name": req.body.name, "type": req.body.type, "length": req.body.length, "loads": [] };
    let results = await datastore.save({ "key": key, "data": newBoat }).then(() => { return key });
    newBoat["id"] = parseInt(results.id)
    return newBoat
  }
};

async function addLoad(req) {
  const isError = catchAddLoadErr(req)
  if (isError != null ) {
    return isError
  } else {
    var key = datastore.key(LOAD);
    let newLoad = { "volume": req.body.volume, "item": req.body.item, "creationDate": req.body.creationDate, "carrier": null };
    let results = await datastore.save({ "key": key, "data": newLoad }).then(() => { return key });
    newLoad["id"] = parseInt(results.id)
    return newLoad
  }
};

/* ------------- MODEL FUNCTIONS (end) ------------- */


/* ------------- CONTROLLER FUNCTIONS (start) ------------- */
// Add boat
app.post('/boats', (req, res) => {
    addBoat(req)
      .then(results => { 
        if (typeof results == "number") {
          res.status(results).json(errorRes[results])
        } else {
          let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + results.id
          results["self"] = self
          res.status(201).json(results);
        } 
      });
});

// Add load
app.post('/loads', (req, res) => {
  addLoad(req)
    .then(results => { 
      if (typeof results == "number") {
        res.status(results).json(errorRes[results])
      } else {
        let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/loads/" + results.id
        results["self"] = self
        res.status(201).json(results);
      } 
    });
});


/* ------------- CONTROLLER FUNCTIONS (end) ------------- */

// Listen to the App 
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});
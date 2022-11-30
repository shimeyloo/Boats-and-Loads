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

/* ------------- GENERAL FUNCTIONS ------------- */
function catchError(req) {
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

/* ------------- MODEL FUNCTIONS ------------- */
async function addBoat(name, type, length, req) {
  const isError = catchError(req)
  if (isError != null ) {
    return isError
  } else {
    var key = datastore.key(BOAT);
    let newBoat = { "name": name, "type": type, "length": length };
    let results = await datastore.save({ "key": key, "data": newBoat }).then(() => { return key });
    return results
  };
};


/* ------------- CONTROLLER FUNCTIONS ------------- */
// Adds boat
app.post('/boats', (req, res) => {
    addBoat(req.body.name, req.body.type, req.body.length, req)
      .then(key => { 
        if (typeof key == "number") {
          res.status(key).json(errorRes[key])
        } else {
          let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + key.id
          let newBoat = { 
            "id": parseInt(key.id), 
            "name": req.body.name, 
            "type": req.body.type, 
            "length": req.body.length, 
            "self": self 
          }
          // Status 201 is used because something new was created
          res.status(201).json(newBoat);
        } 
      })
});


// Listen to the App 
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});
const express = require('express');
const app = express();

const { Datastore } = require('@google-cloud/datastore');
const datastore = new Datastore();
const { entity } = require('@google-cloud/datastore/build/src/entity');

const bodyParser = require('body-parser');
app.use(bodyParser.json());
const request = require('request');

const handlebars = require('express-handlebars');

const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require('jwks-rsa');

app.enable('trust proxy');

const USER = 'User'; 
const BOAT = 'Boat';
const LOAD = 'Load'; 

const CLIENT_ID = '4aX5xB4pKX5grZ22br5Z0MQVqlCt9TvL';
const CLIENT_SECRET = 'IS_ZBh4vcCu45pz0wuLj38h9rEYmOOR2DL6gRBT-3MERqJi1nD2OfCZ4PkSarWhT';
const DOMAIN = 'boats-and-loads.us.auth0.com';
const REDIRECT_URI = 'https://boats-and-loads-370115.wl.r.appspot.com/oauth'
const SCOPE = 'openid email profile'

var errorRes = {
  400: {"Error": "At least one attribute is missing and/or invalid"}, 
  401: {"Error": "Missing or invalid JWT"},
  404: {"Error": "No entity with this id exists"},
  406: {"Error": "MIME type not acceptable, response must be JSON"},
  415: {"Error": "MIME type not acceptable, request must be JSON"}
};

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${DOMAIN}/.well-known/jwks.json`
  }),
  // Validate the audience and the issuer.
  issuer: `https://${DOMAIN}/`,
  algorithms: ['RS256']
});

/* ------------- GENERAL FUNCTIONS (start) ------------- */
function fromDatastore(item) {
  item.id = item[Datastore.KEY].id;
  return item;
};

async function getEntity(id, type) {
  const key = await datastore.key([type, parseInt(id, 10)]);
  return datastore.get(key).then((entity) => {
    if (entity[0] === undefined || entity[0] === null) {
      return entity; 
    } else {
      return entity.map(fromDatastore); 
    };
  });
};

async function changeCarrierName(loads, newName) {
  for (let eachLoad of loads){
    let load = await getEntity(eachLoad["id"], LOAD).then((l) => { return l })
    load[0]["carrier"]["name"] = newName
    let key = datastore.key([LOAD, eachLoad["id"]]);
    await datastore.save({"key": key, "data": load[0]});
  }
};

async function getEntitiesTotal(type) {
  const q = datastore.createQuery(type); 
  let allEntities = await datastore.runQuery(q).then((entity) => {return entity[0].map(fromDatastore)});
  return allEntities.length
};

async function getAuthTotal(type, sub) {
  const q = datastore.createQuery(type); 
  let allEntities = await datastore.runQuery(q).then((entity) => {return entity[0].map(fromDatastore)});
  let authEntities = allEntities.filter(e => e.owner == sub)
  return authEntities.length
};

function parseJwt (token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
};

async function uniqueUserID(id) {
  const q = datastore.createQuery(USER); 
  let allUsers = await datastore.runQuery(q).then((entity) => {return entity[0].map(fromDatastore)});
  for (const b of allUsers) {
    if (b.uniqueID == id) { return false }
  }
  return true
};

function catchBoatErr(req) {
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
};

function catchLoadErr(req) {
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
};

function editPatchErrorBoat(req) {
  const accepts = req.accepts(['application/json']);
  if(req.get('content-type') !== 'application/json'){          
    // Status 415 MIME type request not acceptable
    return 415
  } else if (!accepts) {                                       
    // Status 406 MIME type response not acceptable
    return 406
  } else if (req.body.name == undefined && req.body.type == undefined && req.body.length == undefined ){
    // 400 - at least 1 attribute needs to be changed
    return 400
  } else if (req.body.name != undefined && req.body.type != undefined && req.body.length != undefined ){
    // 400 - can't change all 3 attributes at the same time
    return 400
  }
  if (req.body.name != undefined) {
    if (Object.keys(req.body.name).length > 20) { return 400 }
    if (req.body.name == "") { return 400 }
    if (typeof req.body.name != 'string') { return 400 }
  }
  if (req.body.type != undefined) {
    if (Object.keys(req.body.type).length > 20) { return 400 }
    if (req.body.type == "") { return 400 }
    if (typeof req.body.type != 'string') { return 400 }
  }
  if (req.body.length != undefined) {
    if (typeof req.body.length != 'number') { return 400 }
    if (req.body.length <= 0) { return 400 }
    if (req.body.length > 100000) { return 400 }
  }
  // 400 - when given extra irrelevent attribute
  const attributes = Object.keys(req.body)
  for (const a of attributes) {
    if (a != 'name' && a != 'type' && a != 'length') {
      return 400
    }
  }
};

function editPatchErrorLoad(req) {
  const accepts = req.accepts(['application/json']);
  if(req.get('content-type') !== 'application/json'){          
    // Status 415 MIME type request not acceptable
    return 415
  } else if (!accepts) {                                       
    // Status 406 MIME type response not acceptable
    return 406
  } else if (req.body.volume == undefined && req.body.item == undefined && req.body.creationDate == undefined ){
    // 400 - at least 1 attribute needs to be changed
    return 400
  } else if (req.body.volume != undefined && req.body.item != undefined && req.body.creationDate != undefined ){
    // 400 - can't change all 3 attributes at the same time
    return 400
  }
  if (req.body.item != undefined) {
    if (Object.keys(req.body.item).length > 20) { return 400 }
    if (req.body.item == "") { return 400 }
    if (typeof req.body.item != 'string') { return 400 }
  }
  if (req.body.creationDate != undefined) {
    if (Object.keys(req.body.creationDate).length > 20) { return 400 }
    if (req.body.creationDate == "") { return 400 }
    if (typeof req.body.creationDate != 'string') { return 400 }
  }
  if (req.body.volume != undefined) {
    if (typeof req.body.volume != 'number') { return 400 }
    if (req.body.volume <= 0) { return 400 }
    if (req.body.volume > 100000) { return 400 }
  }
  // 400 - when given extra irrelevent attribute
  const attributes = Object.keys(req.body)
  for (const a of attributes) {
    if (a != 'volume' && a != 'item' && a != 'creationDate') {
      return 400
    }
  }
};

/* ------------- GENERAL FUNCTIONS (end) ------------- */

/* ------------- MODEL FUNCTIONS (start) ------------- */
async function addUser(id) {
  let isUnique = await uniqueUserID(id)
  if (isUnique) {
    var key = datastore.key(USER);
    let newEntity = { "uniqueID": id };
    let results = await datastore.save({ "key": key, "data": newEntity }).then(() => { return key });
    newEntity["id"] = parseInt(results.id)
    return newEntity
  }
};

async function addBoat(req) {
  const isError = catchBoatErr(req)
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
  const isError = catchLoadErr(req)
  if (isError != null ) {
    return isError
  } else {
    var key = datastore.key(LOAD);
    let newLoad = { 
      "volume": req.body.volume, 
      "item": req.body.item, 
      "creationDate": req.body.creationDate, 
      "carrier": null,
      "owner": req.auth.sub 
    };
    let results = await datastore.save({ "key": key, "data": newLoad }).then(() => { return key });
    newLoad["id"] = parseInt(results.id)
    return newLoad
  }
};

async function getBoat(req) {
  const accepts = req.accepts(['application/json'])
  if (!accepts) { return 406 } 
  let boat = await getEntity(req.params.boat_id, BOAT)
  if (boat[0] === undefined || boat[0] === null) { return 404 }
  return boat
};

async function getLoad(req) {
  const accepts = req.accepts(['application/json'])
  if (!accepts) { return 406 } 
  let load = await getEntity(req.params.load_id, LOAD)
  if (load[0] === undefined || load[0] === null) { return 404 }
  if (load[0].owner != req.auth.sub){ return 401 }
  return load[0]
};

async function getAllUsers() {
  const q = datastore.createQuery(USER); 
  return datastore.runQuery(q).then((entity) => {
    return entity[0].map(fromDatastore);
  });
};

async function getAllBoats(req) {
  var q = datastore.createQuery(BOAT).limit(5);
  const results = {};
  if(Object.keys(req.query).includes("cursor")){
      q = q.start(req.query.cursor);
  }
  let boatsTotal = await getEntitiesTotal(BOAT)
  return datastore.runQuery(q).then( (entities) => {
          results.boats = entities[0].map(fromDatastore);
          if(entities[1].moreResults !== Datastore.NO_MORE_RESULTS ){
              results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats?cursor=" + entities[1].endCursor;
          }
          results.totalLoads = boatsTotal;
    return results;
  });
};

async function getAllLoads(req) {
  var q = datastore.createQuery(LOAD).filter('owner', '=', req.auth.sub).limit(5);
  const results = {};
  if(Object.keys(req.query).includes("cursor")){
      q = q.start(req.query.cursor);
  }
  let loadsTotal = await getAuthTotal(LOAD, req.auth.sub)
  return datastore.runQuery(q).then( (entities) => {
          results.loads = entities[0].map(fromDatastore);
          if(entities[1].moreResults !== Datastore.NO_MORE_RESULTS ){
              results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "/loads?cursor=" + entities[1].endCursor;
          }
          results.totalLoads = loadsTotal;
    return results;
  });
};

async function loadBoat(boat_id, load_id) {
  let boat = await getEntity(boat_id, BOAT)
  let load = await getEntity(load_id, LOAD)
  // Check if boat or load exist
  if (boat[0] === undefined || boat[0] === null || load[0] === undefined || load[0] === null ) {
    return 404
  } 
  // Check if load is already assigned
  if (load[0].carrier != null) {
    return 403
  }
  // Assign load to boat
  let keyBoat = datastore.key([BOAT, parseInt(boat_id, 10)]); 
  let newLoad = { "id": parseInt(load_id, 10) }
  boat[0].loads.push(newLoad);
  delete boat[0]["id"]
  let boatResults = await datastore.save({"key": keyBoat, "data": boat[0]}).then(() => { return keyBoat })
  // Assign boat to load
  let keyLoad = datastore.key([LOAD, parseInt(load_id, 10)]);
  let carrier = { "id": parseInt(boat_id, 10), "name": boat[0].name };
  load[0].carrier = carrier
  delete load[0]["id"]
  let loadResults = await datastore.save({"key": keyLoad, "data": load[0]}).then(() => { return keyLoad })

  return (boatResults, loadResults)
};

async function removeLoadBoat(boat_id, load_id) {
  let boat = await getEntity(boat_id, BOAT)
  let load = await getEntity(load_id, LOAD)
  // Check if boat or load exist
  if (boat[0] === undefined || boat[0] === null || load[0] === undefined || load[0] === null ) {
    return 404
  } 
  // Remove load from boat
  let keyBoat = datastore.key([BOAT, parseInt(boat_id, 10)]); 
  let allLoads = boat[0].loads
  let removedLoad = allLoads.filter(l => l.id == parseInt(boat_id, 10))
  if (allLoads.length == removedLoad.length) {  
    // Load not found in boat 
    return 404
  }
  boat[0].loads = removedLoad
  delete boat[0]["id"]
  let boatResults = await datastore.save({"key": keyBoat, "data": boat[0]}).then(() => { return keyBoat })
  // Remove boat from load
  let keyLoad = datastore.key([LOAD, parseInt(load_id, 10)]); 
  load[0].carrier = null
  delete load[0]["id"]
  let loadResults = await datastore.save({"key": keyLoad, "data": load[0]}).then(() => { return keyLoad })
  
  return (boatResults, loadResults)
};

async function editBoatPUT(req) {
  const isError = catchBoatErr(req)
  if (typeof isError == "number") {return isError}
  // Check if boat exists
  let boat = await getEntity(req.params.boat_id, BOAT).then((e) => { return e })
  if (boat[0] === undefined || boat[0] === null) {return 404}
  // Update new carrier name for all loads in the boat 
  changeCarrierName(boat[0]["loads"], req.body.name)
  // Edit boat 
  boat[0]["name"] = req.body.name
  boat[0]["type"] = req.body.type
  boat[0]["length"] = req.body.length
  let key = datastore.key([BOAT, parseInt(req.params.boat_id, 10)]);
  delete boat[0]["id"]
  await datastore.save({"key": key, "data": boat[0]});
  boat[0]["id"] = parseInt(req.params.boat_id, 10)
  return boat[0]
};

async function editLoadPUT(req) {
  const isError = catchLoadErr(req)
  if (typeof isError == "number") {
    return isError
  }
  // Check if load exists
  let load = await getEntity(req.params.load_id, LOAD).then((e) => { return e })
  if (load[0] === undefined || load[0] === null) { return 404 }
  // Check for corrent owner
  if (load[0].owner != req.auth.sub){ return 401 }
  // Edit load 
  load[0]["volume"] = req.body.volume
  load[0]["item"] = req.body.item
  load[0]["creationDate"] = req.body.creationDate
  let key = datastore.key([LOAD, parseInt(req.params.load_id, 10)]);
  delete load[0]["id"]
  await datastore.save({"key": key, "data": load[0]});
  load[0]["id"] = parseInt(req.params.load_id, 10)
  return load[0]
};

async function editBoatPATCH(req) {
  const isError = editPatchErrorBoat(req)
  if (typeof isError == "number") {return isError}
  // Check if boat exists
  let boat = await getEntity(req.params.boat_id, BOAT).then((e) => { return e })
  if (boat[0] === undefined || boat[0] === null) {return 404}
  // Edit boat
  if (req.body.name != undefined) { 
    boat[0]["name"] = req.body.name 
    changeCarrierName(boat[0]["loads"], req.body.name)
  };
  if (req.body.type != undefined) { boat[0]["type"] = req.body.type };
  if (req.body.length != undefined) { boat[0]["length"] = req.body.length };
  let key = datastore.key([BOAT, parseInt(req.params.boat_id, 10)]);
  delete boat[0]["id"]
  await datastore.save({"key": key, "data": boat[0]});
  boat[0]["id"] = parseInt(req.params.boat_id, 10)
  return boat[0]
};

async function editLoadPATCH(req) {
  const isError = editPatchErrorLoad(req)
  if (typeof isError == "number") {return isError}
  // Check if load exists
  let load = await getEntity(req.params.load_id, LOAD).then((e) => { return e })
  if (load[0] === undefined || load[0] === null) { return 404 }
  // Check for corrent owner
  if (load[0].owner != req.auth.sub){ return 401 }
  // Edit load
  if (req.body.volume != undefined) { load[0]["volume"] = req.body.volume };
  if (req.body.item != undefined) { load[0]["item"] = req.body.item };
  if (req.body.creationDate != undefined) { load[0]["creationDate"] = req.body.creationDate };
  let key = datastore.key([LOAD, parseInt(req.params.load_id, 10)]);
  delete load[0]["id"]
  await datastore.save({"key": key, "data": load[0]});
  load[0]["id"] = parseInt(req.params.load_id, 10)
  return load[0]
};

async function deleteBoat(boat_id) {
  let boat = await getEntity(boat_id, BOAT).then((e) => {return e})
  // Check if boat exist
  if (boat[0] === undefined || boat[0] === null ) {
    return 404
  } 
  // Remove boat from loads
  let allLoads = boat[0].loads
  for (const eachLoad of allLoads) {
    let load = await getEntity(eachLoad.id, LOAD).then((e) => {return e});
    load[0].carrier = null 
    let keyLoad = datastore.key([LOAD, parseInt(eachLoad.id, 10)]);
    delete load[0]["id"]
    await datastore.save({"key": keyLoad, "data": load[0]})
  }
  // Delete boat
  let keyBoat = datastore.key([BOAT, parseInt(boat_id, 10)]);
  await datastore.delete(keyBoat);
};

async function deleteLoad(load_id, req) {
  let load = await getEntity(load_id, LOAD).then((e) => {return e})
  // Check if load exist
  if (load[0] === undefined || load[0] === null ) { return 404 } 
  // Check for corrent owner
  if (load[0].owner != req.auth.sub){ return 401 }
  // Remove load from boat
  if (load[0]["carrier"] != null) {
    carrierID = load[0]["carrier"]["id"]
    let boat = await getEntity(carrierID, BOAT).then((e) => {return e})
    let removedLoad = boat[0]["loads"].filter(l => l.id != load_id)
    boat[0]["loads"] = removedLoad
    let keyBoat = datastore.key([BOAT, carrierID]);
    delete boat[0]["id"]
    await datastore.save({"key": keyBoat, "data": boat[0]})
  }
  // Delete load
  let keyLoad = datastore.key([LOAD, parseInt(load_id, 10)]);
  await datastore.delete(keyLoad);
};

/* ------------- MODEL FUNCTIONS (end) ------------- */

/* ------------- CONTROLLER FUNCTIONS NON-USER (start) ------------- */

// Not allowed - Status 405
app.put('/boats', (req, res) => {
  res.set('Accept', 'GET')
  res.status(405).json({"Error": "Not allowed"})
});
app.put('/loads', (req, res) => {
  res.set('Accept', 'GET')
  res.status(405).json({"Error": "Not allowed"})
});
app.patch('/boats', (req, res) => {
  res.set('Accept', 'GET')
  res.status(405).json({"Error": "Not allowed"})
});
app.patch('/loads', (req, res) => {
  res.set('Accept', 'GET')
  res.status(405).json({"Error": "Not allowed"})
});
app.delete('/boats', (req, res) => {
  res.set('Accept', 'GET')
  res.status(405).json({"Error": "Not allowed"})
});
app.delete('/loads', (req, res) => {
  res.set('Accept', 'GET')
  res.status(405).json({"Error": "Not allowed"})
});

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
app.post('/loads', checkJwt, (req, res) => {
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

// Gets boat
app.get('/boats/:boat_id', (req, res) => {  
  getBoat(req)
    .then(results => {
      if (typeof results == "number") {
        res.status(results).json(errorRes[results])
      } else {
        // Add self to all loads
        for (let i = 0; i < results[0]["loads"].length; i++) {
          let loadID = results[0]["loads"][i]["id"]
          let selfLoad = req.protocol + "://" + req.get("host") + req.baseUrl + "/loads/" + loadID
          results[0]["loads"][i]["self"] = selfLoad
        }
        // Add self
        let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + req.params.boat_id
        results[0]["self"] = self
        results[0]["id"] = parseInt(results[0]["id"])
        res.status(200).json(results[0]);
      }
    });
});

// Gets load
app.get('/loads/:load_id', checkJwt, (req, res) => {  
  getLoad(req)
    .then(results => {
      if (typeof results == "number") {
        res.status(results).json(errorRes[results])
      } else {
        // Add self to carrier 
        if (results["carrier"] != null) {
          let selfCarrier = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + results["carrier"]["id"]
          results["carrier"]["self"] = selfCarrier
        }
        // Add self
        let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/loads/" + req.params.load_id
        results["self"] = self
        results["id"] = parseInt(results["id"])
        res.status(200).json(results);
      }
    });
});

// Get all users
app.get('/users', (req, res) => {
  getAllUsers()
    .then((entities) => {
      for (let i = 0; i < entities.length; i++) {
        entities[i]["self"] = req.protocol + "://" + req.get("host") + req.baseUrl + "/users/" + entities[i]["id"]
      }
      res.status(200).json(entities)
    });
});

// Get all boats with pagination
app.get('/boats', (req, res) => {
  getAllBoats(req)
    .then((results) => {
      for (let i = 0; i < results["boats"].length; i++) {
        // Add self to all loads in the boat
        for (let j = 0; j < results["boats"][i]["loads"].length; j++) {
          results["boats"][i]["loads"][j]["self"] = req.protocol + "://" + req.get("host") + req.baseUrl + "/loads/" + results["boats"][i]["loads"][j]["id"]
        };
        // Add self to all boats
        results["boats"][i]["self"] = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + results["boats"][i]["id"]
      };
      res.status(200).json( results )
    });
});

// Get all loads with pagination
app.get('/loads', checkJwt, (req, res) => {
  getAllLoads(req)
    .then((results) => {
      for (let i = 0; i < results["loads"].length; i++) {
        // Add self to all carriers in the load
        if (results["loads"][i]["carrier"] != null) {
          results["loads"][i]["carrier"]["self"] = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + results["loads"][i]["carrier"]["id"]
        }
        // Add self to all loads
        results["loads"][i]["self"] = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + results["loads"][i]["id"]
      }
      res.status(200).json( results )
    });
});

// Assign load to boat
app.put('/boats/:boat_id/loads/:load_id', (req, res) => {
  loadBoat(req.params.boat_id, req.params.load_id)
    .then((key) => {
      if (key == 404) {
        res.status(404).send('{"Error": "The specified boat and/or load does not exist"}');
      } else if (key == 403) {
        res.status(403).send('{"Error": "The load is already loaded on another boat"}');
      } else {
        res.status(204).end()
      }  
    });
});

// Remove load from boat
app.delete('/boats/:boat_id/loads/:load_id', (req, res) => {
  removeLoadBoat(req.params.boat_id, req.params.load_id)
    .then((key) => {
      if (key == 404) {
        res.status(404).send('{"Error": "No boat with this boat_id is loaded with the load with this load_id"}');
      } else {
        res.status(204).end()
      }
    });
});

// Edit boat using PUT - all 3 attributes must be provided
app.put('/boats/:boat_id', (req, res) => {
  editBoatPUT(req)
    .then((results) => {
      if (typeof results == "number") {
        res.status(results).json(errorRes[results])
      } else {
        // Add self to all loads
        for (let i = 0; i < results["loads"].length; i++) {
          let loadID = results["loads"][i]["id"]
          let selfLoad = req.protocol + "://" + req.get("host") + req.baseUrl + "/loads/" + loadID
          results["loads"][i]["self"] = selfLoad
        }
        // Add self
        let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + results.id
        results["self"] = self
        res.status(201).json(results);
      }
    });
});

// Edit load using PUT - all 3 attributes must be provided
app.put('/loads/:load_id', checkJwt, (req, res) => {
  editLoadPUT(req)
    .then((results) => {
      if (typeof results == "number") {
        res.status(results).json(errorRes[results])
      } else {
        // Add self to carrier 
        if (results["carrier"] != null) {
          let selfCarrier = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + results["carrier"]["id"]
          results["carrier"]["self"] = selfCarrier
        }
        // Add self
        let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/loads/" + results.id
        results["self"] = self
        res.status(201).json(results);
      }
    });
});

// Edit boat using PATCH - at least 1 attribute must be provided
app.patch('/boats/:boat_id', (req, res) => {
  editBoatPATCH(req)
    .then((results) => {
      if (typeof results == "number") {
        res.status(results).json(errorRes[results])
      } else {
        // Add self to all loads
        for (let i = 0; i < results["loads"].length; i++) {
          let loadID = results["loads"][i]["id"]
          let selfLoad = req.protocol + "://" + req.get("host") + req.baseUrl + "/loads/" + loadID
          results["loads"][i]["self"] = selfLoad
        }
        // Add self
        let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + results.id
        results["self"] = self
        res.status(200).json(results);
      }
    })
});

// Edit load using PATCH - at least 1 attribute must be provided
app.patch('/loads/:load_id', checkJwt, (req, res) => {
  editLoadPATCH(req)
    .then((results) => {
      if (typeof results == "number") {
        res.status(results).json(errorRes[results])
      } else {
        // Add self to carrier 
        if (results["carrier"] != null) {
          let selfCarrier = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + results["carrier"]["id"]
          results["carrier"]["self"] = selfCarrier
        }
        // Add self
        let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/loads/" + results.id
        results["self"] = self
        res.status(200).json(results);
      }
    })
});

// Delete boat
app.delete('/boats/:boat_id', (req, res) => {
  deleteBoat(req.params.boat_id)
    .then((key) => {
      if (key == 404) {
        res.status(404).send('{"Error": "No boat with this boat_id exists"}');
      } else {
        res.status(204).end()
      }
    });
});

// Delete load
app.delete('/loads/:load_id', checkJwt, (req, res) => {
  deleteLoad(req.params.load_id, req)
    .then((key) => {
      if (key == 404) {
        res.status(404).json({"Error": "No load with this load_id exists"});
      } else if (key == 401){
        res.status(401).json(errorRes[key]);
      } else {
        res.status(204).end()
      }
    });
});

// Catch invalid JWT
app.use( (err, req, res, next) => {
  if (err.status == 401) {
    res.status(401).json(errorRes[err.status])
  }
});

/* ------------- CONTROLLER FUNCTIONS ENTITIES (end) ------------- */

/* ------------- OAUTH FUNCTIONS (start) ------------- */

app.set('view engine', 'hbs');

app.engine('hbs', handlebars.engine({
  defaultLayout: 'index',
  extname: 'hbs',
}));

app.get('/login', (req, res) => {
  // Render welcome page
  res.render('welcome', {
    layout: 'index', 
    link: `https://${DOMAIN}/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${SCOPE}&response_mode=query`});
});

app.get('/oauth', (req, res) => {
  var options = { method: 'POST',
    url: `https://${DOMAIN}/oauth/token`,
    headers: { 'content-type': 'application/json' },
    body:
    { grant_type: 'authorization_code',
      code: req.query.code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET },
    json: true };
  request(options, (error, response, body) => {
    if (error){
      res.status(500).send(error);
    } else {
      let parsed_jwt = parseJwt(body.id_token)
      addUser(parsed_jwt.sub)
      res.render('user-info', {
        layout: 'index', 
        jwt: body.id_token,
        sub: parsed_jwt.sub
      });
    }
  });
});

/* ------------- OAUTH FUNCTIONS (end) ------------- */

// Listen to the App 
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});
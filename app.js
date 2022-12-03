const express = require('express');
const app = express();

const { Datastore } = require('@google-cloud/datastore');
const datastore = new Datastore();
const { entity } = require('@google-cloud/datastore/build/src/entity');

const bodyParser = require('body-parser');
app.use(bodyParser.json());

const handlebars = require('express-handlebars');

app.enable('trust proxy');

const USER = 'User'; 
const BOAT = 'Boat';
const LOAD = 'Load'; 

const CLIENT_ID = '4aX5xB4pKX5grZ22br5Z0MQVqlCt9TvL';
const CLIENT_SECRET = 'IS_ZBh4vcCu45pz0wuLj38h9rEYmOOR2DL6gRBT-3MERqJi1nD2OfCZ4PkSarWhT';
const DOMAIN = 'boats-and-loads.us.auth0.com';

var errorRes = {
  400: {"Error": "At least one attribute is missing and/or invalid"}, 
  404: {"Error": "No entity with this id exists"},
  406: {"Error": "MIME type not acceptable, response must be JSON"},
  415: {"Error": "MIME type not acceptable, request must be JSON"}
};

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
    let newLoad = { "volume": req.body.volume, "item": req.body.item, "creationDate": req.body.creationDate, "carrier": null };
    let results = await datastore.save({ "key": key, "data": newLoad }).then(() => { return key });
    newLoad["id"] = parseInt(results.id)
    return newLoad
  }
};

async function getBoat(req) {
  const accepts = req.accepts(['application/json'])
  if (!accepts) {                                       
    // Status 406 MIME type response not acceptable
    return 406
  } 
  let boat = await getEntity(req.params.boat_id, BOAT)
  if (boat[0] === undefined || boat[0] === null) {
    // Status 404 No boat with given id found 
    return 404
  }
  return boat
};

async function getLoad(req) {
  const accepts = req.accepts(['application/json'])
  if (!accepts) {                                       
    // Status 406 MIME type response not acceptable
    return 406
  } 
  let load = await getEntity(req.params.load_id, LOAD)
  if (load[0] === undefined || load[0] === null) {
    // Status 404 No load with given id found 
    return 404
  }
  return load
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
          results.totalBoats = boatsTotal;
    return results;
  });
}

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
  if (load[0] === undefined || load[0] === null) {
    return 404
  }
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
  if (load[0] === undefined || load[0] === null) {return 404}
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

async function deleteLoad(load_id) {
  let load = await getEntity(load_id, LOAD).then((e) => {return e})
  // Check if load exist
  if (load[0] === undefined || load[0] === null ) {
    return 404
  } 
  // Remove load from boat
  carrierID = load[0]["carrier"]["id"]
  let boat = await getEntity(carrierID, BOAT).then((e) => {return e})
  let removedLoad = boat[0]["loads"].filter(l => l.id != load_id)
  boat[0]["loads"] = removedLoad
  delete boat[0]["id"]
  let keyBoat = datastore.key([BOAT, carrierID]);
  delete boat[0]["id"]
  await datastore.save({"key": keyBoat, "data": boat[0]})
  // Delete load
  let keyLoad = datastore.key([LOAD, parseInt(load_id, 10)]);
  await datastore.delete(keyLoad);
};

/* ------------- MODEL FUNCTIONS (end) ------------- */

/* ------------- CONTROLLER FUNCTIONS NON-USER ENTITIES (start) ------------- */
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
app.get('/loads/:load_id', (req, res) => {  
  getLoad(req)
    .then(results => {
      if (typeof results == "number") {
        res.status(results).json(errorRes[results])
      } else {
        // Add self to carrier 
        if (results[0]["carrier"] != null) {
          let selfCarrier = req.protocol + "://" + req.get("host") + req.baseUrl + "/boats/" + results[0]["carrier"]["id"]
          results[0]["carrier"]["self"] = selfCarrier
        }
        // Add self
        let self = req.protocol + "://" + req.get("host") + req.baseUrl + "/loads/" + req.params.load_id
        results[0]["self"] = self
        results[0]["id"] = parseInt(results[0]["id"])
        res.status(200).json(results[0]);
      }
    });
});

// Get all boats with pagination
app.get('/boats', (req, res) => {
  getAllBoats(req).then((results) => {res.status(200).json( results )});
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
app.put('/loads/:load_id', (req, res) => {
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
app.patch('/loads/:load_id', (req, res) => {
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
app.delete('/loads/:load_id', (req, res) => {
  deleteLoad(req.params.load_id)
    .then((key) => {
      if (key == 404) {
        res.status(404).send('{"Error": "No load with this load_id exists"}');
      } else {
        res.status(204).end()
      }
    });
});

/* ------------- CONTROLLER FUNCTIONS NON-USER ENTITIES (end) ------------- */

/* ------------- CONTROLLER FUNCTIONS USER (start) ------------- */

app.set('view engine', 'hbs');

app.engine('hbs', handlebars.engine({
  defaultLayout: 'index',
  extname: 'hbs',
}));

app.get('/', (req, res) => {
  // Render welcome page, and include state in OAuth link
  res.render('welcome', {layout: 'index'});
});

/* ------------- CONTROLLER FUNCTIONS USER (end) ------------- */


// Listen to the App 
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});
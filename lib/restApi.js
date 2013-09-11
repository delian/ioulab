/**
 * This is my REST API in relation to the lab Management
 */

// Define the functions
var config = require('../config.json');
var db;
var e;
var colLabs;
var colIous;
var colLabDevices;
var colDevices;
var colLinks;
var colAllocate;

// Connect to the MongoDB
function setCollections() {
	colLabs = db.collection('labs');
	colIous = db.collection('ious');
	colLabDevices = db.collection('labDevices');
	colDevices = db.collection('devices');
	colLinks = db.collection('links');
	colAllocate = db.collection('allocate');
}

// LABS functions
function restGetLabs(req, res) { // List Labs
	console.log(arguments.callee);
	colLabs.find().toArray(function(err, q) {
		return res.send(200, q);
	});
}

function restGetLabsById(req, res) { // List Labs
	console.log(arguments.callee);
	colLabs.findOne({
		id : parseInt(req.params.id)
	}, function(err, q) {
		return res.send(200, q);
	});
}

function restPutLabs(req, res) { // Update Lab
	console.log(arguments.callee);
	colLabs.update({
		id : parseInt(req.body.id)
	}, req.body, {
		multi : true,
		save : true
	}, function(err, q) {
		return res.send(200, req.body);
	});
}

function restPostLabs(req, res) { // Create Lab
	console.log(arguments.callee);
	allocateCounter('labId', 30000, 40000, function(err, id) {
		req.body.id = id;
		colLabs.insert(req.body, function(err, q) {
			return res.send(200, q);
		});
	});
}

function restDelLabs(req, res) { // Remove Lab
	console.log(arguments.callee);
	colLabs.remove({
		id : parseInt(req.body.id)
	}, function(err, q) {
		colDevices.remove({
			lab : parseInt(req.body.id)
		}, function(err, q) {
			colLinks.remove({
				lab : parseInt(req.body.id)
			}, function(err, q) {
				return res.send(200, req.body);
			});
		});
	});
}

// IOUS functions
function restGetIouBase(req, res) { // This should be sourced from the configuration file
	console.log(arguments.callee);
	return res.send(200, config.iouBase);
}

function restGetIous(req, res) {
	console.log(arguments.callee);
	colIous.find().toArray(function(err, q) {
		return res.send(200, q);
	});
}

function restPutIous(req, res) {
	console.log(arguments.callee);
	colIous.update({
		id : parseInt(req.body.id)
	}, req.body, {
		save : true
	}, function(err, q) {
		colDevices.update({
			type : parseInt(req.body.id)
		}, {
			$set : {
				icon : req.body.icon
			}
		}, {
			multi : true,
			save : true
		}, function(err, q) { // Fix the icon
			console.log('Fix Icon for objects', q);
			if (q) {
				colDevices.find({
					type : parseInt(req.body.id)
				}).toArray(function(err, q) {
					if (q)
						q.forEach(function(n) {
							console.log('notify for update device', n.id);
							e.emit('updateDevice', n.id);
						});
				});
			}
		});
		return res.send(200, req.body);
	});
}

function restPostIous(req, res) {
	console.log(arguments.callee);
	allocateCounter('iouId', 40000, 50000, function(err, id) {
		req.body.id = id;
		colIous.insert(req.body, function(err, q) {
			return res.send(200, q);
		});
	});
}

function restDelIous(req, res) {
	console.log(arguments.callee);
	colIous.remove({
		id : parseInt(req.body.id)
	}, function(err, q) {
		// colDevices.update({ type:parseInt(req.body.id) }, { $set: { type:0 } }, { safe: true, multi: true}, function(err) {
		colDevices.remove({
			type : parseInt(req.body.id)
		}, function(err) { // Remove the associated devices
			return res.send(200, req.body);
		});
	});
}

// LAB Devices
function restLabDevices(req, res) {
	console.log(arguments.callee);

	colDevices.find({
		lab : parseInt(req.params.id)
	}).toArray(function(err, q) {
		return res.send(200, q);
	});
}

// Device Links
function restDeviceLinks(req,res) {
	console.log(arguments.callee);
	
	colLinks.find({ $or: [ { "source.id": parseInt(req.params.id) }, { "target.id": parseInt(req.params.id) } ] }).toArray(function(err,q){
		return res.send(200,q);
	});
}

// Router Icons
function restIcons(req, res) {
	console.log(arguments.callee);
	return res.send(200, config.deviceIcons);
}

function restLinkIcons(req, res) {
	console.log(arguments.callee);
	return res.send(200, config.linkIcons);

}

// Allocate API

function allocateCounter(type, min, max, cb) {
	console.log(arguments.callee);

	colAllocate.findOne({
		'allocate' : type
	}, function(err, q) {
		var id = min;
		if (q) {
			id = q.value;
			colAllocate.update({
				'allocate' : type
			}, {
				'allocate' : type,
				value : id + 1
			}, function(err) {
				cb(err, id);
			});
		} else {
			id = min;
			colAllocate.insert({
				'allocate' : type,
				value : id + 1
			}, function(err) {
				cb(err, id);
			});
		}
	});
}

function allocateCounterCbk(req, res, type, min, max) {
	console.log(arguments.callee);

	allocateCounter(type, min, max, function(err, id) {
		res.send(200, {
			id : id
		});
	});
}

function restAllocateLabId(req, res) {
	console.log(arguments.callee);
	allocateCounterCbk(req, res, 'labId', 30000, 40000);
}

function restAllocateDeviceId(req, res) {
	console.log(arguments.callee);
	allocateCounterCbk(req, res, 'deviceId', 1, 1000);
}

function restAllocateLinkId(req, res) {
	console.log(arguments.callee);
	allocateCounterCbk(req, res, 'linkId', 10000, 20000);
}

function restAllocateObjectId(req, res) {
	console.log(arguments.callee);
	allocateCounterCbk(req, res, 'objectId', 20000, 30000);
}

// Set Routes
function restSetRoutes(app, mongoDb, emit) {
	// Define the routes

	db = mongoDb; // Reuse the global mongoDb handler
	e = emit;
	setCollections();

	// LABS routes
	app.get('/rest/labs', restGetLabs);
	app.get('/rest/labs/:id', restGetLabsById);
	app.put('/rest/labs/:id', restPutLabs);
	app.post('/rest/labs', restPostLabs);
	app.del('/rest/labs/:id', restDelLabs);

	// IOUS routes
	app.get('/rest/iouBase', restGetIouBase);
	app.get('/rest/ious', restGetIous);
	app.put('/rest/ious/:id', restPutIous);
	app.post('/rest/ious', restPostIous);
	app.del('/rest/ious/:id', restDelIous);

	// LAB Devices
	app.get('/rest/lab/:id/devices', restLabDevices);
	
	// Device Links
	app.get('/rest/device/:id/links', restDeviceLinks);

	// Router Icons
	app.get('/rest/icons', restIcons);
	app.get('/rest/linkIcons', restLinkIcons);

	// Allocate Api
	app.get('/rest/allocate/labId', restAllocateLabId);
	app.get('/rest/allocate/deviceId', restAllocateDeviceId);
	app.get('/rest/allocate/linkId', restAllocateLinkId);
	app.get('/rest/allocate/objectId', restAllocateObjectId);
}

// Exports
exports = restSetRoutes;
module.exports = exports;

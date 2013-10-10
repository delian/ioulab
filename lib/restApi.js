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
var intApi;

// Connect to the MongoDB
function setCollections() {
	colLabs = db.collection('labs');
	colIous = db.collection('ious');
	colLabDevices = db.collection('labDevices');
	colDevices = db.collection('devices');
	colLinks = db.collection('links');
	colAllocate = db.collection('allocate');
	intApi = require('./freeIntApi.js')(db);
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
		id : parseInt(req.params.id)
	}, req.body, {
		safe : true
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

function restDelLabs(req, res) { // Remove Lab, and Update diagrams
	console.log(arguments.callee);
	colLabs.remove({
		id : parseInt(req.body.id)
	}, function(err, q) {
		colDevices.find({ lab : parseInt(req.body.id) }).toArray(function(err,a){
			a.forEach(function(n) { e.emit('removeDevice',n); });
			colLinks.find({ lab: parseInt(req.body.id )}).toArray(function(err,a) {
				a.forEach(function(n) { e.emit('removeLink',n); });
				colObjects.find({ lab:parseInt(req.body.id)}).toArray(function(err,a){
					a.forEach(function(n) { e.emit('removeObject',n); });
					colDevices.remove({
						lab : parseInt(req.body.id)
					}, function(err, q) {
						colLinks.remove({
							lab : parseInt(req.body.id)
						}, function(err, q) {
							colObjects.remove({ lab:parseInt(req.body.id)},function(err,a){
								return res.send(200, req.body);								
							});
						});
					});
				});
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
		safe : true
	}, function(err, q) {
		colDevices.update({
			type : parseInt(req.body.id)
		}, {
			$set : {
				icon : req.body.icon
			}
		}, {
			multi : true,
			safe : true
		}, function(err, q) { // Fix the icon
			//console.log('Fix Icon for objects', q);
			if (q) {
				colDevices.find({
					type : parseInt(req.body.id)
				}).toArray(function(err, q) {
					if (q)
						q.forEach(function(n) {
							//console.log('notify for update device', n.id);
							e.emit('updateDevice', n);
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
		colDevices.find({
			type : parseInt(req.body.id)
		}).toArray(function(err, q) {
			q.forEach(function(n) {
				e.emit('removeDevice', n);
			});
			colDevices.remove({
				type : parseInt(req.body.id)
			}, function(err) { // Remove the associated devices
				return res.send(200, req.body);
			});
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

function restPutLabDevices(req, res) {
	console.log(arguments.callee);
	
	colDevices.findAndModify({ id: parseInt(req.params.id) }, [], { $set: { name: req.body.name } }, { 'new': true, safe: true }, function(err,q) {
		e.emit('updateDevice',q);
		return res.send(200, q);
	});
}

// Device Links
function restDeviceLinks(req, res) {
	console.log(arguments.callee);

	colLinks.find({
		$or : [ {
			"source.id" : parseInt(req.params.id)
		}, {
			"target.id" : parseInt(req.params.id)
		} ]
	}).toArray(function(err, q) {
		return res.send(200, q);
	});
}

function restPutDeviceLinks(req, res) {
	console.log(arguments.callee);

	colLinks.findAndModify({ id: parseInt(req.params.id) },[],{ $set: {'name': req.body.name } }, { 'new': true, safe: true }, function(err,q) {
		e.emit('updateLink',q);
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

// Device API

function restGetDeviceIntf(req,res) {
	console.log(arguments.callee);
	intApi.iouInterfaces(req.params.id,function(int) {
		var out = [];
		try {
			out=out.concat(Object.keys(int.ethernet).map(function(n) { return { name:n } }));
		} catch(e) {};
		try {
			out=out.concat(Object.keys(int.serial).map(function(n) { return { name:n } }));
		} catch(e) {};
		return res.send(200,out);
	});
}

function restGetDeviceIntfFree(req,res) {
	console.log(arguments.callee);
	intApi.iouFreeInterfaces(req.params.id,function(int) {
		var out = [];
		try {
			out=out.concat(Object.keys(int.ethernet).map(function(n) { return { name:n } }));
		} catch(e) {};
		try {
			out=out.concat(Object.keys(int.serial).map(function(n) { return { name:n } }));
		} catch(e) {};
		return res.send(200,out);
	});
}

function restGetDeviceIntfFreeEth(req,res) {
	console.log(arguments.callee);
	intApi.iouFreeEthInts(req.params.id,function(int) {
		var out = [];
		try {
			out=out.concat(Object.keys(int.ethernet).map(function(n) { return { name:n } }));
		} catch(e) {};
		return res.send(200,out);
	});
}

function restGetDeviceIntfFreeSer(req,res) {
	console.log(arguments.callee);
	intApi.iouFreeSerInts(req.params.id,function(int) {
		var out = [];
		try {
			out=out.concat(Object.keys(int.serial).map(function(n) { return { name:n } }));
		} catch(e) {};
		return res.send(200,out);
	});
}

function restGetDevice(req,res) {
	console.log(arguments.callee);
	colDevices.findOne({ id: parseInt(req.params.id) },function(err,q){
		return res.send(200,q);
	});
}

function restPutDevice(req,res) {
	console.log(arguments.callee);
	colDevices.findOne({ id: parseInt(req.params.id) },function(err,q){
		for (var p in req.body) q[p]=req.body[p];
		colDevices.update({ id: parseInt(req.params.id) },q,{ safe: true },function(err,q1) {
			e.emit('updateDevice',q);
			return res.send(200,q);
		});
	});	
}

function restDeviceStatus(req,res) {
	console.log(arguments.callee);
	colDevices.findOne({ id: parseInt(req.params.id) },function(err,q){
		return res.send(200,q);
	});
}

function restDeviceStart(req,res) {
	console.log(arguments.callee);
	console.log('Emitted startDevice');
	e.emit('startDevice',{ id: parseInt(req.params.id) });
	return res.send(200,{ 'success': true});
}

function restDeviceStop(req,res) {
	console.log(arguments.callee);
	e.emit('stopDevice',{ id: parseInt(req.params.id) });
	return res.send(200,{ 'success': true});
}

function restDeviceRestart(req,res) {
	console.log(arguments.callee);
	e.emit('restartDevice',{ id: parseInt(req.params.id) });
	return res.send(200,{ 'success': true});
}

function restDeviceReset(req,res) {
	console.log(arguments.callee);
	e.emit('resetDevice',{ id: parseInt(req.params.id) });
	return res.send(200,{ 'success': true});
}

function restDeviceSave(req,res) {
	console.log(arguments.callee);
	e.emit('saveDevice',{ id: parseInt(req.params.id) });
	return res.send(200,{ 'success': true});
}

// Rest Labs stop/start/save

function restLabsStop(req,res) {
	console.log(arguments.callee);
	colDevices.find({ lab: parseInt(req.params.id) }).toArray(function(err,q){
		q.forEach(function(n){
			e.emit('stopDevice',n);
		});
		return res.send(200,{ 'success': true});
	});
}

function restLabsStart(req,res) {
	console.log(arguments.callee);
	colDevices.find({ lab: parseInt(req.params.id) }).toArray(function(err,q){
		q.forEach(function(n){
			e.emit('startDevice',n);
		});
		return res.send(200,{ 'success': true});
	});
}

function restLabsReset(req,res) {
	console.log(arguments.callee);
	colDevices.find({ lab: parseInt(req.params.id) }).toArray(function(err,q){
		q.forEach(function(n){
			e.emit('resetDevice',n);
		});
		return res.send(200,{ 'success': true});
	});
}

function restLabsSave(req,res) {
	console.log(arguments.callee);
	colDevices.find({ lab: parseInt(req.params.id) }).toArray(function(err,q){
		q.forEach(function(n){
			e.emit('saveDevice',n);
		});
		return res.send(200,{ 'success': true});
	});
}

// Link API

function restGetLink(req,res) {
	console.log(arguments.callee);
	colLinks.findOne({ id: parseInt(req.params.id) },function(err,q){
		return res.send(200,q);
	});
}

function restPutLink(req,res) { // This needs to be verified
	console.log(arguments.callee);
	colLinks.findOne({ id: parseInt(req.params.id) },function(err,q){
		for (var p in req.body) q[p]=req.body[p];
		colLinks.update({ id: parseInt(req.params.id) },q,{ safe: true },function(err,q1) {
			e.emit('updateLink',q);
			return res.send(200,q);
		});
	});	
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
	
	app.get('/rest/labs/:id/stop',restLabsStop);
	app.get('/rest/labs/:id/start',restLabsStart);
	app.get('/rest/labs/:id/reset',restLabsReset);
	app.get('/rest/labs/:id/save',restLabsSave);

	// IOUS routes
	app.get('/rest/iouBase', restGetIouBase);
	app.get('/rest/ious', restGetIous);
	app.put('/rest/ious/:id', restPutIous);
	app.post('/rest/ious', restPostIous);
	app.del('/rest/ious/:id', restDelIous);

	// LAB Devices
	app.get('/rest/lab/:id/devices', restLabDevices);
	app.put('/rest/lab/:lab/devices/:id', restPutLabDevices)

	// Device API
	app.get('/rest/device/:id/links', restDeviceLinks);
	app.get('/rest/device/:id/status', restDeviceStatus);
	app.get('/rest/device/:id/start', restDeviceStart);
	app.get('/rest/device/:id/stop', restDeviceStop);
	app.get('/rest/device/:id/restart', restDeviceRestart);
	app.get('/rest/device/:id/reset', restDeviceReset);
	app.get('/rest/device/:id/save', restDeviceSave);
	
	app.get('/rest/device/:id', restGetDevice);
	app.put('/rest/device/:id', restPutDevice);

	app.get('/rest/device/:id/interfaces', restGetDeviceIntf);
	app.get('/rest/device/:id/interfaces/free', restGetDeviceIntfFree);
	app.get('/rest/device/:id/interfaces/free/ethernet', restGetDeviceIntfFreeEth);
	app.get('/rest/device/:id/interfaces/free/serial', restGetDeviceIntfFreeSer);

	// Link API
	app.get('/rest/link/:id', restGetLink);
	app.put('/rest/link/:id', restPutLink);
	
	// Device Links API
	app.put('/rest/device/:device/links/:id', restPutDeviceLinks);

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

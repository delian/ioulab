/**
 * This is the code, that implements the messaging bus between the Labs and the auto update of the devices and links in the system
 */

var db;
var e;
var colLabDevices;
var colLinks;
var colDevices;
var colObjects;
var colLabs;

function setCollections() {
	colLabs = db.collection('labs');
	colLabDevices = db.collection('labDevices');
	colDevices = db.collection('devices');
	colLinks = db.collection('links');
	colObjects = db.collection('objects');
}

function labSocketBus(sIo,mongoDb,emit) {
	db=mongoDb;
	e=emit;
	
	setCollections();
	
	var sLabs = sIo.of('/labs');
	
	// Set the event handling
	e.on('addDevice',function(deviceId) {
		colDevices.findOne({id:parseInt(deviceId)},function(err,q){
			sLabs.in(q.lab).emit('addDevice',q); // Broadcast the updateDevice to everyone
		});
	})

	e.on('updateDevice',function(deviceId) {
		colDevices.findOne({id:parseInt(deviceId)},function(err,q){
			sLabs.in(q.lab).emit('updateDevice',q); // Broadcast the updateDevice to everyone
		});
	})

	e.on('removeDevice',function(deviceId, labId) {
		sLabs.in(q.lab).emit('removeDevice',{ id: deviceId, lab: labId }); // Broadcast the updateDevice to everyone
	})
	
	e.on('addLink',function(linkId) {
		colLinks.findOne({id:parseInt(linkId)},function(err,q){
			sLabs.in(q.lab).emit('addLink',q); // Broadcast the updateDevice to everyone
		});
	})

	e.on('updateLink',function(linkId) {
		colLinks.findOne({id:parseInt(linkId)},function(err,q){
			sLabs.in(q.lab).emit('updateLink',q); // Broadcast the updateDevice to everyone
		});
	})

	e.on('removeLink',function(linkId,labId) {
		sLabs.in(q.lab).emit('removeLink',{ id: linkId, lab: labId }); // Broadcast the updateDevice to everyone
	})

	sLabs.on("connection",function(socket){
		console.log('New socket connection');
		
		// Set the messaging
		socket.on('disconnect',function() {
			socket.get('currentLab',function(err,lab){
				console.log('disconnect');
				socket.leave(lab); // Force Lab Leaving
//				socket = null;
			});
//			socket=null;
		});
		
		socket.on('quit',function() {
			console.log('Received QUIT message...');
			socket.get('currentLab',function(err,lab){
				console.log('quitting...');
				socket.leave(lab);
				socket.disconnect(); // Force disconnect
			});	
		})

		socket.on('joinLab',function(r){
			console.log('joinLab',r);
			socket.set('currentLab',r,function(){ socket.join(r); });
		});

		socket.on('addDevice',function(msg){
			console.log('addDevice',msg);
			socket.get('currentLab',function(err,lab){
				colDevices.insert(msg,function(err,q) {
					socket.in(lab).broadcast.emit('addDevice',msg);				
				});
			});
		});

		socket.on('addLink',function(msg){
			console.log('addLink',msg);
			socket.get('currentLab',function(err,lab){
				colLinks.insert(msg,function(err,q){
					socket.in(lab).broadcast.emit('addLink',msg);
				});
			});
		});

		socket.on('updateDevice',function(msg){
			console.log('updateDevice',msg);
			socket.get('currentLab',function(err,lab){
				delete (msg._id);
				colDevices.update({ id:parseInt(msg.id) }, msg, { safe:true }, function (err,q) {
					socket.in(lab).broadcast.emit('updateDevice',msg);
				});
			});
		});

		socket.on('updateLink',function(msg){
			console.log('updateLink',msg);
			socket.get('currentLab',function(err,lab){
				delete (msg._id);
				colLinks.update({ id:parseInt(msg.id) }, msg, {  safe: true }, function (err,q) {
					socket.in(lab).broadcast.emit('updateLink',msg);				
				});
			});
		});

		socket.on('removeDevice',function(msg){
			console.log('removeDevice',msg);
			socket.get('currentLab',function(err,lab){
				colDevices.remove({ id:msg.id }, function(err,q){
					socket.in(lab).broadcast.emit('removeDevice',msg);
				});
			});
		});

		socket.on('removeLink',function(msg){
			console.log('removeLink',msg);
			socket.get('currentLab',function(err,lab){
				colLinks.remove({ id:msg.id }, function(err,q){
					socket.in(lab).broadcast.emit('removeLink',msg);
				});
			});
		});

		socket.on('setScale',function(msg){
			console.log('setScale',msg);
			socket.get('currentLab',function(err,lab){
				colLabs.findOne({ id:parseInt(lab) }, function(err,q) {
					if (q) {
						q.scale=msg;
						colLabs.update({ id:parseInt(lab) }, q, { safe: true }, function (err) { // Update the scale
							socket.in(lab).broadcast.emit('setScale',msg);
						});
					} else socket.in(lab).broadcast.emit('setScale',msg);
				});
			});
		});

		socket.on('getAll',function(msg){
			console.log('getAll',msg);
			socket.get('currentLab',function(err,lab){
				colLabs.findOne({ id:parseInt(lab) }, function(err,labObj) {
					if (err) return; // Ignore
					colDevices.find({ lab:parseInt(lab) }).toArray(function(err,devicesObj) {
						colLinks.find({ lab:parseInt(lab) }).toArray(function(err,linksObj) {
							socket.emit('getAll',{
								lab: lab,
								scale: labObj?labObj.scale:{ x:1, y:1 }, // The default scale
								devices: devicesObj,
								links: linksObj
							});
						});
					});
				});
			});
		});
	});	
}

exports = labSocketBus;
module.exports = exports;

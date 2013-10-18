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
var colNvFiles;

function setCollections() {
	colLabs = db.collection('labs');
	colLabDevices = db.collection('labDevices');
	colDevices = db.collection('devices');
	colLinks = db.collection('links');
	colObjects = db.collection('objects');
	colNvFiles = db.collection('nvfiles');
}

function labSocketBus(sIo,mongoDb,emit) {
	db=mongoDb;
	e=emit;

	setCollections();

	var sLabs = sIo.of('/labs');

	// Set the event handling
	e.on('addDevice',function(msg) {
		sLabs['in'](msg.lab).emit('addDevice',msg); // Broadcast to everyone
	});

	e.on('updateDevice',function(msg) {
		sLabs['in'](msg.lab).emit('updateDevice',msg); // Broadcast to everyone
	});

	e.on('removeDevice',function(msg) {
		sLabs['in'](msg.lab).emit('removeDevice',msg); // Broadcast to everyone
	});

	e.on('addLink',function(msg) {
		sLabs['in'](msg.lab).emit('addLink',msg); // Broadcast to everyone
	});

	e.on('updateLink',function(msg) {
		sLabs['in'](msg.lab).emit('updateLink',msg); // Broadcast to everyone
	});

	e.on('removeLink',function(msg) {
		sLabs['in'](msg.lab).emit('removeLink',msg); // Broadcast the to everyone
	});

	e.on('addObject',function(msg) {
		sLabs['in'](msg.lab).emit('addObject',msg); // Broadcast to everyone
	});

	e.on('updateObject',function(msg) {
		sLabs['in'](msg.lab).emit('updateObject',msg); // Broadcast to everyone
	});

	e.on('removeObject',function(msg) {
		sLabs['in'](msg.lab).emit('removeObject',msg); // Broadcast to everyone
	});

	sLabs.on("connection",function(socket){
		console.log('New socket connection');

//		// Set the messaging
//		socket.on('disconnect',function() {
//			socket.get('currentLab',function(err,lab){
//				console.log('disconnect');
//				socket.leave(lab); // Force Lab Leaving
////				socket = null;
//			});
////			socket=null;
//		});

		socket.on('quit',function() {
			console.log('Received QUIT message...');
			socket.get('currentLab',function(err,lab){
				console.log('quitting...');
//				socket.leave(lab);
//				socket.disconnect(); // Force disconnect
			});
		});

		socket.on('joinLab',function(r){
			console.log('joinLab',r);
			socket.set('currentLab',r,function(){ socket.join(r); });
		});

		socket.on('addDevice',function(msg){
			console.log('addDevice',msg);
			socket.get('currentLab',function(err,lab){
				colDevices.insert(msg,function(err,q) {
					e.emit('resetDeviceFile',msg);
					socket['in'](lab).broadcast.emit('addDevice',msg);
				});
			});
		});

		socket.on('addLink',function(msg){
			console.log('addLink',msg);
			socket.get('currentLab',function(err,lab){
				colLinks.insert(msg,function(err,q){
					socket['in'](lab).broadcast.emit('addLink',msg);
					e.emit('uiAddLink',msg);
				});
			});
		});


		socket.on('addObject',function(msg){
			console.log('addObject',msg);
			socket.get('currentLab',function(err,lab){
				colObjects.insert(msg,function(err,q){
					socket['in'](lab).broadcast.emit('addObject',msg);
				});
			});
		});


		socket.on('updateDevice',function(msg){
			console.log('updateDevice',msg);
			socket.get('currentLab',function(err,lab){
				delete (msg._id);
				colDevices.update({ id:parseInt(msg.id) }, msg, { safe:true }, function (err,q) {
					socket['in'](lab).broadcast.emit('updateDevice',msg);
				});
			});
		});

		socket.on('updateLink',function(msg){
			console.log('updateLink',msg);
			socket.get('currentLab',function(err,lab){
				delete (msg._id);
				colLinks.update({ id:parseInt(msg.id) }, msg, {  safe: true }, function (err,q) {
					socket['in'](lab).broadcast.emit('updateLink',msg);
					e.emit('uiUpdateLink',msg);
				});
			});
		});

		socket.on('updateObject',function(msg){
			console.log('updateObject',msg);
			socket.get('currentLab',function(err,lab){
				delete (msg._id);
				colObjects.update({ id:parseInt(msg.id) }, msg, {  safe: true }, function (err,q) {
					socket['in'](lab).broadcast.emit('updateObject',msg);
				});
			});
		});

		socket.on('removeDevice',function(msg){
			console.log('removeDevice',msg);
			socket.get('currentLab',function(err,lab){
				colDevices.remove({ id:parseInt(msg.id) }, function(err,q){
					e.emit('removeDeviceFile',msg);
					socket['in'](lab).broadcast.emit('removeDevice',msg);
					colNvFiles.remove({ id:parseInt(msg.id) },function(err,q){});
					setTimeout(function(){
						colLinks.find({
							$or: [
							      { "source.id": parseInt(msg.id) },
							      { "source.id": msg.id.toString() },
							      { "target.id": parseInt(msg.id) },
							      { "target.id": msg.id.toString() }
							]
						}).toArray(function(err,q) {
							q.forEach(function(n) {
								if (n.source.id == msg.id) {
									delete n.source.id;
								}
								if (n.target.id == msg.id) {
									delete n.target.id;
								}
								e.emit('updateLink',n); // Send back the updated link, with the removed peer
							});
						});

					},150); // In a moment we try to update the links. So we can give a change to the browser to delete them before that
				});
			});
		});

		socket.on('removeLink',function(msg){
			console.log('removeLink',msg);
			socket.get('currentLab',function(err,lab){
				colLinks.remove({ id:parseInt(msg.id) }, function(err,q){
					socket['in'](lab).broadcast.emit('removeLink',msg);
				});
			});
		});

		socket.on('removeObject',function(msg){
			console.log('removeObject',msg);
			socket.get('currentLab',function(err,lab){
				colObjects.remove({ id:parseInt(msg.id) }, function(err,q){
					socket['in'](lab).broadcast.emit('removeObject',msg);
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
							socket['in'](lab).broadcast.emit('setScale',msg);
						});
					} else socket['in'](lab).broadcast.emit('setScale',msg);
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
							colObjects.find({ lab:parseInt(lab) }).toArray(function(err,objObj){
								socket.emit('getAll',{
									lab: lab,
									scale: labObj?labObj.scale:{ x:1, y:1 }, // The default scale
									devices: devicesObj,
									links: linksObj,
									objects: objObj
								});
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

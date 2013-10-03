/**
 * This file implements IOU
 */

/*
 * TODO: A simple spawn (with pty) of an IOU image defined by a binary path, id, memory, nvram, ethernet and serial interfaces TODO: Create a shared bus for the IOU output to be collected into a queue
 * of pointers (objects) for each subscriber to receive TODO: Create a subscriber management with Socket.io relation TODO: Find how if we change the NETMAP config file to force the IOU to reread it
 */

var config = require('../config.json');
var fs = require('fs');
var pty = require('pty.js');

var colDevices;
var colLinks;
var colIous;

var evt;

function appSpawn(app, dir) {
	console.log(arguments.callee);

	var args = [ app ];

	if (app instanceof Object)
		args = app;

	console.log('PTY SPAWN in dir "',dir||process.env.HOME,'"',args);
	
	var term = pty.spawn(args[0], args.slice(1), {
		name : 'xterm-color',
		cols : 80,
		rows : 24,
		cwd : dir || process.env.HOME,
		env : process.env
	});
	return term;
}

function iouCmdBuild(bin, id, mem, nvram, conf, ethernet, serial) {
	console.log(arguments.callee,arguments);
	mem = mem ? mem : 256;
	nvram = nvram ? nvram : 64;
	ethernet = ethernet ? ethernet : 4;
	serial = serial ? serial : 4;
	conf = conf ? conf : ("IOU" + id);
//	return [ bin, '-q', '-U', '-c', conf, '-m', mem, '-n', nvram, '-e', ethernet, '-s', serial, id ];
	return [ 'bash', '-c', bin+' -q -U -c '+conf+' -m '+mem+' -n '+nvram+' -e '+ethernet+' -s '+serial+' '+id ];
	// return bin+" -q -U -c "+conf+" -m "+mem+" -n "+nvram+" -e "+ethernet+" -s "+serial+" "+id;
}

function openIOU(cnf) {
	console.log(arguments.callee,arguments);
	cnf = cnf || {};
	var term;
	var iouObj;
	var maxBuffChars=1000;
	var iouPath = iouCmdBuild(cnf.iouBin, cnf.deviceId, cnf.memory, cnf.nvram, cnf.confName, cnf.ethernet, cnf.serial);

	console.log(iouPath);
	function iouOpen() {
		console.log(arguments.callee);
		var term = appSpawn(cnf.iou || iouPath || 'bash', cnf.dir);
		term.on('data', function(msg) {
			console.log('>>>', arguments[0]);
			iouObj.buff=(iouObj.buff.toString() + msg).toString().substr(-maxBuffChars,maxBuffChars); // Keep a buffer, for initial connection
			if (cnf.data) cnf.data(msg);  // Call back the data
		});
//		term.on('error', iouRespawn);
//		term.on('close', iouRespawn);
		return term;
	}
	
	term = iouOpen();

	function iouRespawn() {
		console.log(arguments.callee);
		if (cnf.stopped)
			return;
		var term = iouObj.term;
		if (term)
			term.destroy();
		iouObj.term = iouOpen();
	}
	
	function isStarted() {
		console.log(arguments.callee);
		return true;
	}
	
	function start() {
		console.log(arguments.callee,arguments);
		if (!isStarted()) {
			term=iouOpen();
			iouObj.term=term;
		}

		// Change status to online
		colDevices.update({ id: parseInt(cnf.deviceId) },{ $set: { status: 'online' } },function(err,q){
			if (!err) evt.emit('updateDevice',q);			
		});
	}
	
	function stop() {
		console.log(arguments.callee);
		if (isStarted()) {
			// We need to stop the IOU
		}
		// Change status to offline
		colDevices.update({ id: parseInt(cnf.deviceId) },{ $set: { status: 'offline' } },function(err,q){
			if (!err) evt.emit('updateDevice',q);			
		});
	}

	iouObj = {
		isStarted: isStarted,
		start: start,
		stop: stop,
		cnf : cnf,
		buff : "",
		id : cnf.deviceId,
		write : function(data) {
			return iouObj.term.write(data);
		},
		resize : function(cols,rows) {
			return iouObj.term.resize(cols, rows);
		},
		term : term
	};

	return iouObj;
}

// *****************************************************************************************

function iouObject(db, e) {
	console.log(arguments.callee);

	// Set the collections
	colDevices = db.collection('devices');
	colLinks = db.collection('links');
	colIous = db.collection('ious');
	
	evt = e;
	
	var iObj = {};

	function iouFreeInterfaces(deviceId, cb) { // Return array with all the free interfaces
		colDevices.findOne({
			id : parseInt(deviceId)
		}, function(err, devObj) {
			colIous.findOne({
				id : parseInt(devObj.type)
			}, function(err, devQ) {
				colLinks.find({
					$or : [ {
						"source.id" : parseInt(deviceId)
					}, {
						"target.id" : parseInt(deviceId)
					} ]
				}).toArray(function(err, q) {
					var i, j = 0;
					var int = {
						serial : {},
						ethernet : {}
					};

					var eNum = (devQ.ethernet > 0) ? parseInt(1 + (devQ.ethernet - 1) / 4) : 0;
					var sNum = (devQ.serial > 0) ? parseInt(1 + (devQ.serial - 1) / 4) : 0;
					
					// console.log('eNum',eNum,' sNum',sNum);

					for (i = 0; i < eNum; i++, j++) {
						int.ethernet['e' + j + '/0'] = 1;
						int.ethernet['e' + j + '/1'] = 1;
						int.ethernet['e' + j + '/2'] = 1;
						int.ethernet['e' + j + '/3'] = 1;
					}
					for (i = 0; i < sNum; i++, j++) {
						int.serial['s' + j + '/0'] = 1;
						int.serial['s' + j + '/1'] = 1;
						int.serial['s' + j + '/2'] = 1;
						int.serial['s' + j + '/3'] = 1;
					}

					q.forEach(function(n) {
						if (n.source.id == parseInt(deviceId)) {
							delete (int.ethernet[n.source.name]);
							delete (int.serial[n.source.name]);
						}
						if (n.target.id == parseInt(deviceId)) {
							delete (int.ethernet[n.target.name]);
							delete (int.serial[n.target.name]);
						}
					});
					if (cb)
						cb(int); // return the free interfaces
				});
			});
		});
	}

	function iouFreeEthInts(deviceId, cb) { // Return object with all the free eth interfaces
		console.log(arguments.callee);
		iouFreeInterfaces(deviceId, function(int) {
			delete int.serial;
			if (cb)
				cb(int);
		});
	}

	function iouFreeSerInts(deviceId, cb) { // Return object with all the free ser interfaces
		console.log(arguments.callee);
		iouFreeInterfaces(deviceId, function(int) {
			delete int.ethernet;
			if (cb)
				cb(int);
		});
	}

	function iouFreeEthernet(deviceId, cb) { // Return the first free ethernet interface
		console.log(arguments.callee);
		iouFreeEthInts(deviceId, function(q) {
			cb(Object.keys(q.ethernet).sort()[0]);
		});
	}

	function iouFreeSerial(deviceId, cb) { // Return the first free serial interface
		console.log(arguments.callee);
		iouFreeSerInts(deviceId, function(q) {
			cb(Object.keys(q.serial).sort()[0]);
		});
	}

	function uiUpdateLink(msg) {
		console.log(arguments.callee);
		delete msg._id;

		function updLink(msg) {
			console.log(arguments.callee);
			colLinks.update({
				id : parseInt(msg.id)
			}, msg, function(err, q) {
				e.emit('updateLink', msg); // Update the diagram
			});
		}

		function updSource(int) {
			console.log(arguments.callee);
			if (int)
				msg.source.name = int;
			else {
				delete msg.source.id;
				msg.source.name = "";
			}
			updLink(msg);
		}

		function updTarget(int) {
			console.log(arguments.callee);
			if (int)
				msg.target.name = int;
			else {
				delete msg.target.id;
				msg.target.name = "";
			}
			updLink(msg);
		}

		if (msg.source.name && (!msg.source.id))
			updSource();
		if (msg.source.id && (!msg.source.name)) {
			if (msg.type == 'serial')
				iouFreeSerial(msg.source.id, updSource);
			else
				iouFreeEthernet(msg.source.id, updSource);
		}

		if (msg.target.name && (!msg.target.id))
			updTarget();
		if (msg.target.id && (!msg.target.name)) {
			if (msg.type == 'serial')
				iouFreeSerial(msg.target.id, updTarget);
			else
				iouFreeEthernet(msg.target.id, updTarget);
		}

	}

	e.on('uiAddLink', uiUpdateLink);
	e.on('uiUpdateLink', uiUpdateLink);

	function iouNetMap(cb) {
		console.log(arguments.callee);
		colLinks.find().toArray(function(err, q) {
			var s = "";
			q.forEach(function(n) {
				if (n.source.id && n.target.id && n.source.name && n.target.name) {
					var sInt = n.source.name;
					var tInt = n.target.name;
					if (sInt.match(/\d+\/\d+/))
						sInt = sInt.match(/\d+\/\d+/)[0];
					if (tInt.match(/\d+\/\d+/))
						tInt = tInt.match(/\d+\/\d+/)[0];
					s = s + n.source.id + ':' + sInt + ' ' + n.target.id + ':' + tInt + '\n';
				}
			});
			cb(s); // NetMAP file is built. Now lets write it
		});
	}

	// We need to verify from which directory the file operations will be executed
	function wrNetMap(cb) { // This function will write the NETMAP file (if it is different)
		console.log(arguments.callee);
		var fileName = config.labPath + '/NETMAP';
		var nm = fs.readFileSync(fileName);
		iouNetMap(function(data) {
			if (nm != data)
				fs.writeFileSync(fileName, data); // Rewrite the NETMAP if it has been changed
		});
	}

	// TODO: Implement destroy for the started IOU
	// TODO: Implement stop for the started IOU
	// TODO: Implement process handling for the IOU (the process died for example)
	// TODO: Low priority - Implement auto start
	// TODO: Implement file handling by applying 
	
	function iouStart(deviceId, cb) {
		console.log(arguments.callee);
		if (iObj[deviceId]) {
			// We need to start the IOU
			iObj[deviceId].start();
		}

		if (typeof iObj[deviceId] == 'undefined') { // We need to fix this to auto update the object in case of change of the device Template
			colDevices.findOne({ id: parseInt(deviceId) },function(err,device){
				if (!device) return; // Avoid crash because of a missing device
				colIous.findOne({ id: parseInt(device.type) },function(err,ious){
					var iouBase = config.iouBase;
					var iMap = iouBase.filter(function(n){ return n.id==ious.type?n:null; });
					var iouBin = iMap.length?iMap[0]:iouBase[0]; // Now we have the binary
					iObj[deviceId] = openIOU({
						'dir': config.labPath,
						'deviceId': deviceId,
						'iouBin': iouBin.iouBin,
						'memory': ious.memory,
						'nvram': ious.nvram,
						'serial': ious.serial,
						'ethernet': ious.ethernet,
						'confName': deviceId+'.conf',
						'data' : function(data) {
							console.log(':::>', data);
							e.emit('terminalOut',{ id: deviceId, data:data });
						}
					});
					iObj[deviceId].start(); // Notifications
					cb(iObj[deviceId]);
				});
			});
		} else
			cb(iObj[deviceId]);
		
	}
	
	e.on('terminalIn',function(msg) {
		if (typeof msg.data=='undefined') msg.data="";
		if (!iObj[msg.id]) return;
		// console.log('Send to IOU the following data',msg);
		msg.data = msg.data.replace(/\x03/g,""); // Remove CTRL+C
		iObj[msg.id].write(msg.data); // Write data to the IOU
	});
	
	e.on('terminalConnect',function(msg) {
		if (typeof msg.data=='undefined') msg.data="";
		e.emit('terminalIn',msg);
		if (iObj[msg.id]) e.emit('terminalOut',{ id:msg.id, data:iObj[msg.id].buff});
	});
	
	e.on('terminalResize',function(msg) {
		console.log(arguments.callee);
		if (typeof msg.data!=='object') return;
		console.log('Do resize ',msg);
		if (iObj[msg.id]) {
			iObj[msg.id].resize(msg.data.cols,msg.data.rows);
		}
	});

	function iouStop(deviceId, cb) {
		console.log(arguments.callee);

		if (iObj[deviceId]) {
			// We need to stop the IOU
			iObj[deviceId].stop();
		}
	}

	function iouRestart(deviceId, cb) {
		console.log(arguments.callee,arguments);
		
		iouStop(deviceId,function() {});
		iouStart(deviceId,cb);
	}
	
	// Messaging functions are defined here
	
	function iouDeviceStart(msg) {
		console.log(arguments.callee);
		
		iouStart(msg.id,function(obj){
			
		});
	}
	
	function iouDeviceStop(msg) {
		console.log(arguments.callee);
		
		iouStop(msg.id,function(obj) {
			
		});
	}
	
	e.on('startDevice',iouDeviceStart);
	e.on('stopDevice',iouDeviceStop);
	
	// Implement auto start
	colDevices.find().toArray(function(err,q) {
		q.forEach(function(n) {
			if (n.status=='online') iouDeviceStart({ id: n.id },function() {
				console.log('Started device',n);
			})
		});
	});

}

// *****************************************************************************************

// We shall create a demo class
// exports = iouTest;
// exports = openIOU;
exports = iouObject;
module.exports = exports;

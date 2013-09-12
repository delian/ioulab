/**
 * This file implements IOU
 */

/*
 * TODO: A simple spawn (with pty) of an IOU image defined by a binary path, id, memory, nvram, ethernet and serial interfaces TODO: Create a shared bus for the IOU output to be collected into a queue
 * of pointers (objects) for each subscriber to receive TODO: Create a subscriber management with Socket.io relation TODO: Find how if we change the NETMAP config file to force the IOU to reread it
 */

var config = require('../config.json');
var pty = require('pty.js');

var iouId = 100;

function appSpawn(app, dir) {

	var args = [ app ];

	if (app instanceof Object)
		args = app;

	var term = pty.spawn(args[0], args.slice(1), {
		name : 'xterm-color',
		cols : 80,
		rows : 30,
		cwd : dir || process.env.HOME,
		env : process.env
	});
	return term;
}

function iouCmdBuild(bin, id, mem, nvram, conf, ethernet, serial) {
	mem = mem ? mem : 256;
	nvram = nvram ? nvram : 64;
	ethernet = ethernet ? ethernet : 4;
	serial = serial ? serial : 4;
	conf = conf ? conf : ("IOU" + id);
	return [ bin, '-q', '-U', '-c', conf, '-m', mem, '-n', nvram, '-e', ethernet, '-s', serial, id ];
	// return bin+" -q -U -c "+conf+" -m "+mem+" -n "+nvram+" -e "+ethernet+" -s "+serial+" "+id;
}

function openIOU(cnf) {
	cnf = cnf || {};
	var term = {};

	var iouObj = {};

	var iouPath = iouCmdBuild("/home/delian/workspace/ioulab/iou/i86bi_linux-adventerprisek9-ms.152-2", ++iouId, cnf.memory, cnf.nvram, cnf.confName,
			cnf.ethernet, cnf.serial);

	console.log(iouPath);

	function iouOpen() {
		var term = appSpawn(cnf.iou || iouPath || 'bash', cnf.dir);
		term.on('data', cnf.data || function() {
			console.log('>>>', arguments[0]);
		});
		term.on('error', iouRespawn);
		term.on('close', iouRespawn);
		return term;
	}

	function iouRespawn() {
		if (cnf.stopped)
			return;
		var term = iouObj.term;
		if (term)
			term.destroy();
		iouObj.term = iouOpen();
	}

	term = iouOpen();

	iouObj = {
		cnf : cnf,
		id : iouId,
		write : function(data) {
			return iouObj.term.write(data);
		},
		resize : function() {
			return iouObj.term.resize.apply(this, arguments);
		},
		term : term
	};

	return iouObj;
}

function iouTest() {
	var term = openIOU({
		'data' : function(data) {
			console.log('>>>', data);
		}
	});

	term.write('pwd\r\n');

	// term.write('echo $TERM\r');
	// term.resize(100, 40);
	// term.write('ls /\r');
	// term.write('exit\r\n');
	// setTimeout(function() { console.log('retry\n'); term.write('ls -al\r\n');},2000);
	// console.log(term);
}

// *****************************************************************************************

function iouObject(db, e) {

	// Set the collections
	var colDevices = db.collection('devices');
	var colLinks = db.collection('links');
	var colIous = db.collection('ious');

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
					
					var eNum = (devQ.ethernet>0)?parseInt(1+(devQ.ethernet-1)/4):0;
					vae sNum = (devQ.serial>0)?parseInt(1+(devQ.serial-1)/4):0;
					
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
		iouFreeInterfaces(deviceId, function(int) {
			delete int.serial;
			if (cb)
				cb(int);
		});
	}

	function iouFreeSerInts(deviceId, cb) { // Return object with all the free ser interfaces
		iouFreeInterfaces(deviceId, function(int) {
			delete int.ethernet;
			if (cb)
				cb(int);
		});
	}

	function iouFreeEthernet(deviceId, cb) { // Return the first free ethernet interface
		iouFreeEthInts(deviceId, function(q) {
			cb(Object.keys(q.ethernet).sort()[0]);
		});
	}

	function iouFreeSerial(deviceId, cb) { // Return the first free serial interface
		iouFreeSerInts(deviceId, function(q) {
			cb(Object.keys(q.serial).sort()[0]);
		});
	}

	function uiUpdateLink(msg) {
		delete msg._id;

		function updLink(msg) {
			colLinks.update({
				id : parseInt(msg.id)
			}, msg, function(err, q) {
				e.emit('updateLink', msg); // Update the diagram
			});
		}
		
		function updSource(int) {
			if (int) msg.source.name = int; else {
				delete msg.source.id;
				msg.source.name="";
			}
			updLink(msg);
		}

		function updTarget(int) {
			if (int) msg.target.name = int; else {
				delete msg.target.id;
				msg.target.name="";
			}
			updLink(msg);
		}

		if (msg.source.name && (!msg.source.id)) updSource();
		if (msg.source.id && (!msg.source.name)) {
			if (msg.type == 'serial')
				iouFreeSerial(msg.source.id, updSource);
			else
				iouFreeEthernet(msg.source.id, updSource);
		}

		if (msg.target.name && (!msg.target.id)) updTarget();
		if (msg.target.id && (!msg.target.name)) {
			if (msg.type == 'serial')
				iouFreeSerial(msg.target.id, updTarget);
			else
				iouFreeEthernet(msg.target.id, updTarget);
		}

	}

	e.on('uiAddLink', uiUpdateLink);
	e.on('uiUpdateLink', uiUpdateLink);
	
	function iouNetMao(cb) {
		colLinks.find().toArray(function(err,q){
			var s="";
			q.forEach(function(n){
				if (s.source.id && s.target.id && s.source.name && s.target.name) {
					var sInt = 
				}
			});
		});
	}

	function iouStart(deviceId, cb) {

	}

	function iouStop(deviceId, cb) {

	}

	function iouRestart(deviceId, cb) {

	}

}

// *****************************************************************************************

// We shall create a demo class
// exports = iouTest;
// exports = openIOU;
exports = iouObject;
module.exports = exports;

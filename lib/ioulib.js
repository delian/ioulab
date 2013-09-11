/**
 * This file implements IOU
 */

/*
 * TODO: A simple spawn (with pty) of an IOU image defined by a binary path, id, memory, nvram, ethernet and serial interfaces
 * TODO: Create a shared bus for the IOU output to be collected into a queue of pointers (objects) for each subscriber to receive
 * TODO: Create a subscriber management with Socket.io relation
 * TODO: Find how if we change the NETMAP config file to force the IOU to reread it
 */

var pty = require('pty.js');

var iouId = 100;

function appSpawn(app, dir) {
	
	var args = [app];
	
	if (app instanceof Object) args=app;
	
	var term = pty.spawn(args[0],args.slice(1), {
		name : 'xterm-color',
		cols : 80,
		rows : 30,
		cwd : dir || process.env.HOME,
		env : process.env
	});
	return term;
}

function iouCmdBuild(bin,id,mem,nvram,conf,ethernet,serial) {
	mem=mem?mem:256;
	nvram=nvram?nvram:64;
	ethernet=ethernet?ethernet:4;
	serial=serial?serial:4;
	conf=conf?conf:("IOU"+id);
	return [bin,'-q','-U','-c',conf,'-m',mem,'-n',nvram,'-e',ethernet,'-s',serial,id];
//	return bin+" -q -U -c "+conf+" -m "+mem+" -n "+nvram+" -e "+ethernet+" -s "+serial+" "+id;
}

function openIOU(cnf) {
	cnf = cnf || {};
	var term = {};
	
	var iouObj = {};
	
	var iouPath = iouCmdBuild("/home/delian/workspace/ioulab/iou/i86bi_linux-adventerprisek9-ms.152-2",++iouId,cnf.memory,cnf.nvram,cnf.confName,cnf.ethernet,cnf.serial);

	console.log(iouPath);
	
	function iouOpen() {
		var term = appSpawn(cnf.iou || iouPath ||'bash',cnf.dir);
		term.on('data',cnf.data || function() { console.log('>>>',arguments[0]); });
		term.on('error',iouRespawn);
		term.on('close',iouRespawn);
		return term;
	}
	
	function iouRespawn() {
		if (cnf.stopped) return;
		var term = iouObj.term;
		if (term) term.destroy();
		iouObj.term = iouOpen();
	}

	term = iouOpen();
	
	iouObj = {
			cnf: cnf,
			id: iouId,
			write: function(data) { return iouObj.term.write(data); },
			resize: function() { return iouObj.term.resize.apply(this,arguments); },
			term: term
	};
	
	return iouObj;
}

function iouTest() {
	var term = openIOU({
		'data': function(data) {
			console.log('>>>',data);
		}
	});

	term.write('pwd\r\n');
	
	//term.write('echo $TERM\r');
	//term.resize(100, 40);
	//term.write('ls /\r');
	//term.write('exit\r\n');	
	//setTimeout(function() { console.log('retry\n'); term.write('ls -al\r\n');},2000);
	//console.log(term);
}

// *****************************************************************************************

function iouObject() {
	
	var deviceStatus={};
	
	function iouFreeInterfaces(deviceId,cb) { // Return array with all the free interfaces
		
	}
	
	function iouFreeEthInts(deviceId,cb) { // Return array with all the free eth interfaces
		
	}

	function iouFreeSerInts(deviceId,cb) { // Return array with all the free ser interfaces
		
	}

	function iouFreeEthernet(deviceId,cb) { // Return array with all the free eth interface
		iouFreeEthInts(deviceId,function(q) {
			if (q) cb(q[0]); else cb([]);
		});
	}

	function iouFreeSerial(deviceId,cb) { // Return array with all the free ser interface
		iouFreeSerInts(deviceId,function(q) {
			if (q) cb(q[0]); else cb([]);
		});
	}
	
	function iouStart(deviceId,cb) {
		
	}
	
	function iouStop(deviceId,cb) {
		
	}
	
	function iouRestart(deviceId,cb) {
		
	}
 
}

// *****************************************************************************************

// We shall create a demo class
//exports = iouTest;
exports = openIOU;
module.exports = exports;

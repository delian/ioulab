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
var waitpid = require('waitpid');

var colDevices;
var colLinks;
var colIous;
var colNvFiles;

var evt;

function nvname(id) {
	return "nvram_"+("000000"+parseInt(id)).slice(-5);
}

function vlanname(id) {
	return "vlan.dat-"+("000000"+parseInt(id)).slice(-5);	
}

function appSpawn(app, dir) {
	console.log(arguments.callee);

	var args = [ app ];

	if (app instanceof Object) args = app;

	// console.log('PTY SPAWN in dir "',dir||process.env.HOME,'"',args);
	
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
	mem = (typeof mem == 'undefined') ? 256 : Math.max(128,mem);
	nvram = (typeof nvram == 'undefined') ? 32 : Math.max(32,nvram);
	ethernet = (typeof ethernet == 'undefined') ? 1 : Math.max(0,ethernet);
	serial = (typeof serial == 'undefined') ? 0 : Math.max(0,serial);
	conf = conf ? conf : ("IOU" + id);
	return [ 'bash', '-c', bin+' -q -U -m '+mem+' -n '+nvram+' -e '+ethernet+' -s '+serial+' '+id ]; // Remove the configuration file as it is not used
//	return [ 'bash', '-c', bin+' -q -U -c '+conf+' -m '+mem+' -n '+nvram+' -e '+ethernet+' -s '+serial+' '+id ];
//	return [ bin, '-q', '-U', '-c', conf, '-m', mem, '-n', nvram, '-e', ethernet, '-s', serial, id ];
	// return bin+" -q -U -c "+conf+" -m "+mem+" -n "+nvram+" -e "+ethernet+" -s "+serial+" "+id;
}

function openIOU(cnf) {
	console.log(arguments.callee,arguments);
	cnf = cnf || {};
	var term;
	var iouObj = { status: 0, cnf: cnf, buff: "", id: cnf.deviceId };
	var maxBuffChars=50000;
	var iouPath = iouCmdBuild(cnf.iouBin, cnf.deviceId, cnf.memory, cnf.nvram, cnf.confName, cnf.ethernet, cnf.serial);

	// console.log(iouPath);
	
	function setOffStatus() {
		iouObj.status=0;
	}
	
	function iouOpen() {
		console.log(arguments.callee);
		var term = appSpawn(cnf.iou || iouPath || 'bash', cnf.dir);
		iouObj.status=1;
		term.on('data', function(msg) {
			// console.log('>>>', arguments[0]);
			iouObj.buff=(iouObj.buff.toString() + msg).toString().substr(-maxBuffChars,maxBuffChars); // Keep a buffer, for initial connection
			if (cnf.data) cnf.data(msg);  // Call back the data
		});
		term.on('error', setOffStatus);
		term.on('close', setOffStatus);
		term.on('exit', setOffStatus);
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
		return iouObj.status==1;
	}
	
	function start() {
		console.log(arguments.callee,arguments);
		if (!isStarted()) {
			term=iouOpen();
			iouObj.term=term;
		}

		// Change status to online
		colDevices.findAndModify({ id: parseInt(cnf.deviceId) },[],{ $set: { status: 'online' } }, { 'new': true },function(err,q){
			if (!err) evt.emit('updateDevice',q);			
		});
	}
	
	function stop() {
		console.log(arguments.callee);
		if (isStarted()) {
			// We need to stop the IOU
			// console.log('Do stop');
			iouObj.term.kill('SIGHUP'); // Lets try to close the pty?
			var status = waitpid(iouObj.term.pid); // This can be blocking, we shall be more careful
			// console.log('The process is dead',status);
			iouObj.status=0; // Dub?
		}
		// Change status to offline
		colDevices.findAndModify({ id: parseInt(cnf.deviceId) },[],{ $set: { status: 'offline' } }, { 'new': true },function(err,q){
			if (!err) evt.emit('updateDevice',q);			
		});
	}
	
	iouObj.isStarted=isStarted;
	iouObj.start=start;
	iouObj.stop=stop;
	iouObj.term=term;
	iouObj.write=function(data) {
		if (!isStarted()) return; // Write only if it is started
		return iouObj.term.write(data);
	};
	iouObj.resize=function(cols,rows) {
		if (!isStarted()) return; // Resize only if it is started
		return iouObj.term.resize(cols, rows);
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
	colNvFiles = db.collection('nvfiles');
	
	var intApi = require('./freeIntApi.js')(db);
	
	evt = e;
	
	var iObj = {};

	function uiUpdateLink(msg) {
		console.log(arguments.callee);
		delete msg._id;

		function updLink(msg) {
			console.log(arguments.callee);
			colLinks.update({
				id : parseInt(msg.id)
			}, msg, function(err, q) {
				console.log('I am trying to update the link because of the interface');
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

		if (msg.source.name && (!msg.source.id)) updSource();
		if (msg.source.id && (!msg.source.name)) {
			if (msg.type == 'serial') intApi.iouFreeSerial(msg.source.id, updSource);
			else intApi.iouFreeEthernet(msg.source.id, updSource);
		}

		if (msg.target.name && (!msg.target.id)) updTarget();
		if (msg.target.id && (!msg.target.name)) {
			if (msg.type == 'serial') intApi.iouFreeSerial(msg.target.id, updTarget);
			else intApi.iouFreeEthernet(msg.target.id, updTarget);
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
		var nm = "";
		try {
			nm = fs.readFileSync(fileName);
		} catch(e) {};
		iouNetMap(function(data) {
			if (nm != data)
				fs.writeFileSync(fileName, data); // Rewrite the NETMAP if it has been changed
			if (cb) cb();
		});
	}
	
	function readConfFromNVRAM(id) {
		console.log(arguments.callee,arguments);
		var fileName = config.labPath+'/'+nvname(id);
		try {
			var nvData = fs.readFileSync(fileName);
		} catch(e) {
			return "";
		}
		nvData=nvData.slice(36).toString();
		nvData=nvData.slice(0,nvData.indexOf(String.fromCharCode(0))); // Or 'end\n'+String.fromCharCode(0)
		return nvData; // This should be the configuration
	}

	// TODO: Implement file handling by applying 
	
	function iouStart(deviceId, cb) {
		console.log(arguments.callee);
		
		wrNetMap(function() {

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
						
						colNvFiles.findOne({ id: parseInt(deviceId) }, function(err,q) {
							if (q) {
								if (q.data)
									try {
										fs.statSync(config.labPath+'/'+nvname(deviceId));
									} catch(e) {
										fs.writeFileSync(config.labPath+'/'+nvname(deviceId),q.data); // Restore the data, if we have it in the DB but not out
									}
								if (q.vlan)
									try {
										fs.statSync(config.labPath+'/'+vlanname(deviceId));
									} catch(e) {
										fs.writeFileSync(config.labPath+'/'+vlanname(deviceId),q.vlan); // Restore the data, if we have it in the DB but not out
									}
							}
							iObj[deviceId] = openIOU({
								'dir': config.labPath,
								'deviceId': deviceId,
								'iouBin': iouBin.iouBin,
								'memory': ious.memory,
								'nvram': ious.nvram,
								'serial': parseInt(0.9999+ious.serial/4),
								'ethernet': parseInt(0.9999+ious.ethernet/4),
								'confName': deviceId+'.conf',
								'data' : function(data) {
									// console.log(':::>', data);
									e.emit('terminalOut',{ id: deviceId, data:data });
								}
							});
							iObj[deviceId].start(); // Notifications
							cb(iObj[deviceId]);							
						});						
					});
				});
			} else
				cb(iObj[deviceId]);
			
		}); // Create the NETMAP file on every start
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
	
	function resetDeviceFile(msg) {
		// For device msg.id we need to implement reset. That means - delete file nvram_00001 and 1.conf
		console.log('resetDeviceFile - remove the device support files nvram_* and id.conf');
		try {
			fs.unlinkSync(config.labPath+'/'+nvname(msg.id));
		} catch(e) {};
		try {
			fs.unlinkSync(config.labPath+'/'+vlanname(msg.id));
		} catch(e) {};
		try {
			fs.unlinkSync(config.labPath+'/'+msg.id+'.conf');
		} catch(e) {};
		
		colNvFiles.findOne({ id: parseInt(msg.id) }, function(err,q) {
			if (q) {
				if (q.data)
					try {
						fs.statSync(config.labPath+'/'+nvname(msg.id));
					} catch(e) {
						fs.writeFileSync(config.labPath+'/'+nvname(msg.id),q.data); // Restore the data, if we have it in the DB but not out
					}
				if (q.vlan)
					try {
						fs.statSync(config.labPath+'/'+vlanname(msg.id));
					} catch(e) {
						fs.writeFileSync(config.labPath+'/'+vlanname(msg.id),q.vlan); // Restore the data, if we have it in the DB but not out
					}
			}
		});		
	}
	
	e.on('resetDeviceFile',resetDeviceFile);
	
	e.on('removeDeviceFile', function(msg) {
		resetDeviceFile(msg);
		setTimeout(function() { // Remove with a little delay
			colNvFiles.remove({ id: parseInt(msg.id) },function(err,q){});
		},100);
	});
	
	e.on('saveDeviceFile',function(msg) {
		console.log('saveDeviceFile',msg);
		if (!msg.id) return;
		var data="";
		var vlan="";
		try {
			data = fs.readFileSync(config.labPath+'/'+nvname(msg.id)).toString('binary');
		} catch(e) {};
		try {
			vlan = fs.readFileSync(config.labPath+'/'+vlanname(msg.id)).toString('binary');
		} catch(e) {};
		if (data) {
			colNvFiles.update({ id: parseInt(msg.id)},{ id: parseInt(msg.id), data: data, vlan: vlan },{ upsert:true, safe:false}, function(err,q){
				//console.log('Device File is saved',msg,data,data.length);
			});
		}
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
		
		iouStop(deviceId,function() {
			iouStart(deviceId,cb);
		});
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
	
	function iouDeviceRestart(msg) {
		console.log(arguments.callee);
		
		iouRestart(msg.id,function(obj) {
			
		});		
	}
	
	function iouDeviceReset(msg) {
		console.log(arguments.callee);
		
		e.emit('resetDeviceFile',msg); // No restart for the moment
//		setTimeout(function() {
//			e.emit('restartDevice',msg);
//		},300);
	}

	function iouDeviceSave(msg) {
		console.log(arguments.callee);
		
		e.emit('saveDeviceFile',msg);
	}

	e.on('startDevice',iouDeviceStart);
	e.on('stopDevice',iouDeviceStop);
	e.on('restartDevice',iouDeviceRestart);
	e.on('resetDevice',iouDeviceReset);
	e.on('saveDevice',iouDeviceSave);
	
	// Implement auto start
	colDevices.find().toArray(function(err,q) {
		q.forEach(function(n) {
			if (n.status=='online') iouDeviceStart({ id: n.id },function() {
				console.log('Started device',n);
			})
		});
	});
	
	process.on('SIGCHLD',function() {
		console.log('SIGCHLD is received',arguments);		
	});
}

// *****************************************************************************************

exports = iouObject;
module.exports = exports;

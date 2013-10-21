/**
 * This file implements IOU
 */

var config = require('../config.json');
var fs = require('fs');
var pty = require('pty.js');
var waitpid = require('waitpid');
var dgram = require('unix-dgram');
var net = require('net');

var colDevices;
var colLinks;
var colIous;
var colNvFiles;

var qemuNetPort = 40000;

var evt;

function copyFile(source, target, cb) {
	var cbCalled = false;

	var rd = fs.createReadStream(source);
	rd.on("error", function(err) {
		done(err);
	});
	var wr = fs.createWriteStream(target);
	wr.on("error", function(err) {
		done(err);
	});
	wr.on("close", function(ex) {
		done();
	});
	rd.pipe(wr);

	function done(err) {
		if (!cbCalled) {
			cb(err);
			cbCalled = true;
		}
	}
}

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
//  return bin+" -q -U -c "+conf+" -m "+mem+" -n "+nvram+" -e "+ethernet+" -s "+serial+" "+id;
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

function qemuCmdBuild(bin, id, mem, params, image) {
	console.log(arguments.callee,arguments);
	mem = (typeof mem == 'undefined') ? 256 : Math.max(128,mem);
	image = image?image:"";
	var mac="AA:BB:CC:"+("0000"+2).slice(-4).replace(/(..)(..)/,'$1:$2')+":00";
	var netPort=qemuNetPort+id;
	var vncId=100+id;
	return [ 'bash', '-c', bin+' -m '+parseInt(mem).toString()+'M -device e1000,netdev=mynet,mac='+mac+' -netdev socket,id=mynet,listen=127.0.0.1:'+netPort+' -display vnc=127.0.0.1:'+vncId+' '+params+' '+image ]; // Remove the configuration file as it is not used
}

function openQEMU(cnf) {
	console.log(arguments.callee,arguments);
	cnf = cnf || {};
	var term;
	var iouObj = { status: 0, cnf: cnf, buff: "", id: cnf.deviceId };
	var iouPath = qemuCmdBuild(cnf.qemu, cnf.deviceId, cnf.memory, cnf.qemuParams, cnf.qemuImage);

	var qemuPort = qemuNetPort+cnf.deviceId;
	var iouNetPath = '/tmp/netio'+process.getuid() + '/';

	var sNet;
	var sUnix;
	var srcPath;
	var dstPath;
	var netTimer;

	console.log(iouPath);

	function prepIouHdr(sid,sint,did,dint) {
		var buff = new Buffer(8);

		function cnvInt(i) {
			if (i==parseInt(i)) return parseInt(i);
			try {
				var m = i.match(/(\d+)\/(\d+)/);
				return m[1]+m[2]*16;
			} catch(e) {
				console.log('Interface conversion didnt worked, fallback to 0',arguments);
				return 0;
			}
		}

		buff.writeUInt16BE(did,0);
		buff.writeUInt16BE(sid,2);
		buff.writeUInt8(cnvInt(dint),4);
		buff.writeUInt8(cnvInt(sint),5);
		buff.writeUInt16BE(0x0100,6);
		return buff;
	}

	function prepQemuHdr(len) {
		var buff = new Buffer(4);
		buff.writeUInt16BE(0,0);
		buff.writeUInt16BE(len,2);
		return buff;
	}

	function dataToIou(iouHdr,data) {
		var buff = new Buffer(data,'binary');
		return Buffer.concat([iouHdr,buff.slice(4)]);
	}

	function dataToQemu(data) {
		var b = data.slice(8);
		if (b.length<64) b=Buffer.concat([b,new Buffer(64-b.length)]);  // Implement padding
		return Buffer.concat([prepQemuHdr(b.length),b]).toString('binary');
	}

	function setOffStatus() { iouObj.status=0; }

	function qemuOpen() {
		console.log(arguments.callee);
		var term = appSpawn(cnf.iou || iouPath || 'bash', cnf.dir);
		iouObj.status=1;

		return term;
	}

	function iouRespawn() {
		console.log(arguments.callee);
		if (cnf.stopped) return;
		stop();
		start();
	}

	function isStarted() {
		console.log(arguments.callee);
		return iouObj.status==1;
	}

	function start() {
		console.log(arguments.callee,arguments);
		if (!isStarted()) {
			term=qemuOpen();
			iouObj.term=term;
			startNet(); // Start the network
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
			stopNet();
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

	function startTheNet() {
		stopNet();
		// Implement the network stack by finding the link to the qemu
		colLinks.findOne({
			$or: [
			      { "source.id": parseInt(cnf.deviceId) },
			      { "source.id": cnf.deviceId.toString() },
			      { "target.id": parseInt(cnf.deviceId) },
			      { "target.id": cnf.deviceId.toString() }
			]
		},function(err,q) {
			if ((!q) || err) {
				console.log('Cannot find a link to the QEMU!')
				return startNet(1000);
			}

			// We have a link. Lets find the target ID
			var myId = parseInt(cnf.deviceId);
			var targetId=(q.source.id==myId)?q.target.id:q.source.id;
			var targetInt=(q.source.id==myId)?q.target.name:q.source.name;

			if (!(targetId>=1)) {
				console.log('Cannot find the remote side');
				return startNet(1000);
			}
			
			dstPath = iouNetPath+targetId;
			srcPath = iouNetPath+myId;

			try {
				fs.statSync(iouNetPath);				
			} catch(e) {
				console.log('No any IOU has been started yet. Retry in a while');
				return startNet(1000);
			}

			try {
				fs.statSync(dstPath);
			} catch(e) {
				console.log('Remote IOU has been started yet. Retry in a while');
				return startNet(1000);
			}

			console.log('Qemu will connect to',targetId,targetInt);

			var iouHdr = prepIouHdr(cnf.deviceId,0,targetId,targetInt);
			
			// Remove the SRC path if it is already there (old crash)
			try {
				if (fs.statSync(srcPath)) fs.unlinkSync(srcPath); // Delete the file
			} catch(e) { }

//			try {
				sUnix=dgram.createSocket('unix_dgram');
				sUnix.bind(srcPath,function() {
					console.log('Binded to the source unix socket');
				});
//			} catch(e) {
//				return startNet(1000);
//			}
			try {
				sNet = net.createConnection(qemuNetPort+myId,'127.0.0.1');
			} catch(e) {
				return startNet(1000);
			}
			sNet.setEncoding('binary');
			sNet.on('connect',function() {
				console.log('qemu connect');
			});
			sUnix.on('message',function(msg){
				var data = dataToQemu(msg);
//				try {
					sNet.write(data,'binary');
//				} catch(e) {
//					return startNet(1000);
//				}
			});
			sNet.on('data',function(msg){
				var data = dataToIou(iouHdr,msg);
//				try {
					sUnix.sendto(data,0,data.length,dstPath,function() {
						// Data is sent
					});
//				} catch(e) {
//					return startNet(1000);
//				}
			});
			sNet.on('error',function() {
				console.log('Error? on sNet');
				startNet(1000);
			});
			sNet.on('end',function() {
				console.log('The network is closed for some reason!');
				// sUnix.close();
			});
		});
	}

	function stopTheNet() {
		// Enforce the Net to be stopped
		try {
			if (sNet) sNet.close();
		} catch(e) {};
		sNet = undefined;

		try {
			if (sUnix) sUnix.close();
		} catch(e) {};
		sUnix = undefined;

		setTimeout(function() {
			try {
				if (srcPath) fs.unlinkSync(srcPath);
			} catch(e) {};
		},50); // Not sure I want it...
	}

	function startNet(delay) {
		if (netTimer) clearTimeout(netTimer);
//		try {
			if (!delay) return startTheNet();
//		} catch(e) { };
		netTimer=setTimeout(function(){
			return startNet();
		},delay?delay:1000);
	}

	function stopNet() {
		if (netTimer) clearTimeout();
		stopTheNet();
	}

	term = qemuOpen();
	setTimeout(function() {
		startNet();
	},100);

	iouObj.isStarted=isStarted;
	iouObj.start=start;
	iouObj.stop=stop;
	iouObj.term=term;
	iouObj.startNet=startNet;
	iouObj.stopNet=stopNet;
	iouObj.write=function(data) {
		if (!isStarted()) return; // Write only if it is started
	};
	iouObj.resize=function(cols,rows) {
		if (!isStarted()) return; // Resize only if it is started
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

						if (iouBin.type=='qemu') {
							function doQemuStart(imgName) {
								console.log('QEMU start');
								iObj[deviceId] = openQEMU({
									'dir': config.labPath,
									'deviceId': deviceId,
									'qemu': iouBin.iouBin,
									'qemuParams': iouBin.qemuParams,
									'qemuImage': imgName,
									'memory': ious.memory,
									'ethernet': parseInt(0.9999+ious.ethernet/4)
								});
								iObj[deviceId].start();
								cb(iObj[deviceId]);
							}
							var imgName = deviceId.toString()+'.img';
							if (!iouBin.qemuImage) doQemuStart("");
							else {
							   try {
								if (fs.statSync(config.labPath+"/"+imgName)) {
									console.log('Image existed, start Qemu');
									doQemuStart(imgName);
								}
							   } catch(e) {
								console.log('Copy ',iouBin.qemuImage,config.labPath+"/"+imgName);
								copyFile(iouBin.qemuImage,config.labPath+"/"+imgName,function() {
									doQemuStart(imgName);
								});
							   }
							}
						} else {
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
						}
					});
				});
			} else
				cb(iObj[deviceId]);
		}); // Create the NETMAP file on every start
	}

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

	function iouStop(deviceId, cb) {
		console.log(arguments.callee);
		if (iObj[deviceId]) {
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

	function deviceStart(msg) {
		console.log(arguments.callee);
		iouStart(msg.id,function(obj){ });
	}

	function deviceStop(msg) {
		console.log(arguments.callee);
		iouStop(msg.id,function(obj) { });
	}

	function deviceRestart(msg) {
		console.log(arguments.callee);
		iouRestart(msg.id,function(obj) { });
	}

	function deviceReset(msg) {
		console.log(arguments.callee);
		e.emit('resetDeviceFile',msg);
	}

	function deviceSave(msg) {
		console.log(arguments.callee);
		e.emit('saveDeviceFile',msg);
	}

	function removeDeviceFile(msg) {
		console.log(arguments.callee);
		resetDeviceFile(msg);
		setTimeout(function() { // Remove with a little delay
			colNvFiles.remove({ id: parseInt(msg.id) },function(err,q){});
		},100);
	}

	e.on('uiAddLink', uiUpdateLink);
	e.on('uiUpdateLink', uiUpdateLink);
	e.on('startDevice',deviceStart);
	e.on('stopDevice',deviceStop);
	e.on('restartDevice',deviceRestart);
	e.on('resetDevice',deviceReset);
	e.on('saveDevice',deviceSave);
	e.on('removeDevice',function(msg) {
		deviceStop(msg);
		removeDeviceFile(msg);
	});
	e.on('terminalResize',function(msg) {
		console.log(arguments.callee);
		if (typeof msg.data!=='object') return;
		console.log('Do resize ',msg);
		if (iObj[msg.id]) {
			iObj[msg.id].resize(msg.data.cols,msg.data.rows);
		}
	});
	e.on('resetDeviceFile',resetDeviceFile);
	e.on('removeDeviceFile', removeDeviceFile);
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

	// Implement auto start
	colDevices.find().toArray(function(err,q) {
		q.forEach(function(n) {
			if (n.status=='online') deviceStart({ id: n.id },function() {
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

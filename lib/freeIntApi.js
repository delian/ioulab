/*
 * API covering the free interfaces
 */

function freeIntApi(db) {
	
	var colDevices = db.collection('devices');
	var colLinks = db.collection('links');
	var colIous = db.collection('ious');
	
	function iouInterfaces(deviceId, cb) {
		colDevices.findOne({
			id : parseInt(deviceId)
		}, function(err, devObj) {
			colIous.findOne({
				id : parseInt(devObj.type)
			}, function(err, devQ) {
				var i, j = 0;
				var intf = {
					serial : {},
					ethernet : {}
				};
				var eNum = (devQ.ethernet > 0) ? parseInt(0.9999 + (devQ.ethernet) / 4) : 0;
				var sNum = (devQ.serial > 0) ? parseInt(0.9999 + (devQ.serial) / 4) : 0;
				
				// console.log('eNum',eNum,' sNum',sNum);

				for (i = 0; i < eNum; i++, j++) {
					intf.ethernet['e' + j + '/0'] = 1;
					intf.ethernet['e' + j + '/1'] = 1;
					intf.ethernet['e' + j + '/2'] = 1;
					intf.ethernet['e' + j + '/3'] = 1;
				}
				
				for (i = 0; i < sNum; i++, j++) {
					intf.serial['s' + j + '/0'] = 1;
					intf.serial['s' + j + '/1'] = 1;
					intf.serial['s' + j + '/2'] = 1;
					intf.serial['s' + j + '/3'] = 1;
				}
				
				return cb(intf);
			});
		});
	}

	function iouFreeInterfaces(deviceId, cb) { // Return array with all the free interfaces
		iouInterfaces(deviceId,function(intf) {
			colLinks.find({
				$or : [ {
					"source.id" : parseInt(deviceId)
				}, {
					"target.id" : parseInt(deviceId)
				} ]
			}).toArray(function(err, q) {
				q.forEach(function(n) {
					if (n.source.id == parseInt(deviceId)) {
						delete (intf.ethernet[n.source.name]);
						delete (intf.serial[n.source.name]);
					}
					if (n.target.id == parseInt(deviceId)) {
						delete (intf.ethernet[n.target.name]);
						delete (intf.serial[n.target.name]);
					}
				});
				if (cb)
					cb(intf); // return the free interfaces
			});
		});
	}

	function iouFreeEthInts(deviceId, cb) { // Return object with all the free eth interfaces
		console.log(arguments.callee);
		iouFreeInterfaces(deviceId, function(intf) {
			delete intf.serial;
			if (cb)
				cb(intf);
		});
	}

	function iouFreeSerInts(deviceId, cb) { // Return object with all the free ser interfaces
		console.log(arguments.callee);
		iouFreeInterfaces(deviceId, function(intf) {
			delete intf.ethernet;
			if (cb)
				cb(intf);
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
	
	return {
		iouInterfaces: iouInterfaces,
		iouFreeInterfaces: iouFreeInterfaces,
		iouFreeEthInts: iouFreeEthInts,
		iouFreeSerInts: iouFreeSerInts,
		iouFreeEthernet: iouFreeEthernet,
		iouFreeSerial: iouFreeSerial
	}
}

exports = freeIntApi;
module.exports = exports;

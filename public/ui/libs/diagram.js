/*

This is the code that manages the Diagram draw

 */

/**
 * This is the class constructor of the diagram. The code is written in the correct pattern, with "private" methods and private variables
 */

function createDiagram(extJsObj, labId, readOnly, config) {
	console.log('createDiagram', arguments);

	var trashMinSize = 25;
	var trashMaxSize = 50;
	var trashMaxRegion = 50;
	var trashFadeInterval = 2000;
	var doubleClickInterval = 500;
	var minWidth = 600;
	var maxWidth = 2000;
	var minHeight = 400;
	var maxHeight = 1000;
	var devWidth = 50;
	var devHeight = 50;
	var linkSLabel = 0.15;
	var linkNLabel = 0.85;
	var linkLabel = 0.5;
	var fullRefresh = 30000;
	var offlineOpacity = 0.4;

	var suspendEvents = false; // If true, there will be no update to the server

	var el = extJsObj.el;

	var width = extJsObj.getWidth();
	var height = extJsObj.getHeight();

	var socket;

	// Create the diagram
	var graph = new joint.dia.Graph();
	var paper = new joint.dia.Paper({
		el : $('#' + el.id),
		width : (width > minWidth && width < maxWidth) ? width : maxWidth,
		height : (height > minHeight && height < maxHeight) ? height : maxHeight,
		gridSize : 1,
		model : graph
	});

	var diag = {
		click : {},
		objs : {},
		graph : graph,
		paper : paper
	};

	var objs = {};

	graph.on('all', function() {
//		console.log('graph>>', arguments);
	});

	paper.on('all', function(e, child, jq, x, y) {
//		console.log('paper>>', arguments);
		var elId;

		if (e == 'cell:pointerup') {
			elId = child.el.getAttribute('model-id');
			diag.click[elId] = new Date(); // Set for the double click
			if (diag.trashObj && diag.trashSize >= trashMaxSize && x <= trashMaxSize && y <= trashMaxSize) { // Delete the object
				var obj = objs[elId];
				obj.remove();
				delete objs[elId];
				console.log('Object elId', elId, 'removed');
			}
		}

		if (e == 'cell:pointerdown') {
			elId = child.el.getAttribute('model-id');
			var d = new Date();
			if (!diag.click[elId])
				diag.click[elId] = new Date(0);
			if (d - diag.click[elId] < doubleClickInterval)
				objs[elId].trigger('cell:doubleclick',objs[elId],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]); // propagate the event
		}

		if (e == 'cell:pointermove') { // Draw trash
			if (!diag.trashObj)
				addTrash();
			if ((x < trashMaxRegion && y < trashMaxRegion) && diag.trashSize < trashMaxSize)
				addTrash(trashMaxSize);
			if ((x > trashMaxRegion || y > trashMaxRegion) && diag.trashSize >= trashMaxSize)
				addTrash(trashMinSize);
			if (diag.trash)
				clearTimeout(diag.trash);
			diag.trash = setTimeout(function() {
				if (diag.trashObj)
					diag.trashObj.remove();
				delete (diag.trashObj);
			}, trashFadeInterval);
		}
	});

	extJsObj.on('resize', function(comp, w, h) {
		console.log('Resize', w, h);
		width = w;
		height = h;
		paper.setDimensions(w, h); // Resize the diagram
	});

	function sendMsg(t, msg) {
		console.log('sendMsg', t, msg);
		if (!suspendEvents)
			socket.emit(t, msg);
	}

	function addObj(obj) {
		console.log('addObj', arguments);
		obj.on('all', function() {
			console.log('element>>', arguments);
		});
		obj.on('cell:doubleclick', function(obj,child,jq,x,y) {
			if (obj.oType=='device'&&config.deviceDoubleClick) config.deviceDoubleClick(obj,x,y);
			if (obj.oType=='link'&&config.linkDoubleClick) config.linkDoubleClick(obj,x,y);
		});
		obj.on('change', function(child) {
			console.log('element>>change>>', child, obj, arguments);
			if (obj.oType == 'device') {
				sendMsg('updateDevice', {
					lab : labId,
					id : obj.id,
					x : obj.attributes.position.x,
					y : obj.attributes.position.y,
					z : obj.attributes.z,
					name : child.attributes.attrs.text.text,
					icon : child.oIcon,
					type : child.oTemp,
					status : child.oStatus
				});
			}
			if (obj.oType == 'link') {
				console.log('Child labels are', child, child.attributes);
				obj.attributes.source.name = child.attributes.labels[0].attrs.text.text;
				obj.attributes.target.name = child.attributes.labels[2].attrs.text.text;
				sendMsg('updateLink', {
					lab : labId,
					id : obj.id,
					source : obj.attributes.source,
					target : obj.attributes.target,
					z : obj.attributes.z,
					vertices : obj.attributes.vertices,
					name : obj.attributes.labels[1].attrs.text.text
				});
			}
		});
		obj.on('remove', function(type, child) { // Automatic handle of the remove
			console.log('we shall remove', child, obj);
			if (obj.oType == 'device')
				sendMsg('removeDevice', {
					lab : labId,
					id : obj.id
				});
			if (obj.oType == 'link')
				sendMsg('removeLink', {
					lab : labId,
					id : obj.id
				});
		});
		objs[obj.id] = obj;
		return graph.addCell(obj);
	}

	function rawAddDevice(id, x, y, text, icon, type, status) {
		console.log('rawAddDevice', arguments);
		var s = status ? status : 'offline';

		var image = new joint.shapes.basic.Image({
			id : id,
			position : {
				x : x,
				y : y
			},
			size : {
				width : devWidth,
				height : devHeight
			},
			attrs : {
				text : {
					text : text,
					fill : 'black'
				},
				image : {
					'xlink:href' : icon,
					opacity : s == 'offline' ? offlineOpacity : 1,
					width : devWidth,
					height : devHeight
				}
			}
		});
		image.oType = 'device';
		image.oIcon = icon;
		image.oTemp = type;
		image.oStatus = s;
		addObj(image);
		sendMsg('addDevice', {
			lab : labId,
			id : id,
			x : x,
			y : y,
			name : text,
			type : type,
			icon : icon,
			status : image.oStatus
		});
		return image;
	}

	function addDevice(x, y, type, name) {
		console.log('addDevice', arguments);
		var s = Ext.StoreMgr.get('iouTemplates');
		var r = s.getById(type);
		var text = name || r.get('name');
		var icon = r.get('icon');

		Ext.Ajax.request({
			url : '/rest/allocate/deviceId',
			success : function(res) {
				var msg = Ext.JSON.decode(res.responseText);
				rawAddDevice(msg.id, x, y, text, icon, type);
			},
			failure : function() {
				console.error('No device ID!!!');
			}
		});
	}

	function addTrash(big) {
		console.log('addTrash', arguments);
		var size = big || 30;
		if (diag.trashObj)
			diag.trashObj.remove();
		var image = new joint.shapes.basic.Image({
			id : 'trashObjId',
			position : {
				x : 0,
				y : 0
			},
			size : {
				width : size,
				height : size
			},
			attrs : {
				image : {
					'xlink:href' : 'icons/trash-256-lgreen.png',
					width : size,
					height : size
				}
			}
		});
		graph.addCell(image);
		diag.trashObj = image;
		diag.trashSize = size;
		return image;
	}

	function rawAddLink(id, id1, id2, x1, y1, x2, y2, text, upText, downText, style, vertices) {
		console.log('rawAddLink', arguments);
		link = new joint.dia.Link({
			id : id,
			source : {
				id : id1,
				x : x1,
				y : y1
			},
			target : {
				id : id2,
				x : x2,
				y : y2
			},
			vertices : vertices ? vertices : [],
			labels : [ {
				position : linkSLabel,
				attrs : {
					text : {
						text : upText || ""
					}
				}
			}, {
				position : linkLabel,
				attrs : {
					text : {
						text : text,
						'font-weight' : 'bold'
					}
				}
			}, {
				position : linkNLabel,
				attrs : {
					text : {
						text : downText || ""
					}
				}

			} ],
			smooth : true
		});

		if (readOnly)
			link.off('cell:pointerdown'); // Not working

		link.oType = 'link';
		addObj(link);
		sendMsg('addLink', {
			lab : labId,
			id : id,
			source : {
				id : id1,
				x : x1,
				y : y1,
				name : upText
			},
			target : {
				id : id2,
				x : x2,
				y : y2,
				name : downText
			},
			name : text,
			type : style
		});
		return link;
	}

	function addLink(x, y, type, name, id1, id2) {
		console.log('addLink', arguments);

		Ext.Ajax.request({
			url : '/rest/allocate/linkId',
			success : function(res) {
				var msg = Ext.JSON.decode(res.responseText);
				if (id1 && id2)
					rawAddLink(msg.id, id1, id2, 0, 0, 0, 0, name || type, "", "", type);
				else
					rawAddLink(msg.id, 0, 0, x, y, x + 100, y, name || type, "", "", type);
			},
			failure : function() {
				console.error('No Link ID!!!');
			}
		});
	}

	function getPaper() {
		console.log('getPaper', arguments);
		return paper;
	}

	function getGraph() {
		console.log('getGraph', arguments);
		return graph;
	}

	function getObjById(id) {
		console.log('getObjById', arguments);
		return diag.obj[id];
	}

	function setScale(sx, sy) {
		console.log('setScale', arguments);
		sendMsg('setScale', {
			lab : labId,
			x : sx,
			y : sy
		});
		return paper.scale(sx, sy);
	}

	function setScaleQuiet(sx, sy) {
		console.log('setScaleQuiet', arguments);
		return setScale(sx, sy);
	}

	function destroy() {
		console.log('destroy', arguments);
		suspendEvents = true;
		if (diag.getAllId)
			clearInterval(diag.getAllId); // Stop the periodic refresh
		delete (diag.getAllId);
		graph.clear(); // Clear the graph
		suspendEvents = false;
		sendMsg('quit');
		socket.disconnect();
		socket = null;
		el.update(''); // Remove the diagram from the ExtJs
	}

	// Create the socket.io interface

	// TODO: Generic suppress socket.io send of events is necessary. I will use suspendEvents for it
	function sockAddDevice(msg) {
		console.log('sockAddDevice', arguments);

		if (msg.lab!=labId) return;

		if (objs[msg.id])
			return sockUpdateDevice(msg); // It exists, so instead we shall do an update

		suspendEvents = true;
		rawAddDevice(msg.id, msg.x, msg.y, msg.name, msg.icon, msg.type, msg.status);
		suspendEvents = false;
		if (config && config.sockAddDevice)
			config.sockAddDevice(msg);
	}

	function sockAddLink(msg) {
		console.log('sockAddLink', arguments);

		if (msg.lab!=labId) return;

		if (objs[msg.id])
			return sockUpdateLink(msg); // It exists, so instead we shall do an update

		suspendEvents = true;
		rawAddLink(msg.id, msg.source.id, msg.target.id, msg.source.x, msg.source.y, msg.target.x, msg.target.y, msg.name, msg.source.name, msg.target.name,
				msg.type, msg.vertices);
		suspendEvents = false;
		if (config && config.sockAddLink)
			config.sockAddLink(msg);
	}

	// TODO: May be width and height should be also maintained by the server?
	function sockUpdateDevice(msg) {
		console.log('sockUpdateDevice', arguments);
		
		if (msg.lab!=labId) return;

		if (!objs[msg.id])
			return; // Does not exists, exist

		suspendEvents = true;
		var d = objs[msg.id];

		d.set('position', {
			x : msg.x,
			y : msg.y
		});
		d.set('z', msg.z);
		if (msg.name && msg.icon)
			d.attr({
				text : {
					text : msg.name
				},
				image : {
					'xlink:href' : msg.icon
				}
			}); // This is unconfirmed to work
		if (msg.icon)
			d.oIcon = msg.icon;
		if (msg.type)
			d.oTemp = msg.type;
		if (msg.status) {
			d.oStatus = msg.status;
			d.attr({
				image : {
					opacity : msg.status == 'offline' ? offlineOpacity : 1
				}
			});
		}
		suspendEvents = false;
		if (config && config.sockUpdateDevice)
			config.sockUpdateDevice(msg);
	}

	function sockUpdateLink(msg) {
		console.log('sockUpdateLink', arguments);

		if (msg.lab!=labId) return;

		if (!objs[msg.id])
			return; // Does not exists, exist

		suspendEvents = true;

		var d = objs[msg.id];
		if (msg.vertices)
			d.set('vertices', msg.vertices);
		d.set('source', msg.source);
		d.set('target', msg.target);
		d.set('z', msg.z);
		d.label(0, {
			position : linkSLabel,
			attrs : {
				text : {
					text : msg.source.name
				}
			}
		});
		d.label(1, {
			position : linkLabel,
			attrs : {
				text : {
					text : msg.name,
					'font-weight' : 'bold'
				}
			}
		});
		d.label(2, {
			position : linkNLabel,
			attrs : {
				text : {
					text : msg.target.name
				}
			}
		});

		suspendEvents = false;
		if (config && config.sockUpdateLink)
			config.sockUpdateLink(msg);
	}

	function sockRemoveDevice(msg) {
		console.log('sockRemoveDevice', arguments);

		if (msg.lab!=labId) return;

		if (!objs[msg.id])
			return; // Does not exists, exist

		suspendEvents = true;
		objs[msg.id].remove({
			disconnectLinks : true
		}); // No disconnections to avoid waterfall of events
		delete objs[msg.id];
		suspendEvents = false;
		if (config && config.sockRemoveDevice)
			config.sockRemoveDevice(msg);
	}

	function sockRemoveLink(msg) {
		console.log('sockRemoveLink', arguments);

		if (msg.lab!=labId) return;

		if (!objs[msg.id])
			return; // Does not exists, exist

		suspendEvents = true;
		objs[msg.id].remove();
		delete objs[msg.id];
		suspendEvents = false;
		if (config && config.sockRemoveLink)
			config.sockRemoveLink(msg);
	}

	function sockSetScale(msg) {
		console.log('sockSetScale', arguments);

		if (msg.lab!=labId) return;
		
		suspendEvents = true;
		setScale(msg.x, msg.y);
		suspendEvents = false;
		if (config && config.sockSetScale)
			config.sockSetScale(msg);
	}

	function sockGetAll(msg) {
		console.log('sockGetAll', arguments);

		if (msg.lab!=labId) return;
		
		var garbage = {};
		var k;
		for (k in objs)
			garbage[k] = objs[k];

		if (msg) {
			if (msg.devices) {
				Ext.Array.each(msg.devices, function(n) {
					sockAddDevice(n);
					delete garbage[n.id];
				});
			}
			if (msg.links) {
				Ext.Array.each(msg.links, function(n) {
					sockAddLink(n);
					delete garbage[n.id];
				});
			}
			for (k in garbage)
				sockRemoveDevice({
					id : k
				}); // This is how we clean the garbage. Should remove link as well.
			if (msg.scale)
				sockSetScale(msg.scale);
		}

		if (config && config.sockGetAll)
			config.sockGetAll(msg);
	}

	// Set the socket event handlers
	// TODO: Error handling
	socket = io.connect('/labs'); // Join the Labs interface
	socket.on('getAll', sockGetAll);
	socket.on('addDevice', sockAddDevice);
	socket.on('addLink', sockAddLink);
	socket.on('updateDevice', sockUpdateDevice);
	socket.on('updateLink', sockUpdateLink);
	socket.on('removeDevice', sockRemoveDevice);
	socket.on('removeLink', sockRemoveLink);
	socket.on('setScale', sockSetScale);
	socket.on('connect', function() { // Implement the Socket Interface
		console.log('Socket connectedm join lab', labId);
		socket.emit('joinLab', labId); // Join this lab only
		setTimeout(function() {
			sendMsg('getAll', { lab: labId });
		}, 50); // In 50ms do a full refresh
	});

	setTimeout(function() {
		sendMsg('getAll', { lab: labId });
	}, 1000); // First refresh after one second

	diag.getAllId = setInterval(function() {
		sendMsg('getAll', { lab: labId });
	}, fullRefresh);

	// Add the public methods of that class
	// diag.addObj = addObj;
	diag.addDevice = addDevice;
	diag.addLink = addLink;
	// diag.rawAddDevice = rawAddDevice;
	// diag.rawAddLink = rawAddLink;
	diag.getPaper = getPaper;
	diag.getGraph = getGraph;
	diag.getObjById = getObjById;
	diag.setScale = setScale;
	diag.setScaleQuiet = setScaleQuiet;
	diag.destroy = destroy;

	return diag;
}

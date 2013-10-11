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
	var myIdPfx = 'xxxdiagram';

	var suspendEvents = false; // If true, there will be no update to the server

	var el = extJsObj.el;

	var width = extJsObj.getWidth();
	var height = extJsObj.getHeight();

	var socket;

	// Create the diagram
	var graph = new joint.dia.Graph();
	
	document.getElementById(el.id).innerHTML="<DIV ID='"+myIdPfx+labId+"'></DIV>"; // Force delete and rebuild of an element that will be deleted later because of a joint.js bug
	
	var paper = new joint.dia.Paper({
//		el : $('#' + el.id),
		el : $('#' + myIdPfx + labId),
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
		console.log('paper>>', arguments);
		var elId;

		if (e == 'cell:pointerup') {
			elId = child.model.id;
			jq.stopPropagation();
			var d = new Date();
			if (!diag.click[elId]) diag.click[elId] = new Date(0);
			if (d - diag.click[elId] < doubleClickInterval) {
				console.log(arguments[2]);
				//arguments[2].stopPropagation(); // Stop propagating it
				objs[elId].trigger('cell:doubleclick',objs[elId],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]); // propagate the event
			}
			
			diag.click[elId] = new Date(); // Set for the double click
			
			if (diag.trashObj && diag.trashSize >= trashMaxSize && x <= trashMaxSize && y <= trashMaxSize) { // Delete the object
				var obj = objs[elId];
				obj.remove();
				delete objs[elId];
				console.log('Object elId', elId, 'removed');
			}
		}

		if (e == 'cell:pointerdown') { // Not used for the moment
			elId = child.model.id;
		}

		if ((!readOnly) && e == 'cell:pointermove') { // Draw trash
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
			
			// Lets check are we talking for a a figure object?
			var attr = child.model.attributes;
			if ((attr.type=="basic.Rect" && Math.abs(attr.position.x+attr.size.width-x)<10 && Math.abs(attr.position.y+attr.size.height-y)<10 ) ||
				(attr.type=="basic.Circle" && Math.abs(attr.position.x+attr.size.width-x)<10)){
				elId = child.model.id;
				var pattr = child.model._previousAttributes;
				var objModel = objs[elId];
				objModel.set('size',{ width: Math.max(20,attr.size.width + attr.position.x-pattr.position.x), height: Math.max(20,attr.size.height + attr.position.y-pattr.position.y) });
				objModel.set('position', pattr.position);
			}
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
			if (obj.oType=='object'&&config.objectDoubleClick) config.objectDoubleClick(obj,x,y);
		});
		
		if (readOnly) {
			obj.on('change:position', function(child){
				console.log('Change position in read-only',arguments);
				if (!obj.forceUpdate) obj.attributes=obj._previousAttributes;
				delete(obj.forceUpdate);
			});
		}
		
		if (!readOnly) obj.on('change', function(child) {
			console.log('element>>change>>', child, obj, arguments);
			if (obj.oType == 'device') {
				obj.oMsg.z = obj.attributes.z;
				obj.oMsg.x = obj.attributes.position.x;
				obj.oMsg.y = obj.attributes.position.y;
				sendMsg('updateDevice',obj.oMsg);
			}
			if (obj.oType == 'link') {
				obj.oMsg.z = obj.attributes.z;
				obj.oMsg.source.id = obj.attributes.source.id;
				obj.oMsg.source.x = obj.attributes.source.x;
				obj.oMsg.source.y = obj.attributes.source.y;
				obj.oMsg.target.id = obj.attributes.target.id;
				obj.oMsg.target.x = obj.attributes.target.x;
				obj.oMsg.target.y = obj.attributes.target.y;
				obj.oMsg.vertices = obj.attributes.vertices;
				sendMsg('updateLink', obj.oMsg);
			}
			if (obj.oType == 'object') {
				obj.oMsg.z = obj.attributes.z;
				obj.oMsg.x = obj.attributes.position.x;
				obj.oMsg.y = obj.attributes.position.y;
				if (obj.attributes.size) {
					obj.oMsg.width = obj.attributes.size.width;
					obj.oMsg.height = obj.attributes.size.height;
				}
				sendMsg('updateObject', obj.oMsg);
			}
		});
	if (!readOnly) obj.on('remove', function(type, child) { // Automatic handle of the remove
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
			if (obj.oType == 'object') {
				sendMsg('removeObject', {
					lab : labId,
					id : obj.id
				});				
			}
		});
		objs[obj.id] = obj;
		return graph.addCell(obj);
	}

	function rawAddDevice(msg) {
		console.log('rawAddDevice', arguments);
		msg.status = msg.status || 'offline';

		var image = new joint.shapes.basic.Image({
			id : msg.id,
			position : {
				x : msg.x,
				y : msg.y
			},
			size : {
				width : devWidth,
				height : devHeight
			},
			attrs : {
				text : {
					text : msg.name || "",
					fill : 'black'
				},
				image : {
					'xlink:href' : msg.icon,
					opacity : msg.status == 'offline' ? offlineOpacity : 1,
					width : devWidth,
					height : devHeight
				}
			}
		});
		msg.lab = labId;
		image.oType = 'device';
		image.oMsg = msg;
		if (readOnly) image.attr({'image': { 'pointer-events':'fill'}, 'text':  { 'pointer-events':'none'} }); // Not working
		addObj(image);
		var objModel = paper.findViewByModel(image);
		if (objModel) objModel.$el.hover(function(evt){
			if (config.deviceHoverIn) config.deviceHoverIn(image,evt,objModel);
		}, function(evt) {
			if (config.deviceHoverOut) config.deviceHoverOut(image,evt,objModel);
		})
		sendMsg('addDevice', msg);
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
				rawAddDevice({ id: msg.id, x: x, y: y, icon: icon, type: type, name: text, status: 'offline' });
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

	function rawAddLink(msg) {
		console.log('rawAddLink', arguments);
		
		if (typeof msg.source == 'undefined') msg.source={ name: "" };
		if (typeof msg.target == 'undefined') msg.target={ name: "" };
		if (typeof msg.source.name == 'undefined') msg.source.name="";
		if (typeof msg.target.name == 'undefined') msg.target.name="";
		if (typeof msg.source.id == 'undefined') {
			msg.source.x = msg.source.x||100+parseInt(Math.random()*100);
			msg.source.y = msg.source.y||100+parseInt(Math.random()*100);
		}
		if (typeof msg.target.id == 'undefined') {
			msg.target.x = msg.target.x||100+parseInt(Math.random()*100);
			msg.target.y = msg.target.y||100+parseInt(Math.random()*100);
		}
		if (typeof msg.vertices == 'undefined') msg.vertices=[];
		
		link = new joint.dia.Link({
			id : msg.id,
			source : msg.source,
			target : msg.target,
			vertices : msg.vertices,
			attrs: {
				'.connection': {
					'stroke-width':1.5
				}
			},
			labels : [ {
				position : linkSLabel,
				attrs : {
					text : {
						text : msg.source.name,
						'pointer-events': 'none'
					}
				}
			}, {
				position : linkLabel,
				attrs : {
					text : {
						text : msg.name,
						'font-weight' : 'bold',
						'pointer-events': 'none'
					}
				}
			}, {
				position : linkNLabel,
				attrs : {
					text : {
						text : msg.target.name,
						'pointer-events': 'none'
					}
				}

			} ],
			smooth : true
		});
		
		try {
			if (msg.type=='serial') link.attr({
				'.connection': {
					'stroke-dasharray': 3
				}
			});
		} catch(e) {};
		
		try {
			if (readOnly)
				link.attr({
					'.labels': { 'pointer-events':'none' }, 
					'.link-tools': { 'pointer-events':'none' }, 
					'.marker-source': { 'pointer-events':'none' },
					'.marker-target': { 'pointer-events':'none' },
					'.marker-vertices': { 'pointer-events':'none' },
					'.marker-arrowheads': { 'pointer-events':'none' }, 
					'.connection': { 'pointer-events':'none' }, 
					'.connection-wrap':  { 'pointer-events':'none' }
				});
		} catch(e) {};
		
/*
		link.attr({
		    '.connection': { stroke: 'blue' },
//		    '.marker-source': { fill: 'red', d: 'M 10 0 L 0 5 L 10 10 z' },
//		    '.marker-target': { fill: 'yellow', d: 'M 10 0 L 0 5 L 10 10 z' }
		});
*/
		
		link.oType = 'link';
		link.oMsg = msg;
		msg.lab=labId;
		addObj(link);
		sendMsg('addLink', msg);
		return link;
	}

	function addLink(x, y, type, name, id1, id2) {
		console.log('addLink', arguments);

		Ext.Ajax.request({
			url : '/rest/allocate/linkId',
			success : function(res) {
				var msg = Ext.JSON.decode(res.responseText);
				if (id1 && id2)
					rawAddLink({ id: msg.id, source: { id: id1 }, target: { id: id2 }, type: type, name: name || type });
				else
					rawAddLink({ id: msg.id, source: { x: x, y: y }, target: { x: x+100, y: y}, type: type, name: name || type })
			},
			failure : function() {
				console.error('No Link ID!!!');
			}
		});
	}
	
	var pId = 100000;
	
	function rawAddObject(msg) {
		var obj;

		msg.color = msg.color||'#000000';
		if (typeof msg.opacity=='undefined') msg.opacity = (msg.type=='text'?1:0);
		msg.fill = msg.fill||'#FFFFFF';
		msg.z = msg.z||(msg.type=='text'?-1:-2);
		msg.width = msg.width||100;
		msg.height = msg.height||100;
		msg.fontSize = msg.fontSize||7;
		msg.dashArray = msg.dashArray||0;
		if (typeof msg.round=='undefined') msg.round=2;
		if (typeof msg.strokeWidth=='undefined') msg.strokeWidth=1;

		switch (msg.type) {
			case 'rect':
				obj = new joint.shapes.basic.Rect({
					id: msg.id,
				    position: { x: msg.x, y: msg.y },
				    size: { width: msg.width, height: msg.height },
				    attrs: { rect: { rx: (msg.round/msg.width), ry: (msg.round/msg.height), 'stroke-dasharray': msg.dashArray, fill: msg.fill, 'fill-opacity': msg.opacity, stroke: msg.color, 'stroke-width': msg.strokeWidth, 'pointer-events': readOnly?'none':'fill' }, text: { 'font-size': msg.fontSize, text: msg.text, fill: msg.color, 'pointer-events': readOnly?'none':'fill' } },
				    z: msg.z
				});
				break;
			case 'oval':
				obj = new joint.shapes.basic.Circle({
					id: msg.id,
				    position: { x: msg.x, y: msg.y },
				    size: { width: msg.width, height: msg.height },
				    attrs: { circle: { 'stroke-dasharray': msg.dashArray, fill: msg.fill, 'fill-opacity': msg.opacity, stroke: msg.color, 'stroke-width': msg.strokeWidth, 'pointer-events': readOnly?'none':'fill' }, text: { 'font-size': msg.fontSize, text: msg.text, fill: msg.color, 'pointer-events': readOnly?'none':'fill' } },
				    z: msg.z
				});
				break;
			case 'text':
				obj = new joint.shapes.basic.Text({
					id: msg.id,
				    position: { x: msg.x, y: msg.y },
				    size: { width: msg.width, height: msg.height },
				    attrs: { text: { 'stroke-dasharray': msg.dashArray, opacity: msg.opacity, text: msg.text, fill: msg.color, 'font-size': msg.fontSize, 'pointer-events': readOnly?'none':'fill' } },
				    z: msg.z
				});
				break;
		}

		obj.oMsg = msg;
		obj.oType = 'object';
		msg.lab = labId;
		
		addObj(obj);
		sendMsg('addObject', msg);
		return obj;
	}
	
	function addFigure(type,x,y,text,width,height) {
		console.log('addFigure',arguments);
		
		if (type!='rect' && type!='oval' && type!='text') return;

		Ext.Ajax.request({
			url : '/rest/allocate/objectId',
			success : function(res) {
				var msg = Ext.JSON.decode(res.responseText);
				switch (type) {
					case 'rect':
						rawAddObject({ id: msg.id, type: 'rect', x: x, y: y, width: width, height: height, text: text });
						break;
					case 'oval':
						rawAddObject({ id: msg.id, type: 'oval', x: x, y: y, width: width, height: height, text: text });
						break;
					case 'text':
						rawAddObject({ id: msg.id, type: 'text', x: x, y: y, width: width, height: height, text: text, height: 50 });
						break;
					default:
						break;
				}		
			},
			failure : function() {
				console.error('No object ID!!!');
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
		if (!readOnly) sendMsg('setScale', {
			lab : labId,
			x : sx,
			y : sy
		});
		return paper.scale(sx, sy);
	}

	function setScaleQuiet(sx, sy) { 
		console.log('setScaleQuiet', arguments);
		return paper.scale(sx, sy);
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
		paper.remove();
//		socket.disconnect();
//		socket = null;
//		el.update(''); // Remove the diagram from the ExtJs
	}

	// Create the socket.io interface

	// TODO: Generic suppress socket.io send of events is necessary. I will use suspendEvents for it
	function sockAddDevice(msg) {
		console.log('sockAddDevice', arguments);

		if (msg.lab!=labId) return;

		if (objs[msg.id])
			return sockUpdateDevice(msg); // It exists, so instead we shall do an update

		suspendEvents = true;
		rawAddDevice(msg);
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
		rawAddLink(msg);
		suspendEvents = false;
		if (config && config.sockAddLink)
			config.sockAddLink(msg);
	}
	
	function sockAddObject(msg) {
		console.log('sockAddObject', arguments);

		if (msg.lab!=labId) return;

		if (objs[msg.id])
			return sockUpdateObject(msg); // It exists, so instead we shall do an update

		suspendEvents = true;
		rawAddObject(msg);
		suspendEvents = false;
		if (config && config.sockAddObject)
			config.sockAddObject(msg);
	}

	// TODO: May be width and height should be also maintained by the server?
	function sockUpdateDevice(msg) {
		console.log('sockUpdateDevice', arguments);
		
		if (msg.lab!=labId) return;
		if (!objs[msg.id]) return; // Does not exists, exit

		suspendEvents = true;
		
		var d = objs[msg.id];
		d.oMsg = msg;
		d.forceUpdate=true;

		d.set('position', {
			x : msg.x,
			y : msg.y
		});
		
		d.set('z', msg.z);

		if (msg.status) d.oStatus = msg.status;

		if (msg.icon) {
			try { // The crash we experience is somehow related to set attribute values, even though they work. This way we avoid the mainstream of the program to be blocked
				d.attr({
					text : {
						text : msg.name || ""
					},
					image : {
						'xlink:href' : msg.icon,
						opacity : msg.status == 'offline' ? offlineOpacity : 1
					}
				});
			} catch(e) {
				console.warn('Error in update',e);
			};
		}
		suspendEvents = false;
		if (config && config.sockUpdateDevice)
			config.sockUpdateDevice(msg);
	}
	
	function sockUpdateObject(msg) {
		console.log('sockUpdateObject', arguments);
		
		if (msg.lab!=labId) return;

		if (!objs[msg.id])
			return; // Does not exists, exist

		suspendEvents = true;

		var d = objs[msg.id];
		d.set('size', { width: msg.width, height: msg.height });
		d.set('position', { x: msg.x, y: msg.y });
		d.set('z', msg.z);
		
		switch (msg.type) {
			case 'rect':
				try {
					d.attr({ rect: { rx: (msg.round/msg.width), ry: (msg.round/msg.height), 'stroke-dasharray': msg.dashArray, fill: msg.fill, 'fill-opacity': msg.opacity, 'stroke-width': msg.strokeWidth, stroke: msg.color }, text: { 'font-size': msg.fontSize, text: msg.text, fill: msg.color } });					
				} catch(e) { console.warn('Error in rect update',e); };
				break;
			case 'oval':
				try {
					d.attr({ circle: { 'stroke-dasharray': msg.dashArray, fill: msg.fill, 'fill-opacity': msg.opacity, 'stroke-width': msg.strokeWidth, stroke: msg.color }, text: { 'font-size': msg.fontSize, text: msg.text, fill: msg.color } });					
				} catch(e) { console.warn('Error in oval update',e); };
				break;
			case 'text':
				try {
					d.attr({ text: { 'stroke-dasharray': msg.dashArray, opacity: msg.opacity, text: msg.text, fill: msg.color, 'font-size': msg.fontSize } });					
				} catch(e) { console.warn('Error in text update',e); };
				break;
		}
		
		d.oMsg=msg;
		suspendEvents = false;
		if (config && config.sockUpdateObject)
			config.sockUpdateObject(msg);
	}

	function sockUpdateLink(msg) {
		console.log('sockUpdateLink', arguments);

		if (msg.lab!=labId) return;

		if (!objs[msg.id])
			return; // Does not exists, exist

		suspendEvents = true;

		var d = objs[msg.id];

		if (typeof msg.source == 'undefined') msg.source={ name: "" };
		if (typeof msg.target == 'undefined') msg.target={ name: "" };
		if (typeof msg.source.name == 'undefined') msg.source.name="";
		if (typeof msg.target.name == 'undefined') msg.target.name="";
		if (typeof msg.source.id == 'undefined') {
			msg.source.x = msg.source.x||100+parseInt(Math.random()*100);
			msg.source.y = msg.source.y||100+parseInt(Math.random()*100);
		}
		if (typeof msg.target.id == 'undefined') {
			msg.target.x = msg.target.x||100+parseInt(Math.random()*100);
			msg.target.y = msg.target.y||100+parseInt(Math.random()*100);
		}
		if (typeof msg.vertices == 'undefined') msg.vertices=[];
		
		
		d.set('vertices', msg.vertices);
		d.set('source', msg.source);
		d.set('target', msg.target);
		d.set('z', msg.z);
		
		try {
			d.label(0, {
				position : linkSLabel,
				attrs : {
					text : {
						text : msg.source.name || ""
					}
				}
			});
		} catch(e) { console.warn('error in link label update',e); }
		
		try {
			d.label(1, {
				position : linkLabel,
				attrs : {
					text : {
						text : msg.name || "",
						'font-weight' : 'bold'
					}
				}
			});
		} catch(e) { console.warn('error in link label update',e); }

		try {
			d.label(2, {
				position : linkNLabel,
				attrs : {
					text : {
						text : msg.target.name || ""
					}
				}
			});
		} catch(e) { console.warn('error in link label update',e); }

		d.oMsg=msg;
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
	
	function sockRemoveObject(msg) {
		console.log('sockRemoveObject', arguments);

		if (msg.lab!=labId) return;

		if (!objs[msg.id])
			return; // Does not exists, exist

		suspendEvents = true;
		objs[msg.id].remove();
		delete objs[msg.id];
		suspendEvents = false;
		if (config && config.sockRemoveObject)
			config.sockRemoveObject(msg);
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
		
		if (msg) {
			var garbage = {};
			var k;
			for (k in objs) garbage[k] = objs[k];

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
			if (msg.objects) {
				Ext.Array.each(msg.objects, function(n) {
					sockAddObject(n);
					delete garbage[n.id];
				});
			}
			for (k in garbage)
				sockRemoveDevice({
					lab: labId,
					id : k
				}); // This is how we clean the garbage. Should remove link as well.
			if (msg.scale)
				sockSetScale(msg.scale);
		}

		if (config && config.sockGetAll)
			config.sockGetAll(msg);
	}
	
	function refresh() {
		sendMsg('getAll',{ lab: labId });
	}

	// Set the socket event handlers
	// TODO: Error handling
	socket = io.connect('/labs'); // Join the Labs interface
	socket.on('getAll', sockGetAll);
	socket.on('addDevice', sockAddDevice);
	socket.on('addLink', sockAddLink);
	socket.on('addObject', sockAddObject);
	socket.on('updateDevice', sockUpdateDevice);
	socket.on('updateLink', sockUpdateLink);
	socket.on('updateObject', sockUpdateObject);
	socket.on('removeDevice', sockRemoveDevice);
	socket.on('removeLink', sockRemoveLink);
	socket.on('removeObject', sockRemoveObject);
	socket.on('setScale', sockSetScale);
	console.log('Try to do connect!');
	socket.on('connect', function() { // Implement the Socket Interface
		console.log('Socket connectedm join lab', labId);
//		socket.emit('joinLab', labId); // Join this lab only
//		setTimeout(function() {
//			sendMsg('getAll', { lab: labId });
//		}, 50); // In 50ms do a full refresh
	});

	setTimeout(function() {
		socket.emit('joinLab', labId); // Join this lab only
		sendMsg('getAll', { lab: labId });
	}, 300); // First refresh after one second

	diag.getAllId = setInterval(function() {
		sendMsg('getAll', { lab: labId });
	}, fullRefresh);

	// Add the public methods of that class
	// diag.addObj = addObj;
	diag.addDevice = addDevice;
	diag.addLink = addLink;
	diag.addFigure = addFigure;
	// diag.rawAddDevice = rawAddDevice;
	// diag.rawAddLink = rawAddLink;
	diag.getPaper = getPaper;
	diag.getGraph = getGraph;
	diag.getObjById = getObjById;
	diag.setScale = setScale;
	diag.setScaleQuiet = setScaleQuiet;
	diag.destroy = destroy;
	diag.refresh = refresh;

	return diag;
}

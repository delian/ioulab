/**
 * VNC Socket Bus
 */

var rfb = require('rfb2'), io = require('socket.io'), picha = require('picha'), connect = require('http'), path = require('path'), express = require('express'), clients = [];

function vncSocketBus(sIo, db, emit) {

	function createRfbConnection(config, socket) {
		var r = rfb.createConnection({
			host : "127.0.0.1",
			port : 5900+100+config.id,
			password : ""
		});
		addEventHandlers(r, socket);
		return r;
	}

	function addEventHandlers(r, socket) {
		r.on('connect', function() {
			socket.emit('init', {
				width : r.width,
				height : r.height
			});
			clients.push({
				socket : socket,
				rfb : r
			});
		});
		r.on('rect', function(rect) {
			handleFrame(socket, rect, r);
		});
	}

	function handleFrame(socket, rect, r) {

		console.log('rect', rect);

		switch (rect.encoding) {
			case rfb.encodings.raw:
				var rgb = new Buffer(rect.width * rect.height * 3, 'binary'), offset = 0;

				if (!(rect && rect.data && rect.data.length))
					return;

				for (var i = 0; i < rect.data.length; i += 4) {
					rgb[offset++] = rect.data[i + 2];
					rgb[offset++] = rect.data[i + 1];
					rgb[offset++] = rect.data[i];
				}

				//console.log(r.width,rect.width,r.height,rect.height);
				var image = new picha.Image({
					pixel : 'rgb',
					width : rect.width,
					height : rect.height,
					data : rgb
				});

				var compr = picha.encodePngSync(image);

				socket.emit('frame', {
					x : rect.x,
					y : rect.y,
					width : rect.width,
					height : rect.height,
					image : compr.toString('base64')
				});

				rgb = null;

				break;
			case rfb.encodings.copyRect:
				socket.emit('framecopy', {
					srcx : rect.src.x,
					srcy : rect.src.y,
					dstx : rect.x,
					dsty : rect.y,
					width : rect.width,
					height : rect.height,
				});
				break;
			default:
				console.log('Unknown event', rect);
				break;
		}
	}

	function disconnectClient(socket) {
		clients.forEach(function(pair) {
			if (pair.socket === socket) {
				pair.rfb.end();
			}
		});
		clients = clients.filter(function(pair) {
			return pair.socket === socket;
		});
	}

	var socketio = sIo.of('/vnc');
	socketio.on('connection', function(socket) {
		socket.on('init', function(config) {
			var r = createRfbConnection(config, socket);
			socket.on('mouse', function(evnt) {
				r.pointerEvent(evnt.x, evnt.y, evnt.button);
			});
			socket.on('keyboard', function(evnt) {
				r.keyEvent(evnt.keyCode, evnt.isDown);
			});
			socket.on('refresh', function(evnt) {
				r.requestUpdate(false, 0, 0, r.width, r.height);
			});
			socket.on('disconnect', function() {
				disconnectClient(socket);
			});
		});
	});
}

exports = vncSocketBus;
module.exports = exports;

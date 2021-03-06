/**
 * This is a socket bus used for terminals
 */

var e;


function termSocketBus(sIo,db,emit) {
	e=emit;

	var colDevices = db.collection('devices');

	console.log('Term Socket Bus is started');

	var sLabs = sIo.of('/term');

	// Set the event handling
	e.on('terminalOut',function(msg) {
		// Broadcast message to the terminals
//		console.log('socket Terminal Output',msg);
		sLabs['in'](msg.id).emit('terminalOut',msg);
	});

	e.on('updateDevice',function(msg) {
		console.log('send update device to the terminals');
		sLabs['in'](msg.id).emit('updateTerminal',msg);
	});

	sLabs.on("connection",function(socket){
		console.log('New socket connection for terminal');

		// Set the messaging
		socket.on('disconnect',function() {
			socket.get('currentTerm',function(err,termId){
				console.log('disconnect terminal');
				socket.leave(termId); // Force termId Leaving
			});
		});

		socket.on('quit',function() {
			console.log('Received QUIT terminal message...');
			socket.get('currentTerm',function(err,termId){
				console.log('quitting...');
				socket.leave(termId);
				socket.disconnect(); // Force disconnect
			});
		})

		socket.on('joinTerm',function(r){
			console.log('joinTerm',r);
			socket.set('currentTerm',r,function(){ socket.join(r); });
			colDevices.findOne({ id: parseInt(r) },function(err,q) {
				if (q) socket.emit('updateTerminal',q);
			});
		});

		socket.on('terminalResize',function(msg){
			console.log('socket Terminal Resize',msg);
			socket.get('currentTerm',function(err,termId){
				e.emit('terminalResize',{ id: termId, data: msg });
			});
		});

		socket.on('terminalIn',function(msg){
//			console.log('socket Terminal Input',msg);
			socket.get('currentTerm',function(err,termId){
				e.emit('terminalIn',{ id: termId, data: msg });
			});
		});

		socket.on('terminalConnect',function(msg){
			console.log('socket Terminal Connect',msg);
			socket.get('currentTerm',function(err,termId){
				e.emit('terminalConnect',{ id: termId, data: msg });
			});
		});

	});
}

exports = termSocketBus;
module.exports = exports;

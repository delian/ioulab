/**
 * This is a socket bus used for terminals
 */

var e;


function termSocketBus(sIo,emit) {
	e=emit;
	
	console.log('Term Socket Bus is started');
	
	var sLabs = sIo.of('/term');

	// Set the event handling
	e.on('terminalOut',function(msg) {
		// Broadcast message to the terminals
		console.log('socket Terminal Output',msg);
		sLabs.in(msg.termId).emit('terminalOut',msg);
	})

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
		});

		socket.on('terminalIn',function(msg){
			console.log('socket Terminal Input',msg);
			socket.get('currentTerm',function(err,termId){
				e.emit('terminalIn',{ id: termId, data: msg });
			});
		});
		
		socket.on('terminalConnect',function(msg){
			console.log('socket Terminal Input',msg);
			socket.get('currentTerm',function(err,termId){
				e.emit('terminalConnect',{ id: termId, data: msg });
			});	
		});

	});	
}

exports = termSocketBus;
module.exports = exports;

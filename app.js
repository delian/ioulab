/**
 * Module dependencies.
 * 
 * Implement IOU lab
 * 
 */

var express = require('express'), http = require('http'), path = require('path');

//Read my startup config
require.extensions[".json"] = function(module, filename) { module.exports = JSON.parse(require("fs").readFileSync(filename, "utf8")); };
var config = require('./config.json');

var events = require('events');
var e = new events.EventEmitter(); // the internal event messaging system

var MongoStore = require('connect-mongo')(express);

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());

app.use(express.cookieParser());
app.use(express.session({
        store : new MongoStore({ url : config.mongoUrl }),
        secret : '1234567890QWERTY'
}));

app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) { app.use(express.errorHandler()); }

app.get('/',function(req,res){
	res.redirect('/ui/app.html');
});

// Set the mongoDB connection
var mongoClient = require('mongodb').MongoClient;

var db;
var sIo;
var server = http.createServer(app);
var port = config.serverPort||app.get('port');
var io = require('socket.io');

//Connect to the MongoDB
mongoClient.connect(config.mongoUrl,function(err,mongoDb) {
	if (err) throw err;
	db = mongoDb;

	var iouObj = require('./lib/iouLib')(db,e);
	
	// Load my REST API
	require('./lib/restApi.js')(app,mongoDb,e); // We have all the handlers now. Lets load the REST API

	server.listen(port,function() {
		console.log('Express server is listening on port',port);
		sIo = io.listen(server);
		require('./lib/labSocketBus.js')(sIo,db,e);
	});
});

/*

// My test code -----------------------------------------------------------------------------------------------------------------------------------------------
var iouApi = require('./lib/ioulib.js');
var buff = [];
var socket;

var myIou = iouApi({
	'data' : function(data) {
		console.log('>>>', data);
		buff.push(data);
		if (socket) socket.emit('data',data); else buff.push(data);
	}
});


// Add terminal
var term = require('term.js');
app.use(term.middleware());
var io = require('socket.io');
//

var server = http.createServer(app);
server.listen(port, function() {
	console.log('Express server listening on port',port);	
	// Terminal middleware
	sIo = io.listen(server);
	sIo.sockets.on('connection', function(sock) {
		console.log('connection *********************************************************************************************');
		socket = sock;
		socket.on('data', function(data) {
			console.log('<<<',data);
			myIou.write(data);
		});

		socket.on('disconnect', function() {
			socket = null;
		});

		while (buff.length) {
			socket.emit('data', buff.shift());
		}
		console.log('End connection!');
	});
});
*/
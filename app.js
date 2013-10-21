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

process.on('uncaughtException', function (err) {
	  console.error(err);
//	  console.error(err.stack);
	  console.log("Node NOT Exiting...");
});

//Connect to the MongoDB
mongoClient.connect(config.mongoUrl,function(err,mongoDb) {
	if (err) throw err;
	db = mongoDb;
	
	var iouObj = require('./lib/iouLib')(db,e);
	
	// Load my REST API
	require('./lib/restApi.js')(app,mongoDb,e); // We have all the handlers now. Lets load the REST API

	server.listen(port,function() {
		// console.log('Express server is listening on port',port);
		sIo = io.listen(server, { log: false });
		require('./lib/labSocketBus.js')(sIo,db,e);
		require('./lib/termSocketBus.js')(sIo,db,e);
		require('./lib/vncSocketBus.js')(sIo,db,e);
	});
});

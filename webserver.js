/*  VoiceAssist Web Server
*   Version 0.0.1
*/

var Hapi = require('hapi'),
	server = new Hapi.Server(),
	handlers = require('./libs/route_handlers');

server.connection({
	host: 'localhost',
	port: 8000
});

/*
*  Setup template configuration
*/
server.views({
    engines: { jade: require('jade') },
    path: __dirname + '/views',
    partialsPath: '/views/partials',
    helpersPath: '/views/helpers'
});

/*
*  Configure cookie
*/
server.state('va_cookie', {
	ttl: 1 * 60 * 60 * 1000,  //1 minute  (1*60*60*1000 = 1 hour) 
	isSecure: false,
	isHttpOnly: true,
	path: '/',
	encoding: 'base64json'
})

/*
*  Route for handling main page
*/
server.route({
	method: 'GET',
	path: '/',
	handler: handlers.indexHandler
});

/*
*  Route for handling generic web resources such as JS, CSS and HTML
*/
server.route({
	method: 'GET',
	path: '/{param*}',
	handler: {
		directory: {
			path: 'public',
			index: false
		}
	}
});

/*
*  Route for handling user login and registrations
*/
server.route([
	{ method: ['GET', 'POST'], path: '/login', handler: handlers.loginHandler },
	{ method: 'GET', path: '/logout', handler: handlers.logoutHandler },
	{ method: 'POST', path: '/register', handler: handlers.registerHandler }
]);

/*
*  Account specific routes
*/
server.route([
	{ method: 'GET', path: '/api/v0/account/{id}', handler: handlers.getAccountInformation },
	{ method: ['POST'], path: '/api/v0/account', handler: handlers.createTwilioAccount },
	{ method: ['PUT'], path: '/api/v0/account/{id}', handler: handlers.updateTwilioAccount },
	{ method: 'DELETE', path: '/api/v0/account/{id}', handler: handlers.deleteTwilioAccount }
]);

/*
*  Phone number specific routes
*/
server.route([
	{ method: 'GET', path: '/api/v0/number', handler: handlers.getPhoneNumberList },
	{ method: 'GET', path: '/api/v0/number/{id}', handler: handlers.getPhoneNumberById },
	{ method: 'POST', path: '/api/v0/number', handler: handlers.buyPhoneNumber },
	{ method: 'PUT', path: '/api/v0/number/{id}', handler: handlers.updatePhoneNumber },
	{ method: 'DELETE', path: '/api/v0/number/{id}', handler: handlers.removePhoneNumber }
]);

/*
*  Account IVR routes
*/
server.route([
	{ method: 'GET', path: '/api/v0/ivr/{id}', handler: handlers.getIvr },
	{ method: 'POST', path: '/api/v0/ivr', handler: handlers.createIvr },
	{ method: 'PUT', path: '/api/v0/ivr/{id}', handler: handlers.updateIvr },
	{ method: 'DELETE', path: '/api/v0/ivr/{id}', handler: handlers.deleteIvr }
]);


server.start(function() {
	console.log('Server started!')
});
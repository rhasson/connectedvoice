var twilio = require('twilio');

module.exports = function(cxt, cb) {
	var twiml = new twilio.TwimlResponse();

	console.log('DATA: ', cxt.data)
	
	twiml.say('You will now be joined to my conference');
	twiml.dial({action: cxt.data.actionUrl}, function(node) {
		node.conference('my conf', {eventCallbackUrl: cxt.data.statusUrl});
	});

	cb(null, twiml.toString());
}
var twilio = require('twilio');

module.exports = function(cxt, cb) {
	var twiml = new twilio.TwimlResponse();

	if (cxt.body.Digits == cxt.data.expectedDigit) {
		twiml.say('You will now be joined to my conference');
		twiml.dial({action: cxt.data.actionUrl}, function(node) {
			node.conference('my conf', {eventCallbackUrl: cxt.data.statusUrl});
		});
	} else {
		twiml.say('There was a problem with your request, please try again later');
	}

	cb(null, twiml.toString());
}
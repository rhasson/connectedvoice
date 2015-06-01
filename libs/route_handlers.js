/*
*  Route handlers
*  v0.0.1
*/

var helpers = require('./helper_functions'),
	qs = require('querystring'),
	_ = require('lodash');
//	mock = require('./mock');

module.exports = {
	indexHandler: function(request, reply) {
		reply.view('layout');
	},
	loginHandler: function(request, reply) {
		helpers.isUserLoggedIn(request.state)
		.then(function(id) {
			console.log('Login: has cookie')
			reply(JSON.stringify({status: 0, reason: 'User already signed in', user_id: id}))
				.state('va_cookie', {_id: id});
		})
		.catch(function() {
			var params = request.payload
			if ('email' in params && 'password' in params) {
				helpers.authenticateUser(params.email, params.password)
				.then(function(user) {
					console.log('Auth good')
					reply(JSON.stringify({status: 0, reason: 'User signed in', user_id: user._id}))
						.state('va_cookie', {_id: user._id});
				})
				.catch(function(err) {
					console.log('Auth bad: ', err)
					reply(JSON.stringify({status: 1, reason: 'Invalid email or password'}));
				});


				/*Mock user login*/
//				reply(JSON.stringify({status: 0, reason: 'User signed in', user_id: '11111'}))
//					.state('va_cookie', {_id: '11111'});
			}
		});
	},
	logoutHandler: function(request, reply) {
		helpers.isUserLoggedIn(request.state).then(function(id) {
			reply(JSON.stringify({status: 0, reason: 'User signed out'})).unstate('va_cookie');
		})
		.catch(function() {
			reply.redirect('/');
		})
	}, 
	registerHandler: function(request, reply) {
		reply(JSON.stringify({status: 1, reason: 'Registration failed'}));
		/*
		helpers.registerNewUser(request.payload)
		.then(function(doc) {
			console.log('registerHandler: ', doc)
			reply(JSON.stringify({status: 0, reason: 'Registration completed successfully'}));
		})
		.catch(function(err) {
			console.log('Register failure: ', err);
			reply(JSON.stringify({status: 1, reason: 'Registration failed'}));
		});
		*/
	},
	getAccountInformation: function(request, reply) {
		helpers.isUserLoggedIn(request.state).then(function(id) {
			if ('params' in request && 'id' in request.params) {
				if (id === request.params.id) {
					helpers.getUserAccountInformation(id).then(function(user) {
						reply(JSON.stringify(user));
					});
				} else throw new Error('Account ID does not match session');
			} else throw new Error('Account ID must be provided but none was found');

			/*Mock user account information*/
//			reply(JSON.stringify(mock.user_account_with_number));
		})
		.catch(function(err) {
			reply(JSON.stringify({status: 1, reason: err.toString()}));
		});		
	},
	createTwilioAccount: function(request, reply) {
		var _id;
		helpers.isUserLoggedIn(request.state).then(function(id) {
			_id = id;
			console.log('createTwilioAccount payload: ', request.payload)
			return helpers.twilioCreateAccount(request.payload.account_name)
		})
		.then(function(taccount) {
			console.log('Twilio account: ', taccount)
			return helpers.updateAccount(_id, taccount);
		})
		.then(function(account) {
			console.log('After update: ', account)
			reply(JSON.stringify(account));
		})
		.catch(function(err) {
			console.log('Account error: ', err)
			reply(JSON.stringify({status: 1, reason: err.toString()}));
		});
	},
	updateTwilioAccount: function(request, reply) {
		//TODO
	},
	deleteTwilioAccount: function(request, reply) {
		//TODO
	},
	getPhoneNumberList: function(request, reply) {
		helpers.isUserLoggedIn(request.state).then(function(id) {
			helpers.twilioListPhoneNumbers(request.query).then(function(list) {
				reply(JSON.stringify(list));
			});
		})
		.catch(function(err) {
			console.log('getPhoneNumberList error: ', err);
			reply(JSON.stringify({status: 1, reason: err.toString()}));
		});
	}, 
	getPhoneNumberById: function(request, reply) {
		//TODO
	},
	updatePhoneNumber: function(request, reply) {
		//TODO
	},
	buyPhoneNumber: function(request, reply) {
		var userid, list, numbers;
		var _id;
		console.log(request.payload)
		helpers.isUserLoggedIn(request.state).then(function(id) {
			_id = id;
			return helpers.getUserAccountInformation(id, false);
		})
		.then(function(user) {
			numbers = user.twilio.associated_numbers;
			userid = new Buffer(user._id, 'utf8');
			return helpers.twilioBuyPhoneNumbers(request.payload, userid.toString('base64'), user.twilio.sid);
		})
		.then(function(results) {
			var temp;
			console.log('RESULTS: ', results)
			if (!results) throw new Error('Provisioning phone numbers failed');

			//list = _.isArray(results) ? results : [results];
			numbers.push(results);
			temp = {twilio: {associated_numbers: numbers}};
			return helpers.updateAccount(_id, temp);
		})
		.then(function(doc) {
			var temp = helpers.formatUserRecordPartial(doc, _.pluck(list, 'sid'));
			reply(JSON.stringify(temp));
		})
		.catch(function(err) {
			var msg;
			console.log('buyPhoneNumbers error: ', err);

			if ('status' in err) {
				msg = "Cannot complete your request at this time: "+err.code;
			} else msg = err.toString();
			reply(JSON.stringify({status: 1, reason: msg}));
		});
	}, 
	removePhoneNumber: function(request, reply) {
		var _id, _user;
		helpers.isUserLoggedIn(request.state).then(function(id) {
			_id = id;
			return helpers.getUserAccountInformation(id, false);
		})
		.then(function(user) {
			var tn_sid;
			numbers = user.twilio.associated_numbers;

			return helpers.twilioRemovePhoneNumbers(request.params.id, user.twilio.sid);
		})
		.then(function(results) {
			var temp, nums;
			//if (!results) throw new Error('Removing phone number failed');
			
			//nums = _.reject(numbers, 'sid', request.params.id);
			nums = numbers.filter(function(item) { return item.sid !== _id });
			temp = {twilio: {associated_numbers: nums}};
			console.log('TEMP: ', temp)
			//if (nums.length === 0) temp.twilio.associated_numbers = [];

			return helpers.updateAccount(_id, temp);
		})
		.then(function(doc) {
			reply(JSON.stringify({}));
		})
		.catch(function(err) {
			var msg;
			console.log('removePhoneNumbers error: ', err);

			if ('status' in err) {
				msg = "Cannot complete your request at this time: "+err.code;
			} else msg = err.toString();
			reply(JSON.stringify({status: 1, reason: msg}));
		});
	},
	getIvr: function(request, reply) {

	},
	createIvr: function(request, reply) {
		var _id;

		helpers.isUserLoggedIn(request.state).then(function(id) {
			_id = id;
			return helpers.createIvrRecord(request.payload.ivr, _id);
		})
		.then(function(doc) {
			reply(JSON.stringify(doc));
		})
		.catch(function(err) {
			var msg;
			console.log('getIvr error: ', err);

			if ('status' in err) {
				msg = "Cannot complete your request at this time: "+err.code;
			} else msg = err.toString();
			reply(JSON.stringify({status: 1, reason: msg}));
		});
	},
	updateIvr: function(request, reply) {
		//TODO: update IVR record
	},
	deleteIvr: function(request, reply) {
		//TODO: delete IVR record
	}
}
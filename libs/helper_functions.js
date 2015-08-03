/*
*  Helper functions
*  v0.0.1
*/

var fs = require('fs'),
	crypto = require('crypto'),
	_ = require('lodash'),
	config = require('../config.json'),
	http = request('request'),
	when = require('when'),
	whennode = require('when/node'),
	twilio = require('twilio')(config.twilio.production.account_sid, config.twilio.production.auth_token),
	cloudant = require('cloudant')({
		account: config.cloudant.production.account,
		key: config.cloudant.production.key,
		password: config.cloudant.production.password
	}),
	db = cloudant.use(config.cloudant.production.db_name);

var dbinsert = whennode.lift(db.insert),
	dbsearch = whennode.lift(db.search),
	dbget = whennode.lift(db.get),
	dbfetch = whennode.lift(db.fetch),
	dbremove = whennode.lift(db.destroy);

module.exports = helpers = {
	isUserLoggedIn: function(cookie) {
		//console.log('cookie: ', cookie)
		if (!('va_cookie' in cookie)) return when.reject(new Error('User is not logged in'));
		else {
			return when.resolve(cookie.va_cookie._id);
		}
	}, 
	getUserAccountInformation: function(id, formatted) {
		if (formatted === undefined) formatted = true;
		return dbget(id).then(function(doc) {
			var user;
			var body = doc.shift();
			var ivr_ids = _.pluck(body.twilio.associated_numbers, 'ivr_id');
			
			if (formatted) user = helpers.formatUserRecord(body);
			else user = helpers.cleanUserRecord(body);

			if (_.isArray(ivr_ids) && ivr_ids.length) {
				return helpers.getIvrRecord(id).then(function(ivr) {
					user.ivr = ivr;
					return when.resolve(user)
				});
			} else return when.resolve(user);
		});
	},
	authenticateUser: function(email, pass) {
		console.log('Authenticating: ', email, ' : ', pass);
		return dbsearch('searchByEmail', 'searchByEmail', {q: 'email:'+email})
		.then(function(results) {
			var body = results.shift();
			var headers = results.shift();
		
		if (headers['status-code'] !== 200) return when.reject(new Error('Login DB Search returned error - '+headers['status-code']));
			//found user that is attempting to login
			if (body && body.rows.length === 1) {
				return dbget(body.rows[0].id);
			}
		}).then(function(doc) {
			var body, headers, p1, temp, sha, buf, digest;

			if (!doc) return when.reject(new Error('Invalid email or password'));
			
			body = doc.shift();
			headers = doc.shift();
			if (email === body.email) {
				storedpass = new Buffer(body.password, 'base64');
				attemptedpass = new Buffer(pass, 'base64');
				salt = new Buffer(body.salt, 'base64');
				temp = Buffer.concat([attemptedpass, salt]);
				sha = crypto.createHash('sha512');
				sha.update(temp);
				digest = sha.digest('base64');

				p1 = storedpass.toString('base64');

				if (p1 === digest) {
					body = helpers.cleanUserRecord(body);
					return when.resolve(body);
				} else {
					return when.reject(new Error('Invalide email or password'));
				}
			}
		});
	},
	registerNewUser: function(params) {
		console.log('registering: ', params);
		return dbsearch('searchByEmail', 'searchByEmail', {q: 'email:'+params.email})
		.then(function(results) {
			var body = results.shift();
			var headers = results.shift();
			var pass, salt, temp, sha, buf;

			//console.log('BODY: ', body);
			if (headers['status-code'] !== 200) return when.reject(new Error('Register DB Search returned error - '+headers['status-code']));

			//user already registered, use doc.id to get the user record
			if (body && body.rows.length === 1) {
				//console.log('ROW: ', body.rows[0])
				return dbget(body.rows[0].id);
			}
			//this is a new user so create a new doc in the db
			else {
				pass = new Buffer(params.password, 'base64');
				salt = crypto.randomBytes(512);
				temp = Buffer.concat([pass, salt]);
				sha = crypto.createHash('sha512');
				buf;

				sha.update(temp);
				buf = sha.digest('base64')
				params.password = buf;
				params.salt = salt.toString('base64');
				params.type = 'user';

				return dbinsert(params);
			}
		})
		.then(function(doc) {
			console.log('second then: ', doc)
			var body = doc.shift();
			var headers = doc.shift();

			//returned promise after db insert action.  This is a new user that has just been registered
			if (!('ok' in body) && ('_id' in body) && ('_rev' in body)) {
				body = helpers.cleanUserRecord(body);
				return when.resolve({newuser: true, body: body});
			}
			//return promise after db search action for an existing user who attempted to register the same email again
			else return dbget(body.id).then(function(data){
				var d = data.shift();
				d = helpers.cleanUserRecord(d);
				return when.resolve({newuser: false, body: d});
			});
		})
		.catch(function(err) {
			console.log('dbsearch error: ', err);
		});
	},
	updateAccount: function(id, data, removing) {
		return dbget(id).then(function(doc) {
			var body;
			if (!doc) return when.reject(new Error('Failed to retrieve acocount information'));

			body = doc.shift();
			delete body._id;
			body.date_updated = new Date().toUTCString();
			_.merge(body, data)/*, function(a, b) {
				if (_.isArray(a)) {
					if (!removing) return a.concat(b);
					else return b;
				}
			});*/
			console.log('updateAccount: ', body)
			return dbinsert(body, id).then(function(acct) {
 				return dbget(id).then(function(resp){
					var d = resp.shift();
					d = helpers.cleanUserRecord(d);
					return when.resolve(d);
				});
			});
		});
	},
	twilioCreateAccount: function(account_name) {
		return twilio.accounts.create({friendlyName: account_name}).then(function(account) {
			var acc = {twilio:{}};

			acc.twilio.sid = account.sid;
			acc.twilio.auth_token = account.auth_token;
			acc.twilio.friendly_name = account.friendly_name;
			acc.twilio.status = account.status;
			acc.twilio.date_created = account.date_created;
			acc.twilio.date_updated = account.date_updated;

			return when.resolve(acc);
		});
	},
	twilioListPhoneNumbers: function(params) {
		var filter = {};
		var list;
		var count = 5;

		if (params.areacode) filter['areaCode'] = params.areacode;
		else if (params.state) filter['inRegion'] = params.state;

		if (params.local_attr === 'true' && params.tollfree_attr === 'true') {
			return twilio.availablePhoneNumbers('US').local.list(filter).then(function(data) {
				list = data.available_phone_numbers.map(function(item) {
					return _.pick(item, 'friendly_name', 'phone_number', 'region', 'postal_code', 'address_requirements', 'capabilities');
				});
				list = list.slice(0, count);

				return twilio.availablePhoneNumbers('US').tollFree.list().then(function(tdata) {
					console.log(tdata)
					var tlist = tdata.available_phone_numbers.map(function(item) {
						return _.pick(item, 'friendly_name', 'phone_number', 'region', 'postal_code', 'address_requirements', 'capabilities');
					});
					tlist = tlist.slice(0, count);

					return when.resolve(list.concat(tlist));
				});
			});
		} else if (params.local_attr === 'true') {
			return twilio.availablePhoneNumbers('US').local.list(filter).then(function(data) {
				var list = data.available_phone_numbers.map(function(item) {
					return _.pick(item, 'friendly_name', 'phone_number', 'region', 'postal_code', 'address_requirements', 'capabilities');
				});
				list = list.slice(0, count);
				return when.resolve(list);
			});
		} else if (params.tollfree_attr === 'true') {
			if ('state' in filter) delete filter.state;
			return twilio.availablePhoneNumbers('US').tollFree.list(filter).then(function(data) {
				var list = data.available_phone_numbers.map(function(item) {
					return _.pick(item, 'friendly_name', 'phone_number', 'region', 'postal_code', 'address_requirements', 'capabilities');
				});
				list = list.slice(0,count);

				return when.resolve(list);
			});
		} else return when.resolve([]);
	},
	twilioBuyPhoneNumbers: function(tns, userid, account_sid) {
		var settled;
		var promises;
		var params = {
			VoiceUrl: config.callbacks.VoiceUrl.replace('%userid', userid),
			VoiceFallbackUrl: config.callbacks.VoiceFallbackUrl.replace('%userid', userid),
			StatusCallback: config.callbacks.StatusCallback.replace('%userid', userid),
			VoiceCallerIdLookup: config.callbacks.VoiceCallerIdLookup.replace('%userid', userid),
			SmsUrl: config.callbacks.SmsUrl.replace('%userid', userid),
			SmsFallbackUrl: config.callbacks.SmsFallbackUrl.replace('%userid', userid)
		};

		if (Object.keys(tns).length < 0) return when.reject(new Error('Nothing to buy'));
		
		promises = Object.keys(tns).map(function(tn) {
			params.phoneNumber = tn;
			
			if (tns[tn] === 'local') {
				return twilio.accounts(account_sid).incomingPhoneNumbers.create(params);
			} else {
				return twilio.accounts(account_sid).incomingPhoneNumbers.tollFree.create(params);
			}
		});

		return when.all(promises);

/* Mock response to phone number provisioning
		var testResp = { }
		var promises = [when(testResp)];

*/
	},
	twilioRemovePhoneNumbers: function(tn_sid, account_sid) {
		return twilio.accounts(account_sid).incomingPhoneNumbers(tn_sid).delete();
	},
	updatePhoneNumber: function(id, params) {
		//
	},
	getIvrRecord: function(ids) {
//				ivr_ids = _.pluck(record.number, 'ivr_id');
		if (_.isArray(ids) && ids.length) {
			return dbfetch({keys:ids}).then(function(ivrs) {
				var record;
				var body = ivrs.shift();
				var results = _.pluck(body.rows, 'doc');

				record = helpers.formatIvrRecord(results.filter(function(i) { return i !== undefined }));
				return when.resolve(record);
			});
		} else if (typeof ids === 'string') {
			return dbsearch('searchIvr', 'searchIvr', {q: 'account_id:'+ids, include_docs: true})
			.then(function(response) {
				var results;
				var body = response.shift();
				var headers = response.shift();
				
				if (headers['status-code'] !== 200) return when.reject(new Error('IVR DB Search returned error - '+headers['status-code']));

				if (body && body.rows.length > 0) {
					results = _.pluck(body.rows, 'doc');
					record = helpers.formatIvrRecord(results.filter(function(i) { return i !== undefined }));
					return when.resolve(record);
				}
			})
			.catch(function(err) {
				return when.reject(new Error('IVR DB Search failed - ' + err.message));
			});
		} 
		return when.reject(new Error('Expecting an array with ids or a string with an account id but didnt get that'));
	},
	createIvrRecord: function(params, userid) {
		var ivr_doc;
		var account;
		var record;
		var ivr;
		//doc with new _id and _rev for the ivr record created
		//update the associated_numbers array inside the account to include an ivr_id with the new _id
		if ('account_id' in params && params.account_id === userid /*&& 'number_id' in params*/) {

			params.type = 'ivr';

			ivr = helpers.createWebtask(params, userid);  //checks if webtask is used as an action and creates a webtask token

			return dbinsert(params).then(function(doc) {
				ivr_doc = doc.shift();

				return dbget(ivr_doc.id).then(function(d) {
					var body = d.shift();
					var record = helpers.formatIvrRecord([body]);

					return when.resolve({ivr: record});
				});
			});
		} else return when.reject(new Error('Did not provide account or number IDs with request'));
	},
	updateIvrRecord: function(ivr, ivr_id, userid) {
		if ('account_id' in ivr && ivr.account_id === userid) {
			return dbget(ivr_id).then(function(doc) {
				var body = doc.shift();
				var headers = doc.shift();
				var newdoc;

				delete body._id;
				newdoc = _.merge(body, ivr);
				return dbinsert(newdoc, ivr_id).then(function() {
					return dbget(ivr_id).then(function(d) {
						var body = d.shift();
						var record = helpers.formatIvrRecord([body]);

						return when.resolve({ivr: record});
					});
				}).catch(function(err) {
					return when.reject(new Error(err.toString()));
				})
			});
		} else {
			return when.reject(new Error('Account ID was not found in the request'));
		}
	},
	deleteIvrRecord: function(ivr_id, userid) {
		return dbget(ivr_id).then(function(doc) {
			var body = doc.shift();
			return dbremove(body._id, body._rev).then(function(doc) {
				var body = doc.shift();
				if (body.ok === true) return when.resolve({});
				else when.reject(new Error('Failed to delete IVR record'));
			})			
		})
		.catch(function(err) {
			return when.reject(new Error(err.toString()));
		});
	},
	createWebtask: function(ivr, userid) {
		var post = whennode.lift(http.post);
		var _id = new Buffer(userid, 'utf8').toString('base64');

		function extractTasks(arr) {
			var tasks = [];
			var child;
			for (var i=0; i < arr.length; i++) {
				if (arr[i].verb === 'webtask') tasks.push({index: arr[i].index, url: arr[i].nouns.text});
				else if (arr[i].verb === 'gather') {
					scan(arr[i].nested)
				}
			}

			function scan(nested) {
				for (var j=0; j < nested.length; j++) {
					child = _.find(nested[j].actions, 'verb', 'webtask')
					if (child) tasks.push({index: child.index, url: child.nouns.text})
				}
			};

			return when.resolve(tasks);
		}


		function createTask(arr) {
			return when.map(arr, function(item) {
				return post(config.webtask.issueToken + '?key=' + config.webtask.key,
					{
						pb: 1,
						pctx: {
							statusUrl: config.callbacks.StatusCallback.replace('%userid', _id);
							actionUrl: config.callbacks.ActionUrl.replace('%userid', _id);
						}
						url: item.url
					}
			 	).then(function(data) { return {index: item.index, url: item.url, body: data.pop()} } );
			});
		}

		function updateTasks(actions, data) {
			var index = -1;
			var item;

			for (var i=0; i < data.length; i++) {
				for (var x=0; x < actions.length; x++) {
					//console.log('x: ', x, ' - ', actions[x])
					if (actions[x].index === data[i].index) actions[x].webtask_url = data[i].body
					if (actions[x].verb === 'gather') {
						console.log('INSIDE GATHER')
						for (var j=0; j < actions[x].nested.length; j++) {
							console.log('j: ', j, ' - ', actions[x].nested[j])
							if (actions[x].nested[j].actions[0].index === data[i].index) actions[x].nested[j].actions[0].webtask_url = data[i].body
						}
					}
				};
			}
			return when.resolve(actions);
		}

		return extractTasks(ivr.actions).then(function(resp) {
			return createTask(resp);
		}).then(function(tasks) {
			console.log(tasks)
			return updateTasks(ivr.actions, tasks);
		}).then(function(actions) {
			//saveToDB()
		});

	},
	updateWebtask: function(url, token, params){
		//revoke old token
		//create new token
	},
	combinePromiseResponses: function(tns, results) {
		Object.keys(tns).map(function(tn, i) {
			body = (results[i].state === 'rejected') ? results[i].reason : results[i].value;

			return {
				phone_number: tn,
				body: body
			}
		});
	},
	cleanUserRecord: function(doc) {
		delete doc.password;
		delete doc.salt;

		return doc;
	},
	formatIvrRecord: function(list) {
		return _.uniq(list, '_id').map(function(item) {
			return {
				id: item._id,
				account_id: item.account_id,
				ivr_name: item.ivr_name,
				actions: item.actions,
				date_updated: item.date_updated
			}
		});
	},
	formatUserRecord: function(doc) {
		var newdoc;
		var numbers = [];
		if ('password' in doc) delete doc.password;
		if ('salt' in doc) delete doc.salt;

		if ('twilio' in doc && 'associated_numbers' in doc.twilio && doc.twilio.associated_numbers !== null) {
			numbers = doc.twilio.associated_numbers.map(function(item) {
				var ret = {
						id: item.sid,
						account_id: doc._id,
						account_sid: item.account_sid,
						friendly_name: item.friendly_name,
						phone_number: item.phone_number,
						capabilities: item.capabilities
					}
				if ('ivr_id' in item) ret.ivr_id = item.ivr_id;
				return ret;
			});
		}

		newdoc = {
			account: {
				id: doc._id,
				first_name: doc.firstname,
				last_name: doc.lastname,
				company: doc.company,
				date_updated: doc.date_updated,
				twilio: {
					id: doc.twilio.sid,
					friendly_name: doc.twilio.friendly_name,
					status: doc.twilio.status,
					date_created: doc.twilio.date_created,
					date_updated: doc.twilio.date_updated
				},
				numbers: _.pluck(numbers, 'id')
			},
			number: numbers
		}

		return newdoc;
	},
	formatUserRecordPartial: function(doc, new_item_ids) {
		var newdoc;
		var numbers = [];
		if ('password' in doc) delete doc.password;
		if ('salt' in doc) delete doc.salt;
//extract only the newly added numbers and add them to a slimed down user account record

		if ('twilio' in doc && 'associated_numbers' in doc.twilio && doc.twilio.associated_numbers !== null) {
			numbers = doc.twilio.associated_numbers.filter(function(item) {
				return (new_item_ids.indexOf(item.sid) > -1)
			}).map(function(item) {
				var ret = {
					id: item.sid,
					account_id: doc._id,
					account_sid: item.account_sid,
					friendly_name: item.friendly_name,
					phone_number: item.phone_number,
					capabilities: item.capabilities
				}
				if ('ivr_id' in item) ret.ivr_id = item.ivr_id;
				return ret;
			});
		}

		newdoc = {
			account: {
				id: doc._id,
				date_updated: doc.date_updated,
				twilio: {
					id: doc.twilio.sid,
				},
				numbers: _.pluck(numbers, 'id')
			},
			numbers: numbers
		}

		return newdoc;
	}
}

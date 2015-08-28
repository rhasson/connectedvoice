/*
*  Helper functions
*  v0.0.1
*/

var fs = require('fs'),
	crypto = require('crypto'),
	_ = require('lodash'),
	config = require('../config.json'),
	request = require('request'),
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
	dbremove = whennode.lift(db.destroy),
	http = whennode.lift(request);

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
		//doc with new _id and _rev for the ivr record created
		//update the associated_numbers array inside the account to include an ivr_id with the new _id
		if ('account_id' in params && params.account_id === userid /*&& 'number_id' in params*/) {

			params.type = 'ivr';

			//checks if webtask is used as an action and creates a webtask token
			return helpers.createWebtask(params, userid).then(function(ivr) {
				return dbinsert(ivr).then(function(doc) {
					var ivr_doc = doc.shift();

					return dbget(ivr_doc.id).then(function(d) {
						var body = d.shift();
						var record = helpers.formatIvrRecord([body]);

						return when.resolve({ivr: record});
					});
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

				return helpers.updateWebtask(ivr, body, userid).then(function(new_ivr) {
					new_ivr.type = body.type;
					new_ivr._rev = body._rev;

					return dbinsert(new_ivr, ivr_id).then(function() {
						return dbget(ivr_id).then(function(d) {
							var body = d.shift();
							var record = helpers.formatIvrRecord([body]);
							return when.resolve({ivr: record});
						});
					}).catch(function(err) {
						return when.reject(new Error(err.toString()));
					});
				});
			});
		} else {
			return when.reject(new Error('Account ID was not found in the request'));
		}
	},
	deleteIvrRecord: function(ivr_id, userid) {
		return dbget(ivr_id).then(function(doc) {
			var orig_doc = doc.shift();
			return dbremove(orig_doc._id, orig_doc._rev).then(function(doc) {
				var body = doc.shift();
				if (body.ok === true) {
					//NOTE: may result in memory leak if the revoke api hangs
					helpers.extractWebtaskTasks(orig_doc).then(function(tasks) {
						helpers.revokeWebtaskTokens(tasks).catch(function(err) {
							console.log('Failed to revoke webtask token - ', err);
						});
					});
					return when.resolve({});
				} else return when.reject(new Error('Failed to delete IVR record'));
			})			
		})
		.catch(function(err) {
			return when.reject(new Error(err.toString()));
		});
	},
	createWebtask: function(ivr, userid) {
		var _id = new Buffer(userid, 'utf8').toString('base64');

		return helpers.extractWebtaskTasks(ivr.actions).then(function(resp) {
			return helpers.createWebtaskTask(resp, _id);
		}).then(function(tasks) {
			console.log(tasks)
			return helpers.updateWebtasksInIvr(ivr, tasks);
		});
	},
	updateWebtask: function(new_ivr, current_ivr, userid){
		var _id = new Buffer(userid, 'utf8').toString('base64');

		return when.map([new_ivr.actions, current_ivr.actions], helpers.extractWebtaskTasks).then(function(data) {
			var new_arr, current_arr;
			var toBeRevoked = [];
			var toBeIssued = [];

			new_arr = data.shift();
			current_arr = data.shift();

			for (var i=0, temp; i < new_arr.length; i++) {
				temp = _.find(current_arr, {url: new_arr[i].url});
				if (temp && temp.webtask_token) toBeRevoked.push(temp.webtask_token);
				toBeIssued.push(new_arr[i]);
			}

			//if the new ivr has no webtasks but the old ivr does, revoke the old tokens
			if (new_arr.length === 0) {
				for (var i=0; i < current_arr.length; i++) {
					toBeRevoked.push(current_arr[i].webtask_token);
				}
			}

		console.log('REVOKED: ', toBeRevoked)
		console.log('ISSUED: ', toBeIssued)

			return helpers.createWebtaskTask(toBeIssued, _id).then(function(tasks) {
				//console.log("TASKS: ", tasks)
				helpers.revokeWebtaskTokens(toBeRevoked).catch(function(err) {
					console.log('Failed to revoke webtask token - ', err);
				});
				return helpers.updateWebtasksInIvr(new_ivr, tasks);
			})

		});
	},
	revokeWebtaskTokens: function(tokens) {
		if (tokens && typeof tokens === 'string') tokens = [tokens];
		if (tokens &&  tokens instanceof Array) return when.map(tokens, revokeToken);
		else return when.resolve();
		
		function revokeToken(token) {
			return http({
				url: config.webtask.revokeToken + '?key=' + config.webtask.key,
				method: 'POST',
				json: true,
				body: {
					ten: config.webtask.container,
					token: token
				}
			}).then(function(resp) {
				var headers = resp.shift();
				if (headers.statusCode === 200) {
					return when.resolve({});
				} else return when.reject(new Error(headers.statusMessage));
			}).catch(function(err) {
				return when.reject(new Error(err));
			});
		}
	},
	createWebtaskTask: function(arr, userid) {

		/*		
		return when.resolve([ { index: arr[0].index,
		    url: 'https://raw.githubusercontent.com/rhasson/connectedvoice/master/webtasks/conference.js',
		    webtask_token: 'eyJhbGciOiJIUzI1NiIsImtpZCI6IjIifQ.eyJqdGkiOiJmODk3YzM0YmE0ZmE0M2ZhODhiODZiOGRjMDQyNjFiYSIsImlhdCI6MTQzODcwMjcyNSwiY2EiOlsiN2JhOThjNDk2NTU1NDE2M2FkM2ExMzY5OGFkZDQ3NmYiXSwiZGQiOjAsInVybCI6Imh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9yaGFzc29uL2Nvbm5lY3RlZHZvaWNlL21hc3Rlci93ZWJ0YXNrcy9jb25mZXJlbmNlLmpzIiwidGVuIjoid3Qtcmhhc3Nvbi1nbWFpbF9jb20tMCIsInBjdHgiOnsic3RhdHVzVXJsIjoiaHR0cDovL2Nvbm5lY3RlZHZvaWNlLmlvL2FjdGlvbnMvdjAvTWpJMk9EQTBOVFZoTXpRMU56RXhaRE00T0RWak1HUmlPV0l4TWpBek4yUT0vc3RhdHVzIiwiYWN0aW9uVXJsIjoiaHR0cDovL2Nvbm5lY3RlZHZvaWNlLmlvL2FjdGlvbnMvdjAvTWpJMk9EQTBOVFZoTXpRMU56RXhaRE00T0RWak1HUmlPV0l4TWpBek4yUT0vYWN0aW9uIn0sInBiIjoxfQ.Y3FMzi_hoMy9GX2yFAFxcNUWGsWUdYbVxBHNPW47J58' } ])
		*/
		
		return when.map(arr, function(item) {
			return http({
				url: config.webtask.issueToken + '?key=' + config.webtask.key,
				method: 'POST',
				json: true,
				body: {
					ten: config.webtask.container,
					pb: 1,
					pctx: {
						statusUrl: config.callbacks.StatusCallback.replace('%userid', userid),
						actionUrl: config.callbacks.ActionUrl.replace('%userid', userid)
					},
					url: item.url
				}
			}).then(function(resp) {
				var headers = resp.shift();
				var body = resp.shift();
				if (headers.statusCode === 200) {
					item.webtask_token = body;
				} else item.webtask_token = undefined;
				return item;
			});
		});
	},
	extractWebtaskTasks: function(arr) {
		var tasks = [];
		var child;

		//console.log('EXTRACT ARR: ', arr)
		for (var i=0; i < arr.length; i++) {
			if (arr[i].verb === 'webtask') tasks.push({index: arr[i].index, url: arr[i].nouns.text, webtask_token: arr[i].webtask_token ? arr[i].webtask_token : undefined});
			else if (arr[i].verb === 'gather' && 'nested' in arr[i]) {
				scan(arr[i].nested)
			}
		}

		function scan(nested) {
			for (var j=0; j < nested.length; j++) {
				child = _.find(nested[j].actions, 'verb', 'webtask')
				//console.log('EXTRACT - CHILD: ', child)
				if (child) tasks.push({index: child.index, url: child.nouns.text, webtask_token: child.webtask_token ? child.webtask_token : undefined})
			}
		};

		return when.resolve(tasks);
	},
	updateWebtasksInIvr: function(ivr, tasks) {
		var index = -1;
		var item;

		for (var i=0; i < tasks.length; i++) {
			for (var x=0; x < ivr.actions.length; x++) {
				if (ivr.actions[x].index === tasks[i].index) ivr.actions[x].webtask_token = tasks[i].webtask_token
				if (ivr.actions[x].verb === 'gather') {
					for (var j=0; j < ivr.actions[x].nested.length; j++) {
						//console.log('inner loop: ', ivr.actions[x].nested[j].actions[0].index, ' - ', tasks[i])
						if (ivr.actions[x].nested[j].actions[0].index === tasks[i].index) {
							//console.log('inside if: ', tasks[i].webtask_token)
							ivr.actions[x].nested[j].actions[0].webtask_token = tasks[i].webtask_token
							//console.log('inside if - after: ', ivr.actions[x].nested[j].actions[0])
						}
					};
				}
			};
		}


		//console.log('UPDATE - IVR: ', ivr.actions[1].nested[0].actions)
		//console.log('UPDATE - tasks: ', tasks)

		return when.resolve(ivr);
	},
	getCallStatusById: function(userid) {
		return dbsearch('callByType', 'callByType', {
			q: 'type:"call_status" AND id:"' + userid + '"',
			counts: '["from"]',
			limit: 10
		}).then(function(doc) {
			var body = doc.shift();
			var headers = doc.shift();
			var data = helpers.convertDocToChartData(body);
			
			return when.resolve({CallStats: [{
				contents: data,
				id: body.bookmark
			}]});
		});
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
	},
	convertDocToChartData: function(body) {
		var colors;
		var count = -1;

		if (!('counts' in body) || body.rows.length === 0) return contents;

		colors = helpers.getRandomColor(Object.keys(body.counts.from).length);

		ret = _.map(body.counts.from, function(value, key) {
			++count;
			return {
				value: value,
				color: colors[count],
				highlight: colors[count],
				label: key
			}
		});

		return ret;
	},
	getRandomColor: function(count) {
		var Colors = {};
		Colors.names = {
		    //aqua: "#00ffff",
		    //azure: "#f0ffff",
		    //beige: "#f5f5dc",
		    black: "#000000",
		    blue: "#0000ff",
		    brown: "#a52a2a",
		    cyan: "#00ffff",
		    darkblue: "#00008b",
		    darkcyan: "#008b8b",
		    darkgrey: "#a9a9a9",
		    darkgreen: "#006400",
		    darkkhaki: "#bdb76b",
		    darkmagenta: "#8b008b",
		    darkolivegreen: "#556b2f",
		    darkorange: "#ff8c00",
		    darkorchid: "#9932cc",
		    darkred: "#8b0000",
		    darksalmon: "#e9967a",
		    darkviolet: "#9400d3",
		    fuchsia: "#ff00ff",
		    gold: "#ffd700",
		    green: "#008000",
		    indigo: "#4b0082",
		    khaki: "#f0e68c",
		    lightblue: "#add8e6",
		    lightcyan: "#e0ffff",
		    lightgreen: "#90ee90",
		    lightgrey: "#d3d3d3",
		    lightpink: "#ffb6c1",
		    lightyellow: "#ffffe0",
		    lime: "#00ff00",
		    magenta: "#ff00ff",
		    maroon: "#800000",
		    navy: "#000080",
		    olive: "#808000",
		    orange: "#ffa500",
		    pink: "#ffc0cb",
		    purple: "#800080",
		    violet: "#800080",
		    red: "#ff0000",
		    silver: "#c0c0c0",
		    white: "#ffffff",
		    yellow: "#ffff00"
		};
		Colors.getRandom = function() {
			var result;
			var count = 0;
			for (var i in this.names) {
				if (Math.random() < 1/++count) result = i;
			}
			return this.names[result];
		}

		Colors.getByCount = function(count) {
			return _.take(_.values(this.names), count);
		}

		if (count) return Colors.getByCount(count);
		else return Colors.getRandom();
	}
}

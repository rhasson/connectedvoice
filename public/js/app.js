//Main Emberjs App file

App = Ember.Application.create();
App._verimail = new Comfirm.AlphaMail.Verimail();

/********************** MODEL DEFINITION **********************************/
App.ApplicationAdapter = DS.RESTAdapter.extend({
	namespace: 'api/v0',
	pathForType: function(type) {
		return Ember.String.underscore(type);
	}
});

App.Account = DS.Model.extend({
	first_name: DS.attr('string'),
	last_name: DS.attr('string'),
	company: DS.attr('string'),
	twilio: DS.attr(),
	numbers: DS.hasMany('number', { embedded: 'always' })
});

App.Number = DS.Model.extend({
	account_id: DS.belongsTo('account'),  //maps to the 'id' key/value pair in the account model
	account_sid: DS.attr('string'),
	friendly_name: DS.attr('string'),
	phone_number: DS.attr('string'),
	capabilities: DS.attr(),
	ivr_id: DS.belongsTo('ivr')
});

App.Ivr = DS.Model.extend({
	number_id: DS.belongsTo('number'),
	account_id: DS.belongsTo('account'),
	date_updated: DS.attr('date'),
	actions: DS.attr()
});

App.Status = DS.Model.extend({
	status: DS.attr('number'),
	reason: DS.attr('text')
});
/*********************************************************************/

/* Application router definition */
App.Router.map(function() {
	this.resource('register');
	this.resource('home', function() {
		this.resource('account', {path: '/account/:account_id'}, function() {
			this.route('index', {path: '/'});
			this.route('create');
			this.route('edit');
		});
		this.resource('numbers', {path: '/numbers/:account_id'}, function() {
			this.route('index', {path: '/'});
			this.route('create');
			this.route('edit', {path: '/numbers/:account_id/:number_id'});
			this.route('remove', {path: '/numbers/:account_id/:number_id'});
		});
		this.resource('ivr', {path: '/ivr/:account_id'}, function() {
			this.route('index', {path: '/'});
			this.route('create');
			this.route('edit', {path: '/ivr/:account_id/:ivr_id'});
			this.route('remove', {path: '/ivr/:account_id/:ivr_id'});
		});
	});
});

/* Application Index definition */

//Application Index Controller
//primarily used for the registration form

App.IndexController = Ember.Controller.extend({
	needs: ['session'],
	isLoggedIn: Ember.computed.alias('controllers.session.isLoggedIn'),
	init: function() {
		if (this.get("controllers.session").isSessionPresent()) this.transitionToRoute('home');
		else this.transitionToRoute('/');
	},
	actions: {
		toggleRegister: function() {
			$("#registerbox").toggleClass("hidden");
		}
	}
});
/*********************************************************************/

/* Application session manager */
App.SessionController = Ember.Controller.extend({
	vaSession_MemoryStore: undefined,
	isLoggedIn: Ember.computed('vaSession_MemoryStore', function() {
		return this.isSessionPresent();
	}),
	saveSession: function(id) {
		if ('localStorage' in window) {
			window.localStorage.setItem('va_session', id);
		} else {
			this.set('vaSession_MemoryStore', id);
			console.log('Session storage is limited.  No localStorage found');
		}
		this.set('isLoggedIn', this.isSessionPresent());
	},
	getSession: function() {
		if ('localStorage' in window) {
			return window.localStorage.getItem('va_session');
		} else {
			return this.get('vaSession_MemoryStore');
		}
	},
	clearSession: function() {
		if ('localStorage' in window) {
			window.localStorage.removeItem('va_session');
		} else {
			this.set('vaSession_MemoryStore', undefined);
		}
		this.set('isLoggedIn', this.isSessionPresent());
	},
	isSessionPresent: function() {
		return this.getSession() ? true : false;
	}
});
/*********************************************************************/

/* Application default behavior definition */

//Application default controller
//primarily used for handling login and logout
App.ApplicationController = Ember.Controller.extend({
	needs: ['session'],
	notify_message: "",
	isLoggedIn: Ember.computed.alias('controllers.session.isLoggedIn'),
	actions: {
		redirectOnLogin: function(id) {
			this.get("controllers.session").saveSession(id);
			this.transitionToRoute('home');
		},
		redirectOnLogout: function() {
			this.get("controllers.session").clearSession();
			this.transitionToRoute('/');
		},
		notifyMessage: function(msg) {
			this.set('notify_message', msg);
			toggleMessageSlide();
		}
	},
});

//Login & logout component definition
App.LogInComponent = Ember.Component.extend({
	actions: {
		loginAction: function() {
			var self = this;
			var data = {};
			var temp = $("#login_password");
			var valid = validateLoginForm();

			if (valid.status === 0) {
				data.email = $("#login_email").val();
				data.password = CryptoJS.SHA512(temp.val()).toString(CryptoJS.enc.Base64);
				$.post('/login', data, function(d, status, xhr) {
					console.log('Login: ', d, status)
					if (d && d.status === 0) {
						resetLoginForm();
						self.sendAction('loginAction', d.user_id, true);
					} else {
						self.sendAction('notifyMessage', d.reason);
					}
				}, 'json');
			} else {
				valid.element.focus();
				self.sendAction('notifyMessage', 'Email or password were entered incorrectly');
			}
		}, 
		logoutAction: function() {
			var self = this;
			$.get('/logout', function(d, status, xhr) {
				//self.toggleProperty('isLoggedIn');
			}, 'json');

			self.sendAction('logoutAction', '', false);
		}
	}
});
/*********************************************************************/

/* Registration screen definition */

//Registration controller
App.RegisterController = Ember.Controller.extend({
	actions: {
		registerAction: function() {
			var data = {};
			var temp = $("#register_password");
			var valid = validateRegisterForm();

			if (valid.status === 0) {
				$("#registerbutton").attr("disabled", true);
				data.password = CryptoJS.SHA512(temp.val()).toString(CryptoJS.enc.Base64);
				data.email = $("#register_email").val();
				data.firstname = $("#register_firstname").val();
				data.lastname = $("#register_lastname").val();
				data.company = $("#register_company").val();

				$.post('/register', data, function(d, status, xhr) {
					console.log('Register: ', d, status)
					if (d && d.status === 0) {
						$("#registerbox").toggleClass("hidden");
						$("#thankyoubox").toggleClass("hidden");
						resetRegisterationForm();
					}
				}, 'json');
			} else {
				valid.element.focus();
			}
		}, validateEmail: function(text) {
			App._verimail.verify(text, function(status, message, suggestion) {
				console.log('verify:', status, message, suggestion)
				if (status < 0) {
					$("#register_email").parents(".form-group").removeClass('has-success').addClass('has-error');
				} else if (status === 0) {
					$("#register_email").parents(".form-group").removeClass('has-error').addClass('has-success')
				}
			});
		}, validatePassword: function(text) {
			if (!isPasswordValid(text)) {
				$("#register_password").parents(".form-group").removeClass('has-success').addClass('has-error');
			} else {
				$("#register_password").parents(".form-group").removeClass('has-error').addClass('has-success')
			}
		}
	}
});
/*********************************************************************/

/********************** HOME **********************************/
/* Home screen definition */

//Home route handler
//Used to obtain account details from server which is assigned to the controller's model
App.HomeRoute = Ember.Route.extend({
	needs: ['session'],
	beforeModel: function() {
		var session = this.controllerFor('session');
		if (!session.isSessionPresent()) this.transitionTo('/');
	},
	model: function() {
		console.log('CALLING HOME MODEL')
		var session = this.controllerFor('session');
		var id = session.getSession();

		return this.store.find('account', id).then(function(data) {
			console.log('data: ', data)
			if ('status' in data && data.status === 1) throw new Error('Not logged in');
			else return data;
		}).catch(function(err) {
			console.log('home error: ', err)
			session.clearSession();
			return undefined;
		});

/*		return Ember.$.getJSON('/user').then(function(data) {
			if ('status' in data && data.status === 1) {
				self.transitionTo('index');
				return {};
			} else return data;
 		});
*/
	},
	afterModel: function() {
		var session = this.controllerFor('session');
		var model = this.get('model');

		if ('status' in model && model.status === 1) session.clearSession();
	},
	setupController: function(controller, model) {
		var twilio;
		controller.set('model', model);
		console.log('home model', model)

		if (model) {
			twilio = model.get('twilio');

			if (twilio && twilio.id) {
				controller.set('isAccountCreated', true);
				if (model.get('numbers').get('length') === 0) this.transitionTo('numbers.create', model);
				else this.transitionTo('numbers.index', model);
			} else this.transitionTo('account.create', model.id);
		}
/*
		if ('twilio' in model) {
			if (!('associated_numbers' in model.twilio)) this.transitionTo('numbers.create', model._id);
			if ('associated_numbers' in model.twilio) {
				if (model.twilio.associated_numbers === null) this.transitionTo('numbers.create', model._id);
				else this.transitionTo('numbers.index', model._id);
			}
		}
*/
	}
});

// Home controller
//Used to handle many actions fired by individual components on the page
App.HomeController = Ember.Controller.extend({
	needs: ['application', 'session'],
	isAccountCreated: false
});
/*********************************************************************/

/********************** ACCOUNT **********************************/
App.AccountRoute = Ember.Route.extend({
	model: function() {
		return this.controllerFor('home').get('model');
	},
	afterModel: function() {
		if (!this.model()) {
			this.transitionTo('home')
		}
	}
});

App.AccountCreateController = Ember.Controller.extend({
	needs: ['home'],
	actions: {
		//create account method fired by CreateAccountComponent
		//TODO Convert to model *************************
		createAccount: function(account) {
			var self = this;
			var model = self.get('model')
			console.log('creating account: ', account);
			$.post('/api/v0/account', {account_name: account}, function(resp, status, xhr) {
				if (!('status' in resp)) {
					self.get("controllers.home").set('model', resp);
					$("#btnCreateAccount")
						.removeClass("btn-primary")
						.addClass("glyphicon glyphicon-ok btn-success")
						.text('');
					self.get("controllers.home").set('isAccountCreated', true);
					if (!('associated_numbers' in resp)) self.transitionToRoute('numbers.create', resp._id);
				} else {
					self.get("controllers.home").set('isAccountCreated', false);
				}
			}, 'json');
		}
	}
});

//Account creation component
App.CreateAccountComponent = Ember.Component.extend({
	actions: {
		createAccountAction: function() {
			//when the create button is clicked this function is called
			var account = $("#account_name").val() || $("#account_name").attr('placeholder')
			//call a function by the same name on the parent controller to do the Ajax, work passing the account name
			$("#account_name").val(account).attr('disabled', true);
			$("#btnCreateAccount").attr('disabled', true);
			this.sendAction('createAccountAction', account);
		}
	}
});
/*********************************************************************/

/********************** NUMBERS **********************************/
App.NumbersRoute = Ember.Route.extend({
	model: function(params) {
		//return this.store.all('account');
		//return this.controllerFor('home').get('model');
		return this.store.getById('account', params.account_id)
	},
	setupController: function(controller, model) {
		controller.set('model', model);
	}
});

App.NumbersIndexController = Ember.Controller.extend({
	needs: ['home', 'application'],
	actions: {
		removeNumber: function(id) {
			var self = this;
			var model;

			this.store.find('number', id).then(function(item) {
				item.deleteRecord();
				item.save();
			});
		}
	},
	numbers: function() {
		return this.get('model').get('numbers').map(function(item){  //.mapProperty('phone_number');
			return item;
		});
	}.property('model.numbers')
});

App.NumbersCreateController = Ember.Controller.extend({
	needs: ['home'],
	actions: {
		//list available phone numbers method fired by AddPhoneNumbers component
		getAvailableNumbers: function(params) {
			var self = this;

/*			this.store.find('number', params).then(function(n) {
				console.log('FOUND: ', n)
			})
*/
			$.get('/api/v0/number', params, function(resp, status, xhr) {
				console.log(resp, status)
				if (resp) {
					if ('status' in resp && resp.status === 1) self.set('phoneList', []);
					else if (Object.keys(resp).length > 0) self.set('phoneList', resp);
				}
			}, 'json');
		},
		buyPhoneNumbers: function(tns) {
			var self = this;
			var model;
			console.log('Buying TNS: ', tns)
			$.post('/api/v0/number', tns, function(resp, status, xhr) {
				console.log('BUYING RESP: ', resp)
				if (resp) {
					if ('status' in resp && resp.status === 1) {
						self.get("controllers.application").set('notify_message', 'Failed to provision phone number.  ('+resp.reason+')');
						toggleMessageSlide();
					} else {
						self.store.pushPayload('account', resp);
						self.transitionToRoute('numbers.index');
					}
				}
			}, 'json');
		}
	}
});

App.AddPhoneNumberComponent = Ember.Component.extend({
	selectedPhoneList: {},
	isSelectedPhoneList: function() {
		var list = this.get('selectedPhoneList');
		return list.length ? 'btn btn-success' : 'hidden';
	},
	actions: {
		getAvailableNumbersAction: function() {
			var params = {};
			params.state = $("#state_name").val();
			params.areacode = $("#areacode_name").val();
			params.local_attr = $("#local_checkbox").is(":checked");
			params.tollfree_attr = $("#tollfree_checkbox").is(":checked");

			this.sendAction('getAvailableNumbersAction', params);
		},
		buyPhoneNumbersAction: function() {
			var current_list = this.get('selectedPhoneList');

			if (Object.keys(current_list).length <= 0) return false;
			else this.sendAction('buyPhoneNumbersAction', current_list);
		},
		selectedTn: function(tn) {
			var current_list = this.get('selectedPhoneList');
			var el = "#"+tn.phone_number.replace('+','')+">p";
			var btn = $("#btnBuyPhoneNumbers");

			if (tn.phone_number in current_list) {
				delete current_list[tn.phone_number];
				$(el).addClass('text-primary').removeClass('text-success');
			} else {
				if (!tn.region && !tn.postal_code) current_list[tn.phone_number] = 'tollfree';
				else current_list[tn.phone_number] = 'local';
				$(el).addClass('text-success').removeClass('text-primary');
			}

			if (Object.keys(current_list).length && btn.hasClass('hidden')) btn.removeClass('hidden');
			else if (Object.keys(current_list).length === 0 && !btn.hasClass('hidden')) btn.addClass('hidden');
			this.set('selectedPhoneList', current_list);
		}
	}
});

App.MyPhoneNumbersComponent = Ember.Component.extend({
	actions: {
		removeNumberAction: function(id) {
			console.log('removing: ', id)
			this.sendAction('removeNumberAction', id);
		}
	}
});
/*********************************************************************/

/********************** IVRS **********************************/
App.IvrRoute = Ember.Route.extend({
	model: function(params) {
		//return this.store.all('account');
		return this.store.find('number', params.account_id);
	},
	setupController: function(controller, model) {
		controller.set('model', model);
		console.log('IVR model: ', model)

		if (id = model.get('ivr_id')) {
			this.transitionTo('ivr.edit', model);
		}
		
		$('.content_home').on('click', '.glyphicon-remove-circle', this.clickHandler);
		$('.content_home').on('click', '.glyphicon-arrow-right', this.clickHandler);
	},
	clickHandler: function(evt) {
		evt.preventDefault();
		evt.stopPropagation();

		var id = $(evt.currentTarget).parents('.row')[0].id;
		var isNested = /nested/.test(evt.currentTarget.id);
		var next_el = $('#'+id).next().attr('id');

		$('#'+id).remove();
		if (/nested/.test(next_el)) $('#'+next_el).remove();
		if (isNested) {
			if (/say/.test(evt.currentTarget.id)) $('#ivr-content').append('<div id="ivr-say-view'+this.div_counter+'" class="row"><div class="form-inline"><div class="form-group"><label class="form-control va-action-label va-inline-space">SAY</label><input type="text" id="ivr-say-message" placeholder="Enter the text to speak" class="form-control va-inline-space"/><label class="form-control va-action-label va-inline-space">as a</label><select id="ivr-say-voice" class="form-control va-inline-space"><option>Woman</option><option>Man</option></select><span id="ivr-say-remove" class="glyphicon glyphicon-remove-circle va-inline-space"></span></div></div></div>');
			else if (/pause/.test(evt.currentTarget.id)) $('#ivr-content').append('<div id="ivr-pause-view'+this.div_counter+'" class="row"><div class="form-inline"><div class="form-group"><label class="form-control va-action-label va-inline-space">PAUSE</label><input type="text" id="ivr-pause-duration" placeholder="Duration in seconds" class="form-control va-inline-space"/><span id="ivr-pause-remove" class="glyphicon glyphicon-remove-circle va-inline-space"></span></div></div></div>');
		}
	}, 
	willDestroy: function() {
		$('.content_home').off('click', '.glyphicon-remove-circle', this.clickHandler);
		$('.content_home').off('click', '.glyphicon-arrow-right', this.clickHandler);
	}
});

App.IvrIndexController = Ember.Controller.extend({
	needs: ['home'],
	actions: {
		createIvrAction: function() {
			this.transitionToRoute('ivr.create', this.model);
		}
	}
});

App.IvrCreateController = Ember.Controller.extend({
	needs: ['home', 'session', 'application'],
	div_counter: 0,
	actions: {
		createIvrAction: function() {
			var self = this;
			var $content = $('#ivr-content');
			var ids = $content.children().map(function(i, el) {return el.id}).toArray();
			var verbs = [];
			var params;
			var ivr;

			verbs = serialize(ids, this);

			ivr = this.store.createRecord('ivr');
			ivr.set('number_id', self.model);
			ivr.set('account_id', this.get('controllers.home').get('model'));
			ivr.set('actions', verbs);
			ivr.set('date_updated', new Date());
			ivr.save().then(function(resp) {
				var model;
				console.log('Saving IVR: ', resp);
				if ('status' in resp && resp.status === 1) throw (resp);
				//self.store.pushPayload('account', resp);
				model = self.get('controllers.home').get('model');
				self.transitionToRoute('numbers.index', model.get('id'));
			}).catch(function(err) {
				console.log('Saving IVR Error: ', err);
				var msg;
				if ('status' in err && err.status === 1) msg = err.reason;
				else msg = "Failed to make request.  Please try again later. - "+ err;

				self.get("controllers.application").set('notify_message', 'Failed to provision phone number.  ('+msg+')');
				toggleMessageSlide();
			});
		},
		select: function(name) {
			switch(name) {
				case 'say':
					if (this.canNest()) {
						$('#ivr-content').append('<div id="ivr-say-nested-view'+this.div_counter+'" class="row"><div class="form-inline"><div class="form-group"><span id="ivr-say-nested-remove" class="glyphicon glyphicon-arrow-right va-inline-space"></span><label class="form-control va-action-label va-inline-space">SAY</label><input type="text" id="ivr-say-message" placeholder="Enter the text to speak" class="form-control va-inline-space"/><label class="form-control va-action-label va-inline-space">as a</label><select id="ivr-say-voice" class="form-control va-inline-space"><option>Woman</option><option>Man</option></select><span id="ivr-say-remove" class="glyphicon glyphicon-remove-circle va-inline-space"></span></div></div></div>');
					} else $('#ivr-content').append('<div id="ivr-say-view'+this.div_counter+'" class="row"><div class="form-inline"><div class="form-group"><label class="form-control va-action-label va-inline-space">SAY</label><input type="text" id="ivr-say-message" placeholder="Enter the text to speak" class="form-control va-inline-space"/><label class="form-control va-action-label va-inline-space">as a</label><select id="ivr-say-voice" class="form-control va-inline-space"><option>Woman</option><option>Man</option></select><span id="ivr-say-remove" class="glyphicon glyphicon-remove-circle va-inline-space"></span></div></div></div>');
					this.div_counter++;
					break;
				case 'dial':
					$('#ivr-content').append('<div id="ivr-dial-view'+this.div_counter+'" class="row"><div class="form-inline"><div class="form-group"><label class="form-control va-action-label va-inline-space">DIAL</label><input type="text" id="ivr-dial-number" placeholder="Phone number" class="form-control va-inline-space"/><label class="form-control va-action-label va-inline-space">after how many seconds</label><input type="text" id="ivr-dial-timeout" placeholder="Timeout" class="form-control va-inline-space"/><span id="ivr-dial-remove" class="glyphicon glyphicon-remove-circle va-inline-space"></span></div></div></div>');
					this.div_counter++;
					break;
				case 'hangup':
					$('#ivr-content').append('<div id="ivr-hangup-view'+this.div_counter+'" class="row"><div class="form-inline"><div class="form-group"><label class="form-control va-action-label va-inline-space">HANGUP</label><span id="ivr-hangup-remove" class="glyphicon glyphicon-remove-circle va-inline-space"></span></div></div></div>');
					this.div_counter++;
					break;
				case 'pause':
					if (this.canNest()) {
						$('#ivr-content').append('<div id="ivr-pause-nested-view'+this.div_counter+'" class="row"><div class="form-inline"><div class="form-group"><span id="ivr-pause-nested-remove" class="glyphicon glyphicon-arrow-right va-inline-space"></span><label class="form-control va-action-label va-inline-space">PAUSE</label><input type="text" id="ivr-pause-duration" placeholder="Duration in seconds" class="form-control va-inline-space"/><span id="ivr-pause-remove" class="glyphicon glyphicon-remove-circle va-inline-space"></span></div></div></div>');
					} else $('#ivr-content').append('<div id="ivr-pause-view'+this.div_counter+'" class="row"><div class="form-inline"><div class="form-group"><label class="form-control va-action-label va-inline-space">PAUSE</label><input type="text" id="ivr-pause-duration" placeholder="Duration in seconds" class="form-control va-inline-space"/><span id="ivr-pause-remove" class="glyphicon glyphicon-remove-circle va-inline-space"></span></div></div></div>');
					this.div_counter++;
					break;
				case 'reject':
					$('#ivr-content').append('<div id="ivr-reject-view'+this.div_counter+'" class="row"><div class="form-inline"><div class="form-group"><label class="form-control va-action-label va-inline-space">REJECT</label><label class="form-control va-action-label va-inline-space">And play back the following tone</label><select id="ivr-reject-reason" class="form-control va-inline-space"><option>Rejected</option><option>Busy</option></select><span id="ivr-reject-remove" class="glyphicon glyphicon-remove-circle va-inline-space"></span></div></div></div>');
					this.div_counter++;
					break;
				case 'message':
					$('#ivr-content').append('<div id="ivr-message-view'+this.div_counter+'" class="row"><div class="form-inline"><div class="form-group"><label class="form-control va-action-label va-inline-space">MESSAGE</label><input type="text" id="ivr-message-text" placeholder="Text" class="form-control va-inline-space"/><label class="form-control va-action-label va-inline-space">to</label><input type="text" id="ivr-message-number" placeholder="Blank for current caller" class="form-control va-inline-space"/><span id="ivr-message-remove" class="glyphicon glyphicon-remove-circle va-inline-space"></span></div></div></div>');
					this.div_counter++;
					break;
				case 'gather':
					$('#ivr-content').append('<div id="ivr-gather-view'+this.div_counter+'" class="row"><div class="form-inline"><div class="form-group"><label class="form-control va-action-label va-inline-space">GATHER</label><label class="form-control va-action-label va-inline-space">How many digits</label><input type="text" id="ivr-gather-numdigits" placeholder="Unlimited" class="form-control va-inline-space"/><label class="form-control va-action-label va-inline-space">or wait for timeout of</label><input type="text" id="ivr-gather-timeout" placeholder="5 seconds" class="form-control va-inline-space"/><label class="form-control va-action-label va-inline-space">or a press of</label><input type="text" id="ivr-gather-finishonkey" placeholder="#" class="form-control va-inline-space"/><span id="ivr-gather-remove" class="glyphicon glyphicon-remove-circle va-inline-space"></span></div></div></div>');
					this.div_counter++;
					break;
			}
		},
		cancelIvrAction: function(el) {
			//find the element id and remove that view
			var model = this.get('controllers.home').get('model');
			this.transitionToRoute('numbers.index', model.get('id'));
		}
	}, 
	canNest: function() {
		var id = $('#ivr-content').children().map(function(i,el){return $(el).attr('id')}).toArray().pop();
		return /gather/.test(id);
	}
});

App.IvrEditController = Ember.Controller.extend({
	needs: ['home', 'session', 'application'],
	actions: {}
});

App.IvrSayComponent = Ember.Component.extend({
	actions: {}
})
/*********************************************************************/

/* Handlebars Helper Functions */

Ember.Handlebars.helper('format-date', function(date) {
	return moment(date).fromNow();
});

Ember.Handlebars.helper('tn-to-class', function(tn) {
	return tn.replace('+', '');
});
/********************************/

/* HELPER FUNCTIONS */

function isPasswordValid(pass) {
	if (pass.length > 5) {
		if (/[A-Z]{1,}/.test(pass)) {
			if (/[0-9]{1,}/.test(pass)) {
				return true
			}
		}
	}
	return false;
}
function validateRegisterForm() {
	App._verimail.verify($("#register_email").val(), function(status, message, suggestion) {
		if (status < 0) {
			$("#register_email").parents(".form-group").removeClass('has-success').addClass('has-error');
			return {status: -1, element: $("#register_email")};
		} else if (status === 0) {
			$("#register_email").parents(".form-group").removeClass('has-error').addClass('has-success')
		}
	});

	if (!isPasswordValid($("#register_password").val())) {
		$("#register_password").parents(".form-group").removeClass('has-success').addClass('has-error');
		return {status: -1, element: $("#register_password")};
	} else {
		$("#register_password").parents(".form-group").removeClass('has-error').addClass('has-success')
	}

	if ($("#register_company").val().length < 1) {
		$("#register_company").parents(".form-group").removeClass('has-success').addClass('has-error');
		return {status: -1, element: $("#register_company")};
	} else {
		$("#register_company").parents(".form-group").removeClass('has-error').addClass('has-success');
	}

	if ($("#register_lastname").val().length < 1) {
		$("#register_lastname").parents(".form-group").removeClass('has-success').addClass('has-error');
		return {status: -1, element: $("#register_lastname")};
	} else {
		$("#register_lastname").parents(".form-group").removeClass('has-error').addClass('has-success');
	}

	if ($("#register_firstname").val().length < 1) {
		$("#register_firstname").parents(".form-group").removeClass('has-success').addClass('has-error');
		return {status: -1, element: $("#register_firstname")};
	} else {
		$("#register_firstname").parents(".form-group").removeClass('has-error').addClass('has-success');
	}

	return {status: 0};
}

function validateLoginForm() {
	App._verimail.verify($("#login_email").val(), function(status, message, suggestion) {
		if (status < 0) {
			$("#login_email").parents(".form-group").removeClass('has-success').addClass('has-error');
			return {status: -1, element: $("#login_email")};
		} else if (status === 0) {
			$("#login_email").parents(".form-group").removeClass('has-error').addClass('has-success')
		}
	});

	if (!isPasswordValid($("#login_password").val())) {
		$("#login_password").parents(".form-group").removeClass('has-success').addClass('has-error');
		return {status: -1, element: $("#login_password")};
	} else {
		$("#login_password").parents(".form-group").removeClass('has-error').addClass('has-success')
	}

	return {status: 0};
}

function resetRegisterationForm() {
	$("#registerbutton").attr("disabled", false);
	$("register_password").val("")
	$("#register_email").val("");
	$("#register_firstname").val("");
	$("#register_lastname").val("");
	$("#register_company").val("");
}

function resetLoginForm() {
	$("#login_password").val("")
	$("#login_email").val("");
}

function isMessageOn() {
	var attr = $("#message").attr('style');

	if (attr === undefined || /none/.test(attr)) return false;
	else return true
}

function toggleMessageSlide() {
	if (!isMessageOn()) {
		$("#message").slideDown('slow', function() {
			setTimeout("$('#message').slideUp('slow')", 3000);
		});
	}
}

function serialize(ids, self) {
	//var self = this;
	var verbs = [];
	var temp = [];

	function run(id) {
		var terms, nested, action, $el, number;
		if (!id) return;

		terms = id.match(/ivr-(\w+)-(nested)?/);
		nested = terms.pop();
		action = terms.pop();
		$el = $('#'+id);

		switch (action) {
			case 'say':
				ret = {
					verb: action,
					nouns: {
						text: $el.find('#ivr-say-message').val()
					},
					attributes: {
						voice: $el.find('#ivr-say-voice').val(),
						loop: 1,
						language: 'en'
					}
				}
				break;
			case 'dial':
				//TODO: validate phone number format
				number = $el.find('#ivr-dial-number').val();
				if (/[,]/.test(number)) number = number.split(',');
				ret = {
					verb: action,
					nouns: {},
					attributes: {
						timeout: $el.find('#ivr-dial-timeout').val(),
						record: 'do-not-record',
						hangupOnStar: false,
						timeLimit: 14400,
						callerId: self.model.get('phone_number')
					}
				}
				if (number instanceof Array) ret.nouns.number = number;
				else ret.nouns.text = $el.find('#ivr-dial-number').val();
				break;
			case 'hangup':
				ret = {
					verb: action,
					nouns: undefined,
					attributes: undefined
				}
				break;
			case 'pause':
				ret = {
					verb: action,
					nouns: undefined,
					attributes: {
						length: $el.find('#ivr-pause-duration').val()
					}
				}
				break;
			case 'reject':
				ret = {
					verb: action,
					nouns: undefined,
					attributes: {
						reason: $el.find('#ivr-reject-reason').val()
					}
				}
				break;
			case 'message':
				//If message is longer than 1600 chars, notify user that text will be broken into multiple messages
				ret = {
					verb: action,
					nouns: {
						body: $el.find('#ivr-message-text').val()
						//media: url
					},
					attributes: {
						to: $el.find('#ivr-message-number').val()
						//from: this.model.get('phone_number')
					}
				}
				if (ret.attributes.to === '') delete ret.attributes.to;
				break;
			case 'gather':
				//TODO: complete this verb
				ret = {
					verb: action,
					nouns: undefined,
					attributes: {
						timeout: parseInt($el.find('#ivr-gather-timeout').val()),
						numDigits: $el.find('#ivr-gather-numdigits').val(),
						finishOnKey: $el.find('#ivr-gather-finishonkey').val()
					}
				}
				if (ret.attributes.numDigits.length <= 0) delete ret.attributes.numDigits;
				if (!ret.attributes.timeout || ret.attributes.timeout <= 0) ret.attributes.timeout = 5;
				if (ret.attributes.finishOnKey.length <= 0) ret.attributes.finishOnKey = '#';
				break;
			default:
				return;
		}

		if (nested) temp.push(ret);
		else {
			if (temp.length) {
				ret.nested = temp;
				temp = [];
			}
			verbs.push(ret);
		}
		return run(ids.pop());
	}

	run(ids.pop());
	return verbs.reverse();
}
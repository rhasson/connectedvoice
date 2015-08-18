//Main Emberjs App file

App = Ember.Application.create({
	ready: function() {
		App.IvrViewContainer = Ember.ContainerView.create();
		//App.IvrViewContainer.appendTo("#ivr-content");
	}
});
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
	ivr_id: DS.attr()
});

App.Ivr = DS.Model.extend({
	account_id: DS.belongsTo('account'),
	ivr_name: DS.attr('string'),
	date_updated: DS.attr('date'),
	actions: DS.attr()
});

App.Error = DS.Model.extend({
	status: DS.attr('number'),
	reason: DS.attr('text')
});

App.Ivrsay = DS.Model.extend({
	index: DS.attr('number'),
	verb: 'say',
	init: function() {
		this._super.apply(this, arguments);
		this.nouns = {
			text: null,
			expected_digit: null
		};
		this.verb_attributes = {
			voice: 'Woman',
			loop: 1,
			language: 'en'
		};
		this.params = {
			voice_options: ['Woman', 'Man']
		};
	}
});

App.Ivrdial = DS.Model.extend({
	index: DS.attr('number'),
	verb: 'dial',
	init: function() {
		this._super.apply(this, arguments);
		this.nouns = {
			text: null
		};
		this.verb_attributes = {
			timeout: 30,
			record: 'do-not-record',
			hangupOnStar: false,
			timeLimit: 14400,
			callerId: null
		};
		this.params = {};
	}
});

App.Ivrhangup = DS.Model.extend({
	index: DS.attr('number'),
	verb: 'hangup',
	init: function() {
		this._super.apply(this, arguments);
		this.nouns = {};
		this.verb_attributes = {};
		this.params = {};
	}
});

App.Ivrpause = DS.Model.extend({
	index: DS.attr('number'),
	verb: 'pause',
	init: function() {
		this._super.apply(this, arguments);
		this.nouns = {};
		this.verb_attributes = {
			len: 1
		};
		params = {};
	}
});

App.Ivrreject = DS.Model.extend({
	index: DS.attr('number'),
	verb: 'reject',
	init: function() {
		this._super.apply(this, arguments);
		this.nouns = {};
		this.verb_attributes = {
			reason: 'Rejected'
		};
		this.params = {
			reason_options: ['Rejected', 'Busy']
		};
	}
});

App.Ivrmessage = DS.Model.extend({
	index: DS.attr('number'),
	verb: 'message',
	init: function() {
		this._super.apply(this, arguments);
		this.nouns = {
			body: null
		};
		this.verb_attributes = {
			to: null
		};
		this.params = {};
	}
});

App.Ivrgather = DS.Model.extend({
	index: DS.attr('number'),
	verb: 'gather',
	init: function() {
		this._super.apply(this, arguments);
		this.nouns = {};
		this.verb_attributes = {
			timeout: 5,
			numDigits: 'unlimited',
			finishOnKey: '#'
		};
		this.params = {
			nesting_rules: ['say', 'play', 'pause']
		};
	}
});

App.Ivremail = DS.Model.extend({
	index: DS.attr('number'),
	verb: 'email',
	init: function() {
		this._super.apply(this, arguments);
		this.nouns = {
			text: null,
			message: null
		};
		this.verb_attributes = {};
		this.params = {};
	}
});

App.Ivrrecord = DS.Model.extend({
	index: DS.attr('number'),
	verb: 'record',
	init: function() {
		this._super.apply(this, arguments);
		this.nouns = {};
		this.verb_attributes = {
			maxLength: 60, //in minutes.  must be converted to seconds when serializing
			transcribe: 'No' //convert to true/false
		};
		this.params = {
			transcribe_options: ['Yes', 'No']
		};
	}
});

App.Ivrwebtask = DS.Model.extend({
	index: DS.attr('number'),
	verb: 'webtask',
	init: function() {
		this._super.apply(this, arguments);
		this.nouns = {};
		this.verb_attributes = {};
		this.params = {};
	}
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
		this.resource('ivr', {path: '/ivr/:account_id'},function() {
			this.route('index');
			this.resource('createIvr', {path: '/:ivr_id'}, function() {
				this.route('new');
				this.route('edit');
			});
			this.route('remove', {path: '/:account_id/:ivr_id'});
		});
		this.resource('dashboard');
		this.resource('analytics');
		this.resource('campaigns');
		this.resource('configuration');
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
		this.store.unloadAll('account');
		this.store.unloadAll('number');
		this.store.unloadAll('ivr');
		this.set('isLoggedIn', this.isSessionPresent());
	},
	isSessionPresent: function() {
		return this.getSession() ? true : false;
	}
});
/*********************************************************************/

/* Application default behavior definition */

App.ApplicationRoute = Ember.Route.extend({
	actions: {
		/* Generic method for executing actions on behalf of nested components
		** action: the method name on the controller to call
		** params: a hash of parameters to pass to the method
		*/
		takeAction: function(action, params) {
			this.send(action, params);
		},
		showModal: function(name, data) {
			if (typeof name === 'object') {
				data = name.model;
				name = name.name;
			}
			this.render(name, {
				into: 'application',
				outlet: 'modal',
				model: data
			});
		},
		hideModal: function() {
			this.disconnectOutlet({
				outlet: 'modal',
				parentView: 'application'
			});
		},
		//params: object with id or a number_id
		removeNumberAction: function(params) {
			var self = this;
			var id = params ? params.get('id') : params.number_id;

			this.store.find('number', id).then(function(item) {
				item.deleteRecord();
				item.save().then(function(resp) {
					//this.refresh();
					//console.log(self.container.lookup('view:configuration'));
				})
				.catch(function(err) {
					console.log('err: ', err)
					self.get('controller').set('notify_message', 'Failed to remove number to server.  Please try again later');
					toggleMessageSlide();
				});
			});
		},
		//params: number_id, ivr_name
		saveIvrToNumber: function(params) {
			var self = this;
			var ivr = this.store.all('ivr').filterBy('ivr_name', params.ivr_name);
			var number = this.store.all('number').filterBy('id', params.number_id).pop();
			var ivr_id = ivr.length ? ivr.pop().get('id') : "";

			if (number.get('ivr_id') === ivr_id) return;

			number.set('ivr_id', ivr_id);
			number.save().then(function(resp) {
					self.refresh();
				})
				.catch(function(err) {
					console.log('err: ', err)
					self.get('controller').set('notify_message', 'Failed to save changes to server.  Please try again later');
					toggleMessageSlide();
				});
		}
	}
});

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
	}
});

//Login & logout component definition
App.LogInComponent = Ember.Component.extend({
	actions: {
		loginAction: function() {
			var self = this;
			var data = {};
			var temp = $("#login_password");
			var valid = validateLoginForm();
			var jq;

			if (valid.status === 0) {
				data.email = $("#login_email").val().toLowerCase();
				data.password = CryptoJS.SHA512(temp.val()).toString(CryptoJS.enc.Base64);
				jq = $.post('/login', data, function(d, status, xhr) {
						console.log('Login: ', d, status)
						if (d && d.status === 0) {
							resetLoginForm();
							self.sendAction('loginAction', d.user_id, true);
						} else {
							self.sendAction('notifyMessage', d.reason);
						}
					}, 'json');
				jq.fail(function(xhr, status, err) {
					self.sendAction('notifyMessage', 'Email or password were entered incorrectly');
				});
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
		var self = this;
		var session = this.controllerFor('session');
		var id = session.getSession();

		return this.store.fetchById('account', id).then(function(data) {
			if ('status' in data && data.status === 1) throw new Error('Not logged in');
			else return data;
		}).catch(function(err) {
			console.log('home error: ', err)
			session.clearSession();
			self.transitionTo('/');
			return undefined;
		});

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
				if (model.get('numbers').get('length') === 0) this.transitionTo('configuration');
				else this.transitionTo('dashboard');
			} else this.transitionTo('account.create', model.id);
		}
	}
});

// Home controller
//Used to handle many actions fired by individual components on the page
App.HomeController = Ember.Controller.extend(Ember.Evented, {
	needs: ['application', 'session'],
	isAccountCreated: false,
	comp_name: 'dashboard',
	getCompType: Ember.computed('comp_name', function() {
		return this.get('comp_name');
	}),
	actions: {
		switchComponent: function(name) {
			if (typeof name === 'object') name = name.name;
			this.set('comp_name', name);
		}
	}
});
/*********************************************************************/

/*  NOTE:
* The HOME template contains a dynamic component helper {{component getCompType model=model action="takeAction"}}
* The 'action' parameter is used to call into the parent controller
* Each individual component inside the HOME template will have it's own actions to handle UI.  If they need to call into the controller they
* will need to use this.sendAction('action', param1, param2...).  Where 'action' is a keyward that references the 'takeAction'
* method on the controller.
*/

/********************** DASHBOARD **********************************/

App.DashboardRoute = Ember.Route.extend({
	needs: ['session'],
	model: function() {
		var id = this.controllerFor('session').getSession();
		return this.store.find('account', id);
	}
});

/*********************************************************************/

/********************** CONFIGURATIONS **********************************/

App.ConfigurationRoute = Ember.Route.extend({
	needs: ['session'],
 	model: function() {
 		/* combine the ivr_name from the ivr model array with the corresponding number from the numbers array
 		*  use that as the base model for this route
 		*/
	    var nums = this.store.all('number') || [];
	        ivrs = this.store.all('ivr') || [];
	    var stream = nums.map(function(item) {
	    	var x;
	    	var id = item.get('ivr_id');
	    	if (id) {
	    		x = ivrs.findBy('id', id);
	    		if (x) item.set('ivr_name', x.get('ivr_name'));
	    	}
	    	return item;
	    });

	    return Em.ArrayProxy.createWithMixins(Ember.SortableMixin, {
	        content: stream,
	        sortProperties: this.sortProperties,
	        sortAscending: this.sortAscending,
	        names: ivrs.map(function(item) { return item.get('ivr_name'); }),
	        needSave: false
	    });
 	},
 	setupController: function(controller, model) {
		var id = this.controllerFor('session').getSession();
		controller.set('account', this.store.find('account', id));
 		controller.set('model', model);
 	}
});

App.PhoneNumbersComponent = Ember.Component.extend({
	actions: {
		removeNumberAction: function(number) {
			console.log('REMOVE ACTION: ', number);
			//this.sendAction('action', 'removeNumber', {number_id: number.id});
		},
		showModal: function(name, number) {
			this.sendAction('action', 'showModal', {name: name, model: number});
		},
		hideModal: function() {
			this.sendAction('action', 'hideModal');
		},
		switchToAddNumComp: function() {
			this.sendAction('action', 'switchComponent', {name: 'add-phone-number'});
		},
		/* triggers when select item is changed in custom select box
		* prev: original value
		* value: actual value being selected
		* obj: class object
		*/
		selectChangeAction: function(prev, value, obj) {
			//console.log('Select Changed: ', prev, ' to ', value)
			var el = '#' + obj.get('elementId');
			if (prev === value) {
				$(el).parent().next().children('span.glyphicon-ok-circle').removeClass('green').addClass('gray');
			} else {
				$(el).parent().next().children('span.glyphicon-ok-circle').addClass('green').removeClass('gray');
			}
		},
		saveIvrChangeAction: function(number_id, ivr_name, obj) {
			//save the current ivr to the number
			this.sendAction('action', 'saveIvrToNumber', {number_id: number_id, ivr_name: ivr_name});
		}
	}
});

/*********************************************************************/
/********************** ACCOUNT **********************************/
App.AccountRoute = Ember.Route.extend({
	needs: ['session'],
	model: function() {
		var id = this.controllerFor('session').getSession();
		return this.store.find('account', id);
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
		return this.store.getById('account', params.account_id)
	},
	setupController: function(controller, model) {
		controller.set('model', model);
	}
});

/*
App.NumbersIndexController = Ember.Controller.extend({
	needs: ['home', 'application'],
	actions: {
		removeNumber: function(id) {
			var self = this;
			var model;

			this.store.find('number', id).then(function(item) {
				item.deleteRecord();
				item.save().then(function(resp) {
					resp.refresh();
				})
				.catch(function(err) {
					console.log('err: ', err)
					self.get('controller.application').set('notify_message', 'Failed to save changes to server.  Please try again');
					toggleMessageSlide();
				});
			});
		}
	},
	numbers: function() {
		return this.get('model').get('numbers').map(function(item){  //.mapProperty('phone_number');
			return item;
		});
	}.property('model.numbers')
});
*/

App.NumbersCreateController = Ember.Controller.extend({
	needs: ['home'],
	actions: {
		//list available phone numbers method fired by AddPhoneNumbers component
		getAvailableNumbers: function(params) {
			var self = this;
			var jq = $.get('/api/v0/number', params, function(resp, status, xhr) {
				if (resp) {
					if (Object.keys(resp).length > 0) self.set('phoneList', resp);
					else self.set('phoneList', []);
				}
			}, 'json');
			jq.catch(function(err) {
				self.get("controllers.application").set('notify_message', 'Failed to get phone numbers.  Please try again later');
				toggleMessageSlide();
				self.set('phoneList', []);
			});
		},
		buyPhoneNumbers: function(tns) {
			var self = this;
			var model;
			var jq;
			console.log('Buying TNS: ', tns)
			jq = $.post('/api/v0/number', tns, function(resp, status, xhr) {
				console.log('BUYING RESP: ', resp)
				if (resp) {
					self.store.pushPayload('account', resp);
					self.transitionToRoute('numbers.index');
				}
			}, 'json');
			jq.catch(function(err) {
				self.get("controllers.application").set('notify_message', 'Failed to provision phone number.  ('+err+')');
				toggleMessageSlide();
			});
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

/*********************************************************************/

/********************** IVRS **********************************/
App.IvrIndexRoute = Ember.Route.extend({
	model: function(params) {
		return this.store.all('ivr');
	},
	actions: {
		removeIvrAction: function(ivr) {
			ivr.destroyRecord();
		}
	}
});

//App.CreateIvrController = Ember.Controller.extend({
App.CreateIvrRoute = Ember.Route.extend({
	needs: ['home', 'session', 'application'],
	beforeModel: function(transition) {
		this.set('_account', this.store.find('account', transition.params.ivr.account_id));
	},
	model: function(params) {
		if (Ember.keys(params).length === 0 || params.ivr_id === '0') return Ember.Object.create();
		return this.store.find('ivr', params.ivr_id);
	},
	setupController: function(controller, model) {
		if (Ember.keys(model).length === 0) model.set('ivr_name', 'Default');
		model.set('_containerView', undefined);
		model.set('_verbs', undefined);
		model.set('_account', this.get('_account'));

		controller.set('model', model);
	},
	actions: {
		createIvrAction: function() {
			var self = this;
			var controller = this.get('controller');
			var containerView = controller.get('model._containerView'); //Ember.View.views['ivrcontainerview'];
			var views = containerView.get('childViews');
			var ivr;

 			var verbs = serializeIvr(views);

 			if (controller.get('model').get('id') === undefined) {
 				ivr = this.store.createRecord('ivr');
 			} else {
 				ivr = controller.get('model');
 			}

			ivr.set('account_id', controller.get('model._account'));
			ivr.set('ivr_name', controller.get('model.ivr_name'));
			ivr.set('actions', verbs);
			ivr.set('date_updated', new Date());
			
			//console.log('FINAL IVR: ', ivr.toJSON());

			ivr.save().then(function() {			
				//After model was saved successfully clear up IVR creation variables and redirect to ivr.index
				self.send('cancelIvrAction');
			}, function(err) {
				console.log('err: ', err, self)
				self.get('controllers.application').set('notify_message', 'Failed to save IVR.  ('+msg+')');
				toggleMessageSlide();
			});
		},
		cancelIvrAction: function() {
			var self = this;
			var containerView = this.get('controller').get('model._containerView');

			containerView.toArray().forEach(function(comp) {
				self.store.deleteRecord(comp.item);
				containerView.removeObject(comp);
			});

			this.get('controller').set('model._containerView', undefined);

			this.transitionTo('ivr.index');
		},
		removeIvrItem: function(comp) {
			var containerView = this.get('controller').get('model._containerView');
			this.store.deleteRecord(comp.item);
			containerView.removeObject(comp);
			this.get('controller').set('model._containerView', containerView);
		},
		unNestIvrItem: function(comp) {
			var containerView = this.get('controller').get('model._containerView');
			var current_id = comp.item.get('index');

			var arr = containerView.toArray();

			for (var i=0, id, temp, v; i < arr.length; i++) {
				v = arr[i];
				id = v.item.get('index');
				if (id === current_id) {
					//take existing values and remove word nested from them
					temp = v.get('templateName');
					v.set('templateName', temp.replace(/-nested$/, ''));
					temp = v.get('classNames').toArray().map(function(x) {
						if (/-nested/.test(x)) x = x.replace(/-nested[0-9]+.$/, ''+id);
						return x;
					});
					v.set('classNames', temp);
					v.parent_id = undefined;
					v.rerender();
					containerView.removeObject(comp);
					containerView.pushObject(v);
					break;
				}
			}
			this.set('model._containerView', containerView);
		},
		select: function(name, model_in) {
			var containerView = this.get('controller').get('model._containerView'); //Ember.View.views['ivrcontainerview'];
			var viewClass, id, parent_id, action_for;
			var model = undefined;

			parent_id = this.canNest(containerView, name);  //if nestable, returns the index id of the parent view to nest under
			action_for = this.getActionFor(containerView, name); //if this is an action in response to a verb, return the index id of the verb it's in response to
			if (action_for && action_for.parent_id) parent_id = action_for.parent_id;
			if (action_for && action_for.action_id) action_for = action_for.action_id;

			id = Date.now().toString();

			model = this.store.createRecord('ivr'+name, model_in);
			model.set('index', id);

			containerView.get('content').pushObject(model);

			compClass = Ember.Component.extend({
				item: {},
				index: id,
				parent_id: parent_id,
				action_for: action_for,
				isNested: function() {
					return !!this.parent_id;
				}.property('parent_id'),
				isAction: function() {
					return !!this.parent_id && !!this.action_for;
				}.property('action_for'),
 				layoutName: 'components/ivr-'+name, //parent_id ? 'components/ivr-'+name+'-nested' : 'components/ivr-'+name,
				classNames: ['row', 'ivr-'+name+'-view'+id],
				init: function() {
					var model, id;

					this._super.apply(this, arguments);

					id = this.get('index');
					model = this.get('parentView').get('content').findBy('index', id);

					this.set('item', model);
				},
				actions: {
					removeIvrItemAction: function() {
						this.get('parentView').send('removeIvrItem', this);
					},
					unNestIvrItemAction: function() {
						this.get('parentView').send('unNestIvrItem', this);
					}
				}
			});

			compClass = containerView.createChildView(compClass);
			containerView.pushObject(compClass);

			this.get('controller').set('model._containerView', containerView);
		}
	},
	canNest: function(container, verbToNest) {
		var nestable = ['gather'];
		var allowedToNest = ['say', 'pause'];
		var actions = ['dial', 'record', 'message', 'email', 'webtask'];
		var containerView = container; //this.get('controller').get('model._containerView');//Ember.View.views['ivrcontainerview'];
		var views = containerView.toArray();  //containerView.get('content');
		var parent = undefined;

		views.reverse();
		for (var i=0; i < views.length; i++) {
			if (views[i].parent_id === undefined  //is it already nested
				&& nestable.indexOf(views[i].get('item').get('verb')) > -1   //is it a Gather
				&& allowedToNest.indexOf(verbToNest) > -1)  //is it a verb that's allowed to nest
			{
				parent = views[i].get('item').get('index');
				break;
			}
		}
		return parent;
	},
	getActionFor: function(container, verb) {
		var actions = ['dial', 'record', 'message', 'email', 'webtask'];
		var containerView = container; //this.get('model._containerView');
		var views = containerView.toArray();
		var view;

		if (actions.indexOf(verb) > -1 && views.length) {
			view = views[views.length-1];
			return {action_id: view.get('item').get('index'),
					parent_id: view.get('parent_id') || undefined};
		} else return undefined;
	}
});

App.CreateIvrView = Ember.View.extend({
	layoutName: 'ivr/createIvr',
	init: function() {
    	var actions, id, ivr, containerView;
    	var childViews;
		
		this._super.apply(this, arguments);
		
		ivr = this.get('controller').get('model');
	   	this.get('controller').set('model._verbs', ivr ? ivr.get('actions') : []);
		
		containerView = Ember.ContainerView.extend({
			elementId: 'ivrcontainerview',
			classNames: ['col-md-12'],
			content: [],
			actions: {
				removeIvrItem: function(comp) {
					this.get('controller').send('removeIvrItem', comp)
				},
				unNestIvrItem: function(comp) {
					this.get('controller').send('unNestIvrItem', comp);
				}
			}
		});

		this.get('controller').set('model.ivr_name', ivr ? ivr.get('ivr_name') : 'Default');
		this.get('controller').set('model._containerView', containerView.create());
	},
	didInsertElement: function() {
		var controller = this.get('controller');
		var verbs = controller.get('model._verbs');

		if (verbs && verbs.length) parse(verbs);

		function parse(arr) {
			for (var i=0, item; i < arr.length; i++) {
				item = arr[i];
				controller.send('select', item.verb, item);
				if ('nested' in item && item.nested) { parse(item.nested); }
				else if ('actions' in item && item.actions) { parse(item.actions); }
			}
		}
	}
});

/*********************************************************************/

/* Modal Component */

App.XModalComponent = Ember.Component.extend({
	didInsertElement: function() {
		this.$('.modal').modal().on('hidden.bs.modal', function() {
			this.sendAction('close');
		}.bind(this));
	},
	actions: {
		ok: function(data) {
			this.$('.modal').modal('hide');
			this.sendAction('ok', data);
		}
	}
});

/*********************************************************************/

/* Custom Select element */

App.SelectsView = Ember.Select.extend({
	_prev: undefined,
	didInsertElement: function() {
		this.set('_prev', this.get('value'));
		this.set('selectionDidChange', function(item) {
			var action = this.get('action');
			this.get('controller').send(action, this.get('_prev'), item.selection, item);
		});
	}
});
/*********************************************************************/

/* Handlebars Helper Functions */

Ember.Handlebars.helper('format-date', function(date) {
	return moment(date).fromNow();
});

Ember.Handlebars.helper('tn-to-class', function(tn) {
	return tn.replace('+', '');
});

Ember.Handlebars.helper('is-selected', function(model, current) {
	return model === current ? true : false;
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

function serializeIvr(views) {
	var verbs = [];
	var nested = [], actions = [];
	var model, view, p_id = undefined, a_id = undefined, temp = undefined;

	for (var i=views.length-1; i >= 0; i--) {
		view = views[i];
		model = view.get('item');

		if ('action_for' in view) {
			a_id = view.action_for;
			if (model.get('verb') === 'record') {
				temp = model.get('verb_attributes').get('maxLength') * 60;
				model.get('verb_attributes').set('maxLength', temp);
				temp = model.get('verb_attributes').get('transcribe') === 'Yes' ? true : false;
				model.get('verb_attributes').set('transcribe', temp);
			}
			addToArray(actions, model, {action_for: view.action_for});
			continue;
		}

		if ('parent_id' in view) {  //this is the top level verb where actions will be nested
			p_id = view.parent_id;
			addToArray(nested, model, {parent_id: view.parent_id, actions: actions});
			actions = [];
			a_id = undefined;
		} else if (p_id && p_id === model.get('index')) {   //this is the actual parent
			addToArray(verbs, model, {nested: nested});
			nested = [];
			p_id = undefined;
		} else if (!p_id && a_id) {
			for (var j=0; j < actions.length; j++) {
				verbs.unshift(actions[j]);
			}
			addToArray(verbs, model);
			a_id = undefined;
			actions = [];
		} else {
			addToArray(verbs, model);
		}

		function addToArray(arr, m, mixin) {
			var obj = {
				index: m.get('index'),
				verb: m.get('verb'),
				nouns: getOwnData(m.get('nouns')),
				verb_attributes: getOwnData(m.get('verb_attributes'))
			}
			if (mixin) Ember.mixin(obj, mixin);
			arr.unshift(getOwnData(obj));
		}
	}

	function getOwnData(obj) {
		var temp = {};
		if (!Object.keys(obj).length) return undefined;

		for (var i in obj) {
			if (obj.hasOwnProperty(i) && typeof obj[i] !== 'function') {
				if (typeof obj[i] === 'string') obj[i].trim();
				temp[i] = obj[i];
			}
		}

		return temp;
	}

console.log('FINAL: ', verbs)
	return verbs;
}

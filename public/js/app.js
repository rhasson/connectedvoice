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
	ivr_id: DS.belongsTo('ivr')
});

App.Ivr = DS.Model.extend({
	number_id: DS.belongsTo('number'),
	account_id: DS.belongsTo('account'),
	ivr_name: DS.attr('string'),
	date_updated: DS.attr('date'),
	actions: DS.attr()
});

App.Status = DS.Model.extend({
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
		this.resource('ivr', {path: '/ivr/:account_id'}, function() {
			this.route('index', {path: '/'});
			this.route('create');
			this.route('remove', {path: '/ivr/:account_id/:ivr_id'});
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
		removeNumber: function(id) {
			this.store.find('number', params.id).then(function(item) {
				item.deleteRecord();
				item.save();
			});
		}
	}
})

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
		var self = this;
		var session = this.controllerFor('session');
		var id = session.getSession();

		return this.store.fetchById('account', id).then(function(data) {
			console.log('data: ', data)
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
	    	var x = ivrs.findBy('id', item.get('ivr_id').get('id'));
	    	item.set('ivr_name', x.get('ivr_name'));
	    	return item;
	    });

	    return Em.ArrayProxy.createWithMixins(Ember.SortableMixin, {
	        content: stream,
	        sortProperties: this.sortProperties,
	        sortAscending: this.sortAscending
	    }); 		
 	},
 	setupController: function(controller, model) {
		var id = this.controllerFor('session').getSession();
		controller.set('account', this.store.find('account', id));
 		controller.set('model', model);
 	}
});

App.PhoneNumbersComponent = Ember.Component.extend({
	numbers: Ember.computed('model.numbers', function() {
		return this.get('model').get('numbers');
	}),
	actions: {
		removeNumberAction: function(id) {
			this.sendAction('action', 'removeNumber', {id: id});
		},
		switchToAddNumComp: function() {
			this.sendAction('action', 'switchComponent', {name: 'add-phone-number'});
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

/*********************************************************************/

/********************** IVRS **********************************/
App.IvrRoute = Ember.Route.extend({
	model: function(params) {
		//return this.store.all('account');
		return this.store.find('number', params.account_id);
	},
	setupController: function(controller, model) {
		controller.set('model', model);
	}
});

App.IvrCreateController = Ember.Controller.extend({
	needs: ['home', 'session', 'application'],
	ivr_name: 'Default',
	actions: {
		createIvrAction: function() {
			var self = this;
			var containerView = this.get('containerView'); //Ember.View.views['ivrcontainerview'];
			var views = containerView.get('childViews');

 			var verbs = serializeIvr(views);

			var ivr = this.store.createRecord('ivr');

			ivr.set('number_id', this.model);
			ivr.set('account_id', this.get('controllers.home').get('model'));
			ivr.set('ivr_name', this.get('ivr_name'));
			ivr.set('actions', verbs);
			ivr.set('date_updated', new Date());
			ivr.save().then(function() {			
				//After model was saved successfully clear up IVR creation variables and redirect to numbers.index
				self.send('cancelIvrAction');
			}).catch(function(err) {
				console.log('Saving IVR Error: ', err);
				var msg;
				if ('status' in err && err.status === 1) msg = err.reason;
				else msg = "Failed to make request.  Please try again later. - "+ err;

				self.get("controllers.application").set('notify_message', 'Failed to save IVR.  ('+msg+')');
				toggleMessageSlide();
			});
		},
		cancelIvrAction: function() {
			var self = this;
			var model = this.get('controllers.home').get('model');
			var containerView = this.get('containerView'); //Ember.View.views['ivrcontainerview'];

			containerView.toArray().forEach(function(comp) {
				self.store.deleteRecord(comp.item);
				containerView.removeObject(comp);
			});

			this.set('containerView', undefined);

			this.transitionToRoute('configuration');
		},
		removeIvrItem: function(comp) {
			var containerView = this.get('containerView');
			this.store.deleteRecord(comp.item);
			containerView.removeObject(comp);
			this.set('containerView', containerView);
			console.log(this.get('containerView'))
		},
		unNestIvrItem: function(comp) {
			var containerView = this.get('containerView');
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
			this.set('containerView', containerView);
		},
		select: function(name, model_in) {
			var containerView = this.get('containerView'); //Ember.View.views['ivrcontainerview'];
			var viewClass, id, parent_id, action_for;
			var model = undefined;

			parent_id = this.canNest(name);  //if nestable, returns the index id of the parent view to nest under
			action_for = this.getActionFor(name); //if this is an action in response to a verb, return the index id of the verb it's in response to
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
					return !!this.action_for;
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

			this.set('containerView', containerView);
		}
	},
	canNest: function(verbToNest) {
		var nestable = ['gather'];
		var allowedToNest = ['say', 'pause'];
		var containerView = this.get('containerView');//Ember.View.views['ivrcontainerview'];
		var views = containerView.toArray();  //containerView.get('content');
		var view = undefined;

		views.reverse();
		for (var i=0; i < views.length; i++) {
			if (views[i].parent_id === undefined
				&& nestable.indexOf(views[i].get('item').get('verb')) > -1 
				&& allowedToNest.indexOf(verbToNest) > -1)
			{
				view = views[i].get('item').get('index');
				break;
			}
		}
		return view;
	},
	getActionFor: function(verb) {
		var actions = ['dial', 'record', 'message', 'email', 'webtask'];
		var containerView = this.get('containerView');
		var views = containerView.toArray();

		if (actions.indexOf(verb) > -1 && views.length) {
			return views[views.length-1].get('item').get('index');
		} else return undefined;
	}
});

App.IvrCreateView = Ember.View.extend({
	layoutName: 'ivr/create',
	init: function() {
    	var actions, ivr, containerView;
    	var childViews;
		
		this._super.apply(this, arguments);
		
		ivr = this.get('controller').get('model').get('ivr_id');
	   	this.get('controller').set('verbs', ivr.get('actions'));
		
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
		this.get('controller').set('ivr_name', ivr.get('ivr_name'));
		this.get('controller').set('containerView', containerView.create());
	},
	didInsertElement: function() {
		var controller = this.get('controller');
		var verbs = controller.get('verbs');

		if (verbs.length) parse(verbs);

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

		if ('parent_id' in view) {
			p_id = view.parent_id;
			addToArray(nested, model, {parent_id: view.parent_id, actions: actions});
			actions = [];
			a_id = undefined;
		} else if (p_id && p_id === model.get('index')) {
			addToArray(verbs, model, {nested: nested});
			nested = [];
			p_id = undefined;
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
			if (obj.hasOwnProperty(i) && typeof obj[i] !== 'function') temp[i] = obj[i];
		}

		return temp;
	}

	return verbs;
}

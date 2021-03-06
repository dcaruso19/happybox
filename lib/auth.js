var internals = {};
internals.redirectAfterFailure = '/';
internals.redirectAuthenticatedDefault = '/';
internals.redirectBadLogin = '/login?badlogin';
internals.redirectConfirmationSuccess = '/login?confirmed';
internals.registerSuccessful = '/login?registerSuccessful';
internals.registerUserAlreadyExists = '/register?userAlreadyExists';
internals.baseuri = '';

internals.data = require('./models');

internals.setURI = function(input) {
	internals.baseuri = input;
}

var scurvy = require('./index').Scurvy;

internals.confirm = function(request, reply) {
	scurvy.doesMetastateHashkeyHaveUser(request.params.hashkey, function(err, result) {
		if (!result) {
			reply.redirect(internals.redirectAfterFailure);
		} else {
			//result is an object containing user and metastate.
			scurvy.activateUser(result, function(err2, activationResult) {
				if (err2) {
					console.log('auth.confirm: Error from activateUser: ' + err2);
					reply.redirect(internals.redirectAfterFailure);
				} else {
					console.log('auth.confirm: user has been activated');
					reply.redirect(internals.redirectConfirmationSuccess);
				}
			});
		}
	});
}


internals.register = function(request, reply) {
	var errors = [];
	
	if (!request.payload) {
		console.log("Register endpoint hit: Not a payload");
		errors.push("No valid payload sent.");
	} else {
		console.log("Register endpoint hit: A payload");

		// 1.) take in payload and grab each parameter
		//		email, passwrd, passwrd0 (confirmation), nickname
		
		var passwrd = request.payload.passwrd;
		var passwrd0 = request.payload.passwrd0;
		var email = request.payload.email;
		var isView = request.payload.view === 'true';
		//var nickname = request.payload.nickname;
		
		// 2.) validate parameters - https://github.com/spumko/hapi/blob/master/examples/validation.js
		//		route validation:: validate: { query: { userid: Hapi.types.String().required().with('passwrd') ...etc } }
		// Some route validation happens in the routing mechanism at the moment.
		
		//Password must match confirmation.
		if (passwrd !== passwrd0) {
			errors.push('Confirmation password does not match.');
		}
	}
	if (errors.length > 0) {
		//don't create user, send error response
		reply({ success: false, errors: errors });
	} else {
		// 3.) create deactivated user with a metastate record. requires creating the metastate hashkey from the user's salt and email (create user, send OK)
		
		scurvy.createUser({email: email, passwrd: passwrd, status: 'inactive'}, function(err, userball) {
			if (err) {
				errors.push(err);
				console.log('Error when trying to create user: ' + err);
				if (isView) {
					if (err.code === 'ER_DUP_ENTRY') {
						//Bring user to register page and display a message that a user already exists with that email address
						return reply.redirect(internals.registerUserAlreadyExists);
					}
				} else {
					reply({ success: false, errors: errors });
				}
			} else {
                internals.sendConfirmationEmail(email, userball.metastate.hashkey, function(err, result) {
                    console.log("(2)send mail finished! with result: " + result);
                    
                    if (isView) {
                        //Bring user to login page and display a message of success
                        return reply.redirect(internals.registerSuccessful);
                    } else {
                        reply({ success: result });
                    }
                });
			}
		});
	}
	
}


internals.sendConfirmationEmail = function(email, hashkey, callback) {
	var mailer = require('./index').Mailer;
	var confirmationUrl = internals.baseuri + '/confirm/' + hashkey;
	
	mailer.sendEmail(email,
		"HappyBox - Confirm Registration", //subject
		"Hello! Someone using this email address (" + email + ") has made an account registration request for the application HappyBox. If you intended to register, please confirm your registration by clicking the following link: " + confirmationUrl + " \n If you did not intend to register, please feel free to ignore and delete this email. Thanks!", //body
		function(err, result) {
			console.log("send mail finished! with result: " + result);
			if (err) { console.log(err); }
			//send OK
			callback(err, result);
		}
	);
}


internals.login = function(request, reply) {
	if (request.auth.isAuthenticated) {
		return reply.redirect(internals.redirectAuthenticatedDefault);
	}
	var message = '';
	var account = null;
	
	if (!request.payload.email || !request.payload.passwrd) {
		message = 'Missing email or password';
	} else {
		var password_input = request.payload.passwrd;
		var email_input = request.payload.email;
		var isView = request.payload.view === 'true';
		
		scurvy.verifyCredentials({email: email_input, passwrd: password_input}, function(err, user) {
			if (user) {
				//It matches!
				console.log('match!');
				request.auth.session.set(user);
				return reply.redirect(internals.redirectAuthenticatedDefault);
			} else {
				//It doesn't match.
				if (isView) {
					console.log('no match is view!');
					return reply.redirect(internals.redirectBadLogin);
				} else {
					console.log('no match is json!');
					//is JSON API format
					message = 'Invalid email or password';
					return reply({ status: 'errors', errors: [message] });
				}
			}
		})
	}
}

internals.register_view = function(request, reply) {
	if (request.auth.isAuthenticated) {
		return reply.redirect(internals.redirectAuthenticatedDefault);
	}

	return reply.view('register', {});
}

internals.login_view = function(request, reply) {
	if (request.auth.isAuthenticated) {
		return reply.redirect(internals.redirectAuthenticatedDefault);
	}

	return reply.view('login', {});
}

internals.logout = function(request, reply) {
    request.auth.session.clear();
    return reply.redirect('/');
}

exports.logout = internals.logout;
exports.login = internals.login;
exports.login_view = internals.login_view;
exports.register_view = internals.register_view
exports.confirm = internals.confirm;
exports.register = internals.register;

exports.setURI = internals.setURI;

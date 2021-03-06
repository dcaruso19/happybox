var Sequelize = require('sequelize');
var async = require('async');

var db_config_to_use = '';
switch (process.env.NODE_ENV) {
    case 'test_travis':
        db_config_to_use = '../../config/database.test_travis';
        break;
	case 'test':
		db_config_to_use = '../../config/database.test';
        break;
    case undefined:
    case 'production':
    case 'development':
        db_config_to_use = '../../config/database';
        break;
}
var dbconfig = require(db_config_to_use).config;

var dbname = dbconfig.db;
var dbhostname = dbconfig.hostname;
var dbport = dbconfig.port;
var dbuser = dbconfig.user;
var dbpassword = dbconfig.password;

var sequelize = new Sequelize(dbname, dbuser, dbpassword, {
    host: dbhostname,
    port: dbport
});

//list all faire models that will be loaded
var models = [
    {
        name: 'memory',
        file: 'memory'
    }
];

models.forEach(function(model) {
    module.exports[model.name] = sequelize.import(__dirname + '/' + model.file);
});

module.exports.init = function(virt_modules, done) {
    for (var i = 0; i < virt_modules.length; i++) {
        virt_modules[i].loadModels(module.exports);
    }

    (function(model) {
        //scurvy associations
        var scurvy = require('../').Scurvy;
        scurvy.setupAssociations(model);

        //faire associations
        model.user.hasMany(model.memory);
        model.memory.belongsTo(model.user);
		
		//testing config
		var syncConfig = {};
		switch (process.env.NODE_ENV) {
			case 'test_travis':
			case 'test':
				console.log('*** TEST MODE');
				syncConfig = { force: true };
				break;
		}
        //create tables if they don't already exist
		sequelize.sync(syncConfig).then(function() {
			console.log('Successfully completed HappyBox sync()!');
			done();
		}).catch(function(error) {
			console.log('Error during HappyBox sync(): ', error);
			done();
		});
    })(module.exports);
};

module.exports.sequelize = sequelize;

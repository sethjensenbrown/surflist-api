exports.CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || 'http://localhost:3000');
exports.TEST_DATABASE_URL = (process.env.TEST_DATABASE_URL);
exports.DATABASE_URL = (process.env.DATABASE_URL ||
					   global.DATABASE_URL);
exports.PORT = (process.env.PORT || 8080);
exports.SENDINBLUE_API_KEY = process.env.SENDINBLUE_API_KEY; 


const pgPromise = require('pg-promise')
const initOptions = {
	promiseLib: Promise
}

let ssl = null

const pgp = pgPromise(initOptions)
const client = pgp(getConnection())

function getConnection() {
	var connection
  
	if (process.env.NODE_ENV == "development") {
		connection = {
			host: process.env.PG_HOST,
			port: 5432,
			database: process.env.PG_DB,
			user: process.env.PG_USER,
			password: process.env.PG_PASSWORD
		}
	} else {
		connection = {
			connectionString: process.env.DATABASE_URL,
			ssl: { rejectUnauthorized: false }
		}
	}
  
	return connection
}

exports.Client = client
exports.pgpErrors = pgp.errors
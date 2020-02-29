const { ItemType, Festival, Rarity, Season, SSRRate } = require('../services/constants.js')

// Set up database connection
const pgPromise = require('pg-promise')
const initOptions = {
	promiseLib: Promise
}

const pgp = pgPromise(initOptions)
const client = pgp(getConnection())

class Cache {
	characterWeapons = {}
	nonCharacterWeapons = {}
	summons = {}

	isExpired = this.isExpired.bind(this)
	lastUpdated = new Date(0)
	ttl = 1000 * 60 * 60 * 24 * 4 // 4 days in milliseconds

	constructor() {
		this.fetchAllCharacterWeapons()
		this.fetchAllNonCharacterWeapons()
		this.fetchAllSummons()
	}

	// Cache methods
	isExpired() {
		return (this.lastUpdated.getTime() + this.ttl) < new Date().getTime()
	}

	resetCache() {
		this.lastUpdated = new Date(0)
	}

	// Batch fetching methods
	fetchAllCharacterWeapons() {
		this.fetchCharacterWeapons(Rarity.R)
		this.fetchCharacterWeapons(Rarity.SR)
		this.fetchCharacterWeapons(Rarity.SSR)
	}

	fetchAllNonCharacterWeapons() {
		this.fetchNonCharacterWeapons(Rarity.R)
		this.fetchNonCharacterWeapons(Rarity.SR)
		this.fetchNonCharacterWeapons(Rarity.SSR)
	}

	fetchAllSummons() {
		this.fetchSummons(Rarity.R)
		this.fetchSummons(Rarity.SR)
		this.fetchSummons(Rarity.SSR)
	}

	// Fetching methods
	fetchCharacterWeapons(rarity) {
		let sql = "SELECT * FROM gacha WHERE item_type = 0 AND rarity = $1 AND recruits IS NOT NULL"

		client.any(sql, [rarity])
			.then(data => {
				this.characterWeapons[rarity] = data
			})
			.catch(error => {
				console.log(error)
			})
	}

	fetchNonCharacterWeapons(rarity) {
		let sql = "SELECT * FROM gacha WHERE item_type = 0 AND rarity = $1 AND recruits IS NULL"

		client.any(sql, [rarity])
			.then(data => {
				this.characterWeapons[rarity] = data
			})
			.catch(error => {
				console.log(error)
			})
	}

	fetchSummons(rarity) {
		let sql = "SELECT * FROM gacha WHERE item_type = 1 AND rarity = $1"

		client.any(sql, [rarity])
			.then(data => {
				this.characterWeapons[rarity] = data
			})
			.catch(error => {
				console.log(error)
			})
	}
}

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
		connection = process.env.DATABASE_URL
	}
  
	return connection
}

exports.Cache = Cache
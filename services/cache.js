const { ItemType, Festival, Rarity, Season, SSRRate } = require('../services/constants.js')

// Set up database connection
const pgPromise = require('pg-promise')
const initOptions = {
	promiseLib: Promise
}

const pgp = pgPromise(initOptions)
const client = pgp(getConnection())

class Cache {
	_characterWeapons = {}
	_nonCharacterWeapons = {}
	_summons = {}

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

	// Subset retrieval methods
	characterWeapons(rarity, gala = null, season = null) {
		return this._characterWeapons[rarity].filter(item => this.filterItem(item, gala, season))
	}

	summons(rarity, gala = null, season = null) {
		return this._summons[rarity].filter(item => this.filterItem(item, gala, season))
	}

	filterItem(item, gala = null, season = null) {
		if (season != null && gala != null) {
			return item[season] == 1 && item[gala] == 1
		} else if (gala != null && season == null) {
			return item[gala] == 1
		} else if (season != null && gala == null) {
			return item[season] == 1
		} else {
			return item["premium"] == 1
		}
	}

	limitedWeapons(gala) {
		var limitedWeapons = []

		if (gala == Festival.FLASH) {
			limitedWeapons = this._characterWeapons[Rarity.SSR].filter(item => {
				return item.flash == 1 && item.premium == 0
			})
		} else if (gala == Festival.LEGEND) {
			limitedWeapons = this._characterWeapons[Rarity.SSR].filter(item => {
				return item.legend == 1 && item.premium == 0
			})
		}

		return limitedWeapons
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

	// Single fetching methods
	fetchItem(rarity, gala, season) {
		let mappedRarity = this.mapRarity(rarity)
		let set = [
			...this._characterWeapons[mappedRarity].filter(item => this.filterItem(item, gala, season)), 
			...this._nonCharacterWeapons[mappedRarity].filter(item => this.filterItem(item, gala, season)), 
			...this._summons[mappedRarity].filter(item => this.filterItem(item, gala, season))
		]
		let rand = Math.floor(Math.random() * set.length)

		return set[rand]
	}

	fetchWeapon(rarity, season = null) {
		let mappedRarity = this.mapRarity(rarity)
		let list = this.characterWeapons(mappedRarity, null, season)
		let r = Math.floor(Math.random() * list.length)

		return list[r]
	}

	fetchSummon(rarity, season = null) {
		let mappedRarity = this.mapRarity(rarity)
		let list = this.summons(mappedRarity, null, season)
		let r = Math.floor(Math.random() * list.length)

		return list[r]
	}

	fetchLimited(gala) {
		let list = this.characterWeapons(Rarity.SSR, gala, null)
		let r = Math.floor(Math.random() * list.length)

		return list[r]
	}

	mapRarity(rarity) {
		switch(rarity.int) {
			case 1:
				return Rarity.R
			case 2:
				return Rarity.SR
			case 3:
				return Rarity.SSR
		}
	}

	// Fetching methods
	fetchCharacterWeapons(rarity) {
		let sql = "SELECT * FROM gacha WHERE item_type = 0 AND rarity = $1 AND recruits IS NOT NULL"

		client.any(sql, [rarity])
			.then(data => {
				this._characterWeapons[rarity] = data
			})
			.catch(error => {
				console.log(error)
			})
	}

	fetchNonCharacterWeapons(rarity) {
		let sql = "SELECT * FROM gacha WHERE item_type = 0 AND rarity = $1 AND recruits IS NULL"

		client.any(sql, [rarity])
			.then(data => {
				this._nonCharacterWeapons[rarity] = data
			})
			.catch(error => {
				console.log(error)
			})
	}

	fetchSummons(rarity) {
		let sql = "SELECT * FROM gacha WHERE item_type = 1 AND rarity = $1"

		client.any(sql, [rarity])
			.then(data => {
				this._summons[rarity] = data
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
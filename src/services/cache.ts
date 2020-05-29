import { Festival, Rarity, Result } from './constants.js'

const { Client } = require('./connection.js')

type ItemMap = { [key: number]: Result[] }

class Cache {
	_characterWeapons: ItemMap = {}
	_nonCharacterWeapons: ItemMap = {}
	_summons: ItemMap = {}

	// isExpired = this.isExpired.bind(this)
	lastUpdated = new Date(0)
	ttl = 1000 * 60 * 60 * 24 * 4 // 4 days in milliseconds

	public constructor() {
		this.fetchAllCharacterWeapons()
		this.fetchAllNonCharacterWeapons()
		this.fetchAllSummons()
	}

	// Cache methods
	private isExpired() {
		return (this.lastUpdated.getTime() + this.ttl) < new Date().getTime()
	}

	private resetCache() {
		this.lastUpdated = new Date(0)
	}

	// Subset retrieval methods
	public characterWeapons(rarity: Rarity, gala: string | null = null, season: string | null = null) {
		return this._characterWeapons[rarity].filter(item => this.filterItem(item, gala, season))
	}

	public summons(rarity: Rarity, gala: string | null = null, season: string | null = null) {
		return this._summons[rarity].filter(item => this.filterItem(item, gala, season))
	}

	public filterItem(item: Result, gala: string | null = null, season: string | null = null) {
		if (season != null && gala != null) {
			return item[season] == true && item[gala] == true

		} else if (gala != null && season == null) {
			return item[gala] == true

		} else if (season != null && gala == null) {
			return item[season] == true
			
		} else {
			return item['premium'] == true
		}
	}

	public limitedWeapons(gala: string) {
		let limitedWeapons: Result[] = []

		if (gala == Festival.FLASH) {
			limitedWeapons = this._characterWeapons[Rarity.SSR].filter(item => {
				return item.flash == true && item.premium == false
			})
		} else if (gala == Festival.LEGEND) {
			limitedWeapons = this._characterWeapons[Rarity.SSR].filter(item => {
				return item.legend == true && item.premium == false
			})
		}

		return limitedWeapons
	}

	// Batch fetching methods
	private fetchAllCharacterWeapons() {
		this.fetchCharacterWeapons(Rarity.R)
		this.fetchCharacterWeapons(Rarity.SR)
		this.fetchCharacterWeapons(Rarity.SSR)
	}

	private fetchAllNonCharacterWeapons() {
		this.fetchNonCharacterWeapons(Rarity.R)
		this.fetchNonCharacterWeapons(Rarity.SR)
		this.fetchNonCharacterWeapons(Rarity.SSR)
	}

	private fetchAllSummons() {
		this.fetchSummons(Rarity.R)
		this.fetchSummons(Rarity.SR)
		this.fetchSummons(Rarity.SSR)
	}

	// Single fetching methods
	public fetchItem(rarity: Rarity, gala: string | null, season: string | null) {
		const set = [
			...this._characterWeapons[rarity].filter(item => this.filterItem(item, gala, season)), 
			...this._nonCharacterWeapons[rarity].filter(item => this.filterItem(item, gala, season)), 
			...this._summons[rarity].filter(item => this.filterItem(item, gala, season))
		]
		const rand = Math.floor(Math.random() * set.length)

		return set[rand]
	}

	public fetchWeapon(rarity: Rarity, season: string | null = null) {
		const list = this.characterWeapons(rarity, null, season)
		const r = Math.floor(Math.random() * list.length)

		return list[r]
	}

	public fetchSummon(rarity: Rarity, season: string | null = null) {
		const list = this.summons(rarity, null, season)
		const r = Math.floor(Math.random() * list.length)

		return list[r]
	}

	public fetchLimited(gala: string) {
		const list = this.characterWeapons(Rarity.SSR, gala, null)
		const r = Math.floor(Math.random() * list.length)

		return list[r]
	}

	// Fetching methods
	private fetchCharacterWeapons(rarity: Rarity) {
		const sql = [
			'SELECT * FROM gacha',
			'WHERE item_type = 0 AND rarity = $1',
			'AND recruits IS NOT NULL'
		].join(' ')

		Client.any(sql, rarity)
			.then((data: Result[]) => {
				this._characterWeapons[rarity] = data
			})
			.catch((error: Error) => {
				console.log(error)
			})
	}

	private fetchNonCharacterWeapons(rarity: Rarity) {
		const sql = [
			'SELECT * FROM gacha',
			'WHERE item_type = 0 AND rarity = $1',
			'AND recruits IS NULL'
		].join(' ')

		Client.any(sql, rarity)
			.then((data: Result[]) => {
				this._nonCharacterWeapons[rarity] = data
			})
			.catch((error: Error) => {
				console.log(error)
			})
	}

	private fetchSummons(rarity: Rarity) {
		let sql = [
			'SELECT * FROM gacha',
			'WHERE item_type = 1 AND rarity = $1'
		].join(' ')

		Client.any(sql, rarity)
			.then((data: Result[]) => {
				this._summons[rarity] = data
			})
			.catch((error: Error) => {
				console.log(error)
			})
	}
}

exports.Cache = Cache
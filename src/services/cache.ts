import { Festival, Rarity, Item } from './constants.js'

const { Client } = require('./connection.js')

type ItemMap = { [key: number]: Item[] }

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
	// private isExpired() {
	// 	return (this.lastUpdated.getTime() + this.ttl) < new Date().getTime()
	// }

	// private resetCache() {
	// 	this.lastUpdated = new Date(0)
	// }

	// Subset retrieval methods
	public characterWeapons(rarity: Rarity, gala: string | null = null, season: string | null = null) {
		return this._characterWeapons[rarity].filter(item => this.filterItem(item, gala, season))
	}

	public summons(rarity: Rarity, gala: string | null = null, season: string | null = null) {
		return this._summons[rarity].filter(item => this.filterItem(item, gala, season))
	}

	public filterItem(item: Item, gala: string | null = null, season: string | null = null) {
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
		let limitedWeapons: Item[] = []

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
			.then(() => {
				this.fetchCharacterWeapons(Rarity.SR)
			})
			.then(() => {
				this.fetchCharacterWeapons(Rarity.SSR)
			})
	}

	private fetchAllNonCharacterWeapons() {
		this.fetchNonCharacterWeapons(Rarity.R)
			.then(() => {
				this.fetchNonCharacterWeapons(Rarity.SR)
			})
			.then(() => {
				this.fetchNonCharacterWeapons(Rarity.SSR)
			})
	}

	private async fetchAllSummons() {
		this.fetchSummons(Rarity.R)
			.then(() => {
				this.fetchSummons(Rarity.SR)
			})
			.then(() => {
				this.fetchSummons(Rarity.SSR)
			})
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

	public fetchWeapon(rarity: Rarity, season: string | null = null, exclusions: Item[]) {
		const list = this.characterWeapons(rarity, null, season).filter((item: Item) => !exclusions.includes(item))
		const r = Math.floor(Math.random() * list.length)

		return list[r]
	}

	public fetchSummon(rarity: Rarity, season: string | null = null, exclusions: Item[]) {
		const list = this.summons(rarity, null, season).filter((item: Item) => !exclusions.includes(item))
		const r = Math.floor(Math.random() * list.length)

		return list[r]
	}

	public fetchLimited(gala: string, exclusions: Item[]) {
		const list = this.limitedWeapons(gala).filter((item: Item) => !exclusions.includes(item))
		const r = Math.floor(Math.random() * list.length)

		return list[r]
	}

	// Fetching methods
	private async fetchCharacterWeapons(rarity: Rarity) {
		const sql = [
			'SELECT * FROM gacha',
			'WHERE item_type = 0 AND rarity = $1',
			'AND recruits IS NOT NULL'
		].join(' ')

		await Client.any(sql, rarity)
			.then((data: Item[]) => {
				this._characterWeapons[rarity] = data
			})
			.catch((error: Error) => {
				console.log(error)
			})
	}

	private async fetchNonCharacterWeapons(rarity: Rarity) {
		const sql = [
			'SELECT * FROM gacha',
			'WHERE item_type = 0 AND rarity = $1',
			'AND recruits IS NULL'
		].join(' ')

		await Client.any(sql, rarity)
			.then((data: Item[]) => {
				this._nonCharacterWeapons[rarity] = data
			})
			.catch((error: Error) => {
				console.log(error)
			})
	}

	private async fetchSummons(rarity: Rarity) {
		const sql = [
			'SELECT * FROM gacha',
			'WHERE item_type = 1 AND rarity = $1'
		].join(' ')

		await Client.any(sql, rarity)
			.then((data: Item[]) => {
				this._summons[rarity] = data
			})
			.catch((error: Error) => {
				console.log(error)
			})
	}
}

exports.Cache = Cache
// Constants
export const SSRRate = 3.0
export const RollsInSpark = 300

// Enums
export enum Festival {
    LEGEND = 'legend',
    FLASH  = 'flash'
}

export enum Season {
    VALENTINES = 'valentines',
    SUMMER     = 'summer',
    HALLOWEEN  = 'halloween',
    HOLIDAY    = 'holiday'
}

export enum ItemType {
	WEAPON = 0,
	SUMMON = 1
}

export enum GachaBucket {
    WEAPON  = 1,
    SUMMON  = 2,
    LIMITED = 3,
    RATEUP  = 4
}

export enum Rarity {
	R   = 1,
	SR  = 2,
	SSR = 3
}

// Interfaces
export interface Item {
    [index: string]: string | number | boolean | null
    id: string
    name: string
    recruits: string | null
    rarity: number
    item_type: number | null
    premium: boolean
    flash: boolean
    legend: boolean
    halloween: boolean
    holiday: boolean
    summer: boolean
    valentines: boolean
}

export interface Result {
    rate: number
}
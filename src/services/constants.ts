import { Message } from 'discord.js'

// Constants
export const SSRRate = 3.0
export const RollsInSpark = 300

// Enums
export enum Festival {
    LEGEND = 'legend',
    FLASH  = 'flash'
}

export enum Season {
    VALENTINE  = 'valentine',
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

export enum Element {
    fire,
    water,
    earth,
    wind,
    light,
    dark,
    null
}

export enum Race {
    human,
    erune,
    draph,
    harvin,
    primal,
    other
}

export enum Specialty {
    sword,
    dagger,
    spear,
    axe,
    gun,
    bow,
    staff,
    harp,
    fist,
    katana
}

export enum UnitType {
    attack,
    defense,
    heal,
    balanced,
    special
}

export interface Ougi {
    name: string
    description: string 
}

export interface Stat {
    min: number
    max: number
    flb: number
    ulb: number
}

export interface Ability {
    name: string
    cooldown: AbilityNumber
    duration: Duration
    descriptions: AbilityDescription[]
}

export interface AbilityNumber {
    initial: number
    upgraded: number
}

export interface AbilityDescription {
    text: string
    level: number
}

export interface Duration {
    turns: AbilityNumber
    time: AbilityNumber
}

export interface SupportAbility {
    name: string
    description: string
}

export enum Gender {
    male,
    female
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
    valentine: boolean
}

export interface Result {
    rate: number
}

export interface PromptResult {
    message: Message | null,
    selection: Item
}

export interface ParsedRequest {
    name: string,
    gala: string | null,
    season: string | null
}
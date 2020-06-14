import { Ability, AbilityNumber, AbilityDescription, Duration, SupportAbility, Ougi, Stat } from '../services/constants'
import { Element, Gender, Race, Rarity, Specialty, UnitType } from '../services/constants'

const util = require('util')

interface BilingualObject {
    en: string
    jp: string
}

interface CharacterStat {
    atk: Stat
    hp: Stat
    abilityCount: number
    ougiCount: number
}

type StringResult = { [key: string]: String }

export class Character {
    id: string = ''
    name: BilingualObject = {
        en: '',
        jp: ''
    }
    title: BilingualObject = {
        en: '',
        jp: ''
    }
    seiyuu: BilingualObject = {
        en: '',
        jp: ''
    }
    // add flb and ulb dates
    releaseDate: string = ''
    gender: Gender = Gender.female
    element: Element = Element.null
    rarity: Rarity = Rarity.R
    type: UnitType = UnitType.balanced
    race: Race = Race.other
    specialty: Specialty[] = []
    stats: CharacterStat = {
        atk: {
            min: 0,
            max: 0,
            flb: 0,
            ulb: 0
        },
        hp: {
            min: 0,
            max: 0,
            flb: 0,
            ulb: 0
        },
        abilityCount: 0,
        ougiCount: 0
    }
    ougis: Ougi[] = []
    abilities: Ability[] = []
    supportAbilities: SupportAbility[] = []

    public static parse(parts: any): Character {
        let char: Character = new Character()

        for (let i in parts) {
            const part = parts[i]
            const name = part.name
            const value = (typeof part.value === 'string') ? part.value.trim() : part.value

            switch(name) {
                case 'id':
                    char.id = value
                    break
                case 'name':
                    char.name.en = value
                    break
                case 'jpname':
                    char.name.jp = value
                    break
                case 'title': 
                    char.title.en = value
                    break
                case 'jptitle': 
                    char.title.jp = value
                    break
                case 'va':
                    char.seiyuu.en = value
                    break
                case 'jpva': 
                    char.seiyuu.jp = value
                    break
                case 'release_date':
                    char.releaseDate = value
                    break
                case 'rarity':
                    char.rarity = this.mapRarity(value)
                    break
                case 'element':
                    char.element = this.mapElement(value)
                    break
                case 'race':
                    char.race = this.mapRace(value)
                    break
                case 'weapon':
                    char.specialty = this.mapSpecialty(value)
                    break
                case 'type':
                    char.type = this.mapUnitType(value)
                    break
                case 'min_atk':
                    char.stats.atk.min = parseInt(value)
                    break
                case 'max_atk':
                    char.stats.atk.max = parseInt(value)
                    break
                case 'flb_atk':
                    char.stats.atk.flb = parseInt(value)
                    break
                case 'min_hp':
                    char.stats.hp.min = parseInt(value)
                    break
                case 'max_hp':
                    char.stats.hp.max = parseInt(value)
                    break
                case 'flb_hp':
                    char.stats.hp.flb = parseInt(value)
                    break
                case 'abilitycount':
                    char.stats.abilityCount = parseInt(value)
                    break
                case 'ougi_count':
                    char.stats.ougiCount = parseInt(value)
                    break
                default:
                    break
            }
        }

        char.ougis = this.parseOugis(char.stats.ougiCount, parts)
        char.abilities = this.parseAbilities(char.stats.abilityCount, parts)

        return char
    }

    private static parseAbilities(count: number, parts: any): Ability[] {
        let abilities: Ability[] = []

        for (let i = 0; i < count; i++) {
            const index = i + 1

            let nameKey = `a${index}_name`
            let cooldownKey = `a${index}_cd`
            let durationKey = `a${index}_dur`
            let descriptionKey = `a${index}_effdesc`

            const keys = [nameKey, cooldownKey, durationKey, descriptionKey]
            abilities.push(this.parseAbility(keys, parts))
        }

        return abilities
    }

    private static parseAbility(keys: string[], parts: any): Ability {
        const found = parts.filter((part: any) => keys.includes(part.name))
        
        let name: string = ''
        let descriptions: AbilityDescription[] = []

        let cooldown: AbilityNumber = {
            initial: 0,
            upgraded: 0
        }
        let duration: Duration = {
            turns: {
                initial: 0,
                upgraded: 0
            },
            time: {
                initial: 0,
                upgraded: 0
            }
        }
        
        for (let i in found) {
            const item = found[i]

            if (item.name.includes('name')) {
                name = item.value
            } else if (item.name.includes('cd')) {
                const initial = item.value.template.part.filter((item: StringResult) => item.name === 'cooldown')
                const upgraded = item.value.template.part.filter((item: StringResult) => item.name === 'cooldown1')

                cooldown.initial = parseInt(initial[0].value)
                
                if (upgraded.length > 0) { 
                    cooldown.upgraded = parseInt(upgraded[0].value)
                }
            } else if (item.name.includes('dur')) {
                for (let j in item.value.template) {
                    const d = item.value.template[j]

                    if (d.title === 'InfoDur') {
                        const type = d.part[0].value
                        const value = parseInt(d.part[1].value)

                        if (type === 't' && duration.turns.initial == 0) {
                            duration.turns.initial = value
                        } else if (type === 't' && duration.turns.initial != 0) {
                            duration.turns.upgraded = value
                        } else if (type === 's' && duration.time.initial == 0) {
                            duration.time.initial = value
                        } else if (type === 's' && duration.time.initial != 0) {
                            duration.time.upgraded = value
                        }
                    }
                }
            } else if (item.name.includes('effdesc')) {
                // console.log(item.value.template.part)

                const numDescriptions = parseInt(item.value.template.part[0].value) + 1

                for (let i = 0; i < numDescriptions; i++) {
                    let levelKey = ''
                    let descriptionKey = ''

                    if (i == 0) {
                        levelKey = 'level'
                        descriptionKey = 'des'
                    } else {
                        levelKey = `level${i}`
                        descriptionKey = `des${i}`
                    }

                    const keys = [levelKey, descriptionKey]
                    descriptions.push(this.parseDescription(keys, item.value.template.part))
                }
            }
        }

        return {
            name: name,
            cooldown: cooldown,
            duration: duration,
            descriptions: descriptions
        }
    }


    private static parseDescription(keys: string[], parts: any): AbilityDescription {
        const found = parts.filter((part: any) => keys.includes(part.name))
        
        let level: number = 0
        let description: string = ''

        for (let i in found) {
            const item = found[i]

            if (item.name.includes('level')) {
                level = parseInt(item.value)
            } else if (item.name.includes('des')) {
                // console.log(util.inspect(item.value, false, null, true /* enable colors */))
                if (item.value._) {
                    // TODO: When an ability or ougi has linked statuses, 
                    // we are going to have to rebuild them.
                    description = this.br2nl(item.value._)
                } else {
                    description = 'Effect enhanced.'
                }
            }
        }

        return {
            text: description,
            level: level
        }
    }

    private static parseOugis(count: number, parts: any): Ougi[] {
        let ougis: Ougi[] = []

        for (let i = 0; i < count; i++) {
            const index = i + 1

            let nameKey = ''
            let labelKey = ''
            let descriptionKey = ''

            if (i == 0) {
                nameKey = 'ougi_name'
                labelKey = 'ougi_label'
                descriptionKey = 'ougi_desc'
            } else {
                nameKey = `ougi${index}_name`
                labelKey = `ougi${index}_label`
                descriptionKey = `ougi${index}_desc`
            }

            const keys = [nameKey, labelKey, descriptionKey]
            ougis.push(this.parseOugi(keys, parts))
        }

        return ougis
    }

    private static parseOugi(keys: string[], parts: any): Ougi {
        const found = parts.filter((part: any) => keys.includes(part.name))
        
        let name: string = ''
        let description: string = ''

        for (let i in found) {
            const item = found[i]

            if (item.name.includes('name')) {
                name = item.value
            } else if (item.name.includes('desc')) {
                if (typeof item.value === 'string') {
                    description = this.br2nl(item.value)
                } else {
                    // TODO: When an ability or ougi has linked statuses, 
                    // we are going to have to rebuild them.
                    description = this.br2nl(item.value._)
                }
            }
        }

        return {
            name: name,
            description: description
        }
    }

    private static mapElement(value: string) {
        const element = value.toLowerCase()

        switch(element) {
            case 'fire':
                return Element.fire
            case 'water':
                return Element.water
            case 'earth':
                return Element.earth
            case 'wind':
                return Element.wind
            case 'light':
                return Element.light
            case 'dark':
                return Element.dark
            default:
                return Element.null
        }
    }

    private static mapRace(value: string) {
        const race = value.toLowerCase()

        switch(race) {
            case 'human':
                return Race.human
            case 'erune':
                return Race.erune
            case 'draph':
                return Race.draph
            case 'harvin':
                return Race.harvin
            case 'primal':
                return Race.primal
            default:
                return Race.other
        }
    }

    private static mapRarity(rarity: string) {
        switch(rarity) {
            case 'SSR':
                return 3
            case 'SR':
                return 2
            case 'R': 
                return 1
            default:
                return 0
        }
    }

    private static mapSpecialty(value: string) {
        const values = value.toLowerCase().split(',')

        let specialties: Specialty[] = []
        for (let i in values) {
            const specialty = values[i]

            switch(specialty) {
                case 'sword':
                    specialties.push(Specialty.sword)
                    break
                case 'dagger':
                    specialties.push(Specialty.dagger)
                    break
                case 'spear':
                    specialties.push(Specialty.spear)
                    break
                case 'axe':
                    specialties.push(Specialty.axe)
                    break
                case 'staff':
                    specialties.push(Specialty.staff)
                    break
                case 'gun':
                    specialties.push(Specialty.gun)
                    break
                case 'bow':
                    specialties.push(Specialty.bow)
                    break
                case 'harp':
                    specialties.push(Specialty.harp)
                    break
                case 'katana':
                    specialties.push(Specialty.katana)
                    break
                case 'fist':
                    specialties.push(Specialty.fist)
                    break
                default:
                    specialties.push(Specialty.sword)
                    break
            }
        }

        return specialties
    }

    private static mapUnitType(value: string) {
        const unitType = value.toLowerCase()

        switch(unitType) {
            case 'attack':
                return UnitType.attack
            case 'defense':
                return UnitType.defense
            case 'heal':
                return UnitType.heal
            case 'special':
                return UnitType.special
            case 'balanced':
                return UnitType.balanced
            default:
                return UnitType.balanced
        }
    }

    private static br2nl(str: string): string {
        return str.replace(/<br\s*\/?>/mg,"\n");
    }
}
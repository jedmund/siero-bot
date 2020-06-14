import { Ability, AbilityNumber, AbilityDescription, Duration, SupportAbility, Ougi, Stat } from '../services/constants'
import { Element, Gender, Race, Rarity, Specialty, UnitType } from '../services/constants'

const xml2js = require('xml2js')
const jsdom = require('jsdom')
const { JSDOM } = jsdom

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

type AnyResult = { [key: string]: any }
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

    xml: string
    dom = new JSDOM('')

    public constructor(xml: string) {
        this.xml = xml
    }

    public async extract(xml: string): Promise<AnyResult> {
        const parser = new xml2js.Parser({
            explicitArray: false,
            normalize: true
        })

        return await parser.parseStringPromise(xml)
            .then((result: any) => {
                return result.root.template[1].part
            })
            .catch((error: Error) => {
                console.log(error)
            })
    }

    public async parse() {
        let parts = await this.extract(this.xml)

        for (let i in parts) {
            const part = parts[i]
            const name = part.name
            const value = (typeof part.value === 'string') ? part.value.trim() : part.value

            switch(name) {
                case 'id':
                    this.id = value
                    break
                case 'name':
                    this.name.en = value
                    break
                case 'jpname':
                    this.name.jp = value
                    break
                case 'title': 
                    this.title.en = value
                    break
                case 'jptitle': 
                    this.title.jp = value
                    break
                case 'va':
                    this.seiyuu.en = value
                    break
                case 'jpva': 
                    this.seiyuu.jp = value
                    break
                case 'release_date':
                    this.releaseDate = value
                    break
                case 'rarity':
                    this.rarity = this.mapRarity(value)
                    break
                case 'element':
                    this.element = this.mapElement(value)
                    break
                case 'race':
                    this.race = this.mapRace(value)
                    break
                case 'weapon':
                    this.specialty = this.mapSpecialty(value)
                    break
                case 'type':
                    this.type = this.mapUnitType(value)
                    break
                case 'min_atk':
                    this.stats.atk.min = parseInt(value)
                    break
                case 'max_atk':
                    this.stats.atk.max = parseInt(value)
                    break
                case 'flb_atk':
                    this.stats.atk.flb = parseInt(value)
                    break
                case 'min_hp':
                    this.stats.hp.min = parseInt(value)
                    break
                case 'max_hp':
                    this.stats.hp.max = parseInt(value)
                    break
                case 'flb_hp':
                    this.stats.hp.flb = parseInt(value)
                    break
                case 'abilitycount':
                    this.stats.abilityCount = parseInt(value)
                    break
                case 'ougi_count':
                    this.stats.ougiCount = parseInt(value)
                    break
                default:
                    break
            }
        }

        // this.ougis = this.parseOugis(this.stats.ougiCount, parts)
        this.abilities = this.parseAbilities(this.stats.abilityCount, parts)
    }

    private parseAbilities(count: number, parts: any): Ability[] {
        // Parse out ability descriptions
        const abilityDescriptions = this.extractAbilitiesFromXml()

        let abilities: Ability[] = []

        for (let i = 0; i < count; i++) {
            const index = i + 1

            let nameKey = `a${index}_name`
            let cooldownKey = `a${index}_cd`
            let durationKey = `a${index}_dur`

            const keys = [nameKey, cooldownKey, durationKey]
            abilities.push(this.parseAbility(keys, parts, abilityDescriptions[i]))
        }

        return abilities
    }

    private parseAbility(keys: string[], parts: any, descriptions: AbilityDescription[]): Ability {
        const found = parts.filter((part: any) => keys.includes(part.name))
        
        let name: string = ''

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
            }
        }

        return {
            name: name,
            cooldown: cooldown,
            duration: duration,
            descriptions: descriptions
        }
    }

    public extractAbilitiesFromXml(): AbilityDescription[][] {
        const inputXml = `<?xml version="1.0" encoding="UTF-8"?>${this.xml}`
        const domParser: DOMParser = new this.dom.window.DOMParser()
        const parsed: XMLDocument = domParser.parseFromString(inputXml, 'application/xml')
        
        const rootNode = parsed.getElementsByTagName('root')[0]
        const targetNode: Node = rootNode.childNodes[1]

        return this.extractAbilities(targetNode)
    }

    public extractAbilities(target: Node): AbilityDescription[][] {
        const xpath1: string = '//template/part/name[contains(text(), "effdesc")]'
        const descriptionParentNode = this.dom.window.document.evaluate(xpath1, target, null, 7, null)

        let ads: AbilityDescription[][] = []

        for (let i = 0; i < descriptionParentNode.snapshotLength; i++) {
            let node = descriptionParentNode.snapshotItem(i)

            if (node && node.parentNode) {
                // make abilitydescription
                let texts: string[] = this.extractXMLData('des', node.parentNode) as string[]
                let levels: number[] = this.extractXMLData('level', node.parentNode) as number[]

                ads.push(this.mergeAbilityDescriptionsWithUpgradeLevels(texts, levels))
            }
        }

        return ads
    }
    
    private mergeAbilityDescriptionsWithUpgradeLevels(descriptions: string[], levels: number[]): AbilityDescription[] {
        let abilityDescriptions: AbilityDescription[] = []
        for (let i = 0; i < descriptions.length; i++) {
            const level = (i > 0 && levels[i - 1]) ? levels[i - 1] : 0

            abilityDescriptions.push({
                text: descriptions[i],
                level: level
            })
        }

        return abilityDescriptions
    }

    public extractXMLData(key: string, target: Node,): Array<string | number> {
        const xpath: string = `.//part/name[contains(text(), "${key}")]`
        const targetNode = this.dom.window.document.evaluate(xpath, target, null, 7, null)
            
        let values = []
        for (let i = 0; i < targetNode.snapshotLength; i++) {
            let node = targetNode.snapshotItem(i)
            if (node && node.parentNode && node.parentNode.querySelector('value')) {
                let childList = node.parentNode.querySelector('value')?.childNodes
                let valueArray = [''].slice.call(childList)
                let fragment = valueArray.reduce(this.reduceNode, '')

                if (parseInt(fragment)) {
                    values.push(parseInt(fragment))
                } else {
                    values.push(this.br2nl(fragment))
                }
            }
        }

        return values
    }

    private parseOugis(count: number, parts: any): Ougi[] {
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

    private parseOugi(keys: string[], parts: any): Ougi {
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

    // Mapping methods
    private mapElement(value: string) {
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

    private mapRace(value: string) {
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

    private mapRarity(rarity: string) {
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

    private mapSpecialty(value: string) {
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

    private mapUnitType(value: string) {
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

    // Helper methods
    private br2nl(str: string): string {
        return str.replace(/<br\s*\/?>/mg,"\n");
    }

    public clean(): any {
        const { dom, xml, ...char } = this
        return char
    }

    private reduceNode(previousValue: string, currentValue: any): string {
        const node: Node = currentValue as Node
        const accumulatedValue: string = previousValue
        let string = ''

        if (node.nodeName !== 'ext') {
            if (node.nodeType === 1 && node.childNodes[1].textContent) {
                string = node.childNodes[1].textContent
            } else if (node.nodeType === 3 && node.textContent) {
                string = node.textContent
            }
        }

        return accumulatedValue + string
    }
}
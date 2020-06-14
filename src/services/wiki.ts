import { Character } from '../classes/character'

const MWBot = require('mwbot')
const xml2js = require('xml2js')

const util = require('util')

type AnyResult = { [key: string]: any }

export class Wiki {
    apiUrl: string = 'https://gbf.wiki/api.php'
    bot: any

    public constructor() {
        console.log('In the wiki service...')

        this.bot = new MWBot({
            apiUrl: this.apiUrl
        })

        this.fetchCharacter('Anila')
    }

    public fetchCharacter(name: string) {
        const options: { [key: string]: string } = {
            action: 'parse',
            page: name,
            prop: 'parsetree'
        }

        const parser = new xml2js.Parser({
            explicitArray: false,
            normalize: true
        })

        this.bot.request(options)
            .then((response: AnyResult) => {
                return response.parse.parsetree['*']
            })
            .then((xml: string) => {
                console.log(xml)
                return parser.parseStringPromise(xml)
            })
            .then((result: AnyResult) => {
                const parts: any = result.root.template[1].part
                const character: Character = Character.parse(parts)
                // console.log(util.inspect(character, false, null, true /* enable colors */))
            })
    }

    // private emptyCharacter() {
    //     return {
    //         id: '',
    //         name: {
    //             en: '',
    //             jp: ''
    //         },
    //         title: {
    //             en: '',
    //             jp: ''
    //         },
    //         seiyuu: {
    //             en: '',
    //             jp: ''
    //         },
    //         gender: Gender.female,
    //         releaseDate: '',
    //         element: Element.null,
    //         rarity: Rarity.R,
    //         type: UnitType.attack,
    //         race: Race.other,
    //         specialty: [],
    //         stats: {
    //             atk: {
    //                 min: 0,
    //                 max: 0,
    //                 flb: 0
    //             },
    //             hp: {
    //                 min: 0,
    //                 max: 0,
    //                 flb: 0
    //             },
    //             abilityCount: 0,
    //             ougiCount: 0
    //         },
    //         ougis: [],
    //         abilities: [],
    //         supportAbilities: []
    //     }
    // }
}
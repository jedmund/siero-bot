import { Character } from '../classes/character'

const MWBot = require('mwbot')

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

        this.bot.request(options)
            .then((response: AnyResult) => {
                return response.parse.parsetree['*']
            })
            .then((xml: string) => {
                const character: Character = new Character(xml)
                character.parse().then(() => {
                    console.log(util.inspect(character.clean(), false, null, true))
                })
            })
    }
}
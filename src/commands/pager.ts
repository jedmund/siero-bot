import { Message } from 'discord.js'
import { SieroCommand } from '../helpers/SieroCommand'
import { Page, Pager } from '../services/pager'

class PagerCommand extends SieroCommand {
    constructor() {
        super('pager', {
            aliases: ['pager']
        })
    }

    exec(message: Message) {
        let pager: Pager = new Pager('Hello, World!', message.author)
        let homePage: Page = new Page('This is the home page.')
        let configPage: Page = new Page('This is the config page.')
        let helpPage: Page = new Page('This is the help page.')

        pager.addPage('🏠', homePage)
        pager.addPage('🛠', configPage)
        pager.addPage('❓', helpPage)

        // pager.selectPage('🛠')
        pager.listPages()

        pager.render(message)
    }

}

module.exports = PagerCommand
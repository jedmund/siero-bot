import { Message } from 'discord.js'
import { SieroCommand } from '../helpers/SieroCommand'

import dayjsPluginUTC from 'dayjs-plugin-utc'

const dayjs = require('dayjs')
dayjs.extend(dayjsPluginUTC)

class TimeCommand extends SieroCommand {
    public constructor() {
        super('time', {
            aliases: ['time']
        })
    }

    public exec(message: Message) {
        this.log(message)

        const japanTime = dayjs().utcOffset(540).format('**h:mm A** on **dddd MMMM DD, YYYY**')
        message.channel.send(`It's currently ${japanTime} in Japan.`)
    }
}

module.exports = TimeCommand

const { Listener } = require('discord-akairo');

class messageReactionAddedListener extends Listener {
    constructor() {
        super('messageReactionAdd', {
            event: 'messageReactionAdd',
            emitter: 'client',
            category: 'client'
        });
    }

    async exec(reaction, user) {
        // console.log(`${user.username} reacted with ${reaction._emoji.name}`)
    }
}

module.exports = messageReactionAddedListener;
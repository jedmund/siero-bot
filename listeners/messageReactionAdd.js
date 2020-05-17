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
        console.log(`${user.username} reacted with ${reaction._emoji.name}`)
        // const message = reaction.message;

        // if (message.id === '710764645316821004' && reaction.emoji === '✅') {
        //     this.client.channels.cache.get('694607365462294668').send(`Thank you for your reaction <@${user.id}>`);
        // }
    }
}

module.exports = messageReactionAddedListener;
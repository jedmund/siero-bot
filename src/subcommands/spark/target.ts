import { Client, pgpErrors } from '../../services/connection.js'
import { Message, MessageEmbed, User } from 'discord.js'
import common from '../../helpers/common.js'
import decision from '../../helpers/decision.js'

type NumberResult = { [key: string]: number }

interface Result {
    id: string
    name: string
    recruits: string | null
    rarity: number
    item_type: number | null
}

enum Method {
    id,
    name
}

class Target {
    userId: string
    operation: string | null = null
    targetName: string | null = null
    isUnreleased: boolean = false

    message: Message
    deciderMessage: Message | null = null
    firstMention: User | null = null

    public constructor(message: Message) {
        this.userId = message.author.id
        this.message = message
        this.parseRequest(message.content)
    }

    public execute() {
        this.switchOperation()
    }

    private parseRequest(request: string) {
        let splitRequest = request.split(' ').splice(2)

        this.firstMention = this.message.mentions.users.values().next().value

        if (splitRequest.length > 0) {
            this.operation = splitRequest.shift()!
        }

        if (splitRequest.indexOf('unreleased') >= 0) {
            this.isUnreleased = true
            splitRequest.splice(splitRequest.indexOf('unreleased', 1)).join(' ')
        }

        this.targetName = splitRequest.join(' ')
    }

    private switchOperation() {
        switch(this.operation) {
            case 'show':
                this.show()
                break
            case 'set':
                this.set()
                break
            case 'reset':
                this.reset()
                break
            case 'clear':
                this.reset()
                break
            default:
                this.show()
                break
        }
    }
    
    // Command methods
    private async show() {
        let id = (this.firstMention) ? this.firstMention.id : this.userId
        let isOwnTarget = (id === this.userId) ? true : false

        return await Target.fetch(id, this.message)
            .then((data: Result) => {
                this.message.channel.send(this.render(data))
            })
            .catch((error: Error) => {
                var text
                var documentation = false
                
                if (error instanceof pgpErrors.QueryResultError) {
                    text = `It looks like ${(isOwnTarget) ? 'you haven\'t' : this.firstMention!.username + ' hasn\'t'} set a spark target yet!`
                    
                    if (isOwnTarget) {
                        documentation = true
                    } else {
                        documentation = false
                    }
                } else {
                    text = 'Sorry, there was an error communicating with the database for your last request.'
                }

                let section = (isOwnTarget) ? {
                    title: 'Setting a spark target',
                    content: [
                        '```html\n',
                        '<target set @item>',
                        'Set the provided @item as your spark target',
                        '```'
                    ].join('\n')
                } : null

                common.reportError(this.message, this.userId, 'target', error, text, documentation, section)
            })
    }

    private set() {
        this.reset(false)

        if (this.isUnreleased) {
            this.setAmbiguousTarget()
        } else {
            this.setTarget()
        }
    }

    private async reset(reply = true) {
        let sql = `UPDATE sparks SET target_id = NULL, target_memo = NULL WHERE user_id = $1`
    
        return await Client.query(sql, this.userId)
            .then(() => {
                if (reply) {
                    this.message.reply('Your spark target has been reset!')
                }
            })
    }

    // Render methods
    private render(target: Result) {
        let isOwnTarget = this.firstMention == null
        let rarity = common.mapRarity(target.rarity)

        var itemType: string = ''
        if (target.item_type == 0) {
            itemType = ' Weapon'
        } else if (target.item_type == 1) {
            itemType = ' Summon'
        }

        var string = `<${rarity}${itemType}> ${target.name}`
        if (target.recruits != null) {
            string += ` (${target.recruits})`
        }

        return new MessageEmbed({
            title: `${(isOwnTarget) ? 'Your' : this.firstMention!.username + '\'s'} spark target`,
            description: `\`\`\`html\n${string}\n\`\`\``,
            color: 0xdc322f
        })
    }

    // Database methods
    public static async fetch(id: string, message: Message) {
        const sql = [
            'SELECT sparks.target_id AS id, gacha.name, gacha.recruits, gacha.rarity, gacha.item_type FROM sparks',
            'LEFT JOIN gacha ON sparks.target_id = gacha.id',
            'WHERE user_id = $1 AND sparks.target_id IS NOT NULL'
        ].join(' ')

        return await Client.one(sql, id)
            .catch((error: Error) => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(message, id, 'rateup', error, text)
            })
    }

    private async saveTarget() {
        let sql = this.buildSaveQuery(Method.name)
        
        Client.one(sql, [this.targetName, this.userId])
            .then((data: Result) => {
                this.message.channel.send(this.render(data))
            })
            .catch((error: Error) => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, 'target', error, text)
            })
    }

    private async saveTargetById(targetId: string) {
        let sql = this.buildSaveQuery(Method.id)

        Client.one(sql, [targetId, this.userId])
            .then((data: Result) => {
                this.deciderMessage?.edit(this.render(data))

                if (this.message.channel.type !== 'dm') {
                    this.message.reactions.removeAll().catch(error => console.error('Failed to clear reactions: ', error))
                }
            })
            .catch((error: Error) => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, 'target', error, text)
            })
    }

    private async setAmbiguousTarget() {
        let sql = [
            'UPDATE sparks SET target_memo = $1',
            'WHERE user_id = $2'
        ].join(' ')

        Client.any(sql, [this.targetName, this.userId])
            .then(() => {
                let fauxData = {
                    id: '',
                    name: `${this.targetName} (unreleased)`,
                    recruits: null,
                    rarity: 3,
                    item_type: null
                }

                this.message.channel.send(this.render(fauxData))
            })
            .catch((error: Error) => {
                let text = 'Sorry, there was an error communicating with the database for your last request.'
                common.reportError(this.message, this.userId, 'target', error, text)
            })
    }

    // Helper methods
    private buildSaveQuery(method: Method) {
        return [
            'UPDATE sparks SET target_id = (',
            'SELECT id FROM gacha',
            `WHERE ${(method == Method.name ? 'name' : 'id')} = $1`,
            'LIMIT 1)',
            'WHERE user_id = $2 RETURNING',
            '(SELECT name FROM gacha WHERE id = target_id),',
            '(SELECT recruits FROM gacha WHERE id = target_id),',
            '(SELECT rarity FROM gacha WHERE id = target_id),',
            '(SELECT item_type FROM gacha WHERE id = target_id)'
        ].join(' ')
    }
    private async setTarget() {
        let sql = [
            'SELECT COUNT(*)',
            'FROM gacha',
            'WHERE name = $1 OR recruits = $1'
        ].join(' ')

        return await Client.any(sql, this.targetName)
            .then((data: NumberResult[]) => {
                return data[0].count
            })
            .then((count: number) => {
                if (count > 1) {
                    this.resolveDuplicate()
                } else if (count == 1) {
                    this.saveTarget()
                } else {
                    common.missingItem(this.message, this.userId, 'target', this.targetName)
                }
            })
    }
    
    private async resolveDuplicate() {
        let sql = [
            'SELECT id, name, recruits, rarity, item_type',
            'FROM gacha',
            'WHERE name = $1 OR recruits = $1'
        ].join(' ')

        var results: Result[]
        return await Client.any(sql, this.targetName)
            .then((data: Result[]) => {
                results = data
                return decision.buildDuplicateEmbed(data, this.targetName)
            })
            .then((embed: MessageEmbed) => {
                return this.message.channel.send(embed)
            })
            .then((newMessage: Message) => {
                this.deciderMessage = newMessage
                decision.addOptions(this.deciderMessage, results.length)

                return decision.receiveSelection(this.deciderMessage, this.userId)
            })
            .then((selection: number) => {
                this.saveTargetById(results[selection].id)
            })
            .catch((error: Error) => {
                let text = `Sorry, there was an error with your last request.`
                common.reportError(this.message, this.userId, 'target', error, text)
            })
    }
}

exports.Target = Target
import { Client } from '../../services/connection.js'
import { Message, MessageEmbed, User } from 'discord.js'
import { Item, PromptResult } from '../../services/constants.js'
import { Decision as decision } from '../../helpers/decision.js'

import common from '../../helpers/common.js'
const dayjs = require('dayjs')

type NumberResult = { [key: string]: number }

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

        this.targetName = common.parse(splitRequest.join(' '))
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

        const documentation: boolean = (isOwnTarget) ? true : false
        const errorSection = (isOwnTarget) ? {
            title: 'Setting a spark target',
            content: [
                '```html\n',
                '<target set @item>',
                'Set the provided @item as your spark target',
                '```'
            ].join('\n')
        } : null

        return await Target.fetch(id)
            .then((data: Item | null) => {
                if (data) {
                    this.message.channel.send(this.render(data))
                } else {
                    const text = `It looks like ${(isOwnTarget) ? 'you haven\'t' : this.firstMention!.username + ' hasn\'t'} set a spark target yet!`
                    const errorMessage: string = `(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${this.userId}] Spark not set: ${this.message.content}`
                    common.reportError(this.message, this.userId, 'target', errorMessage, text, documentation, errorSection)
                }
            })
            .catch((_: Error) => {
                const text = 'Sorry, there was an error communicating with the database for your last request.'
                const errorMessage: string = `(${dayjs().format('YYYY-MM-DD HH:mm:ss')}) [${this.userId}] Spark not set: ${this.message.content}`
                common.reportError(this.message, this.userId, 'target', errorMessage, text, documentation, errorSection)
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
    private render(target: Item) {
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
    public static async fetch(id: string) {
        const sql = [
            'SELECT sparks.target_id AS id, gacha.name, gacha.recruits, gacha.rarity, gacha.item_type FROM sparks',
            'LEFT JOIN gacha ON sparks.target_id = gacha.id',
            'WHERE user_id = $1 AND sparks.target_id IS NOT NULL'
        ].join(' ')

        return await Client.oneOrNone(sql, id)
    }

    private async saveTarget() {
        let sql = this.buildSaveQuery(Method.name)
        
        Client.one(sql, [this.targetName, this.userId])
            .then((data: Item) => {
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
            .then((data: Item) => {
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
                    item_type: null,
                    premium: true,
                    flash: true,
                    legend: true,
                    halloween: true,
                    holiday: true,
                    summer: true,
                    valentine: true
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
        return await decision.resolveDuplicate(this.targetName!, this.message, this.deciderMessage, this.userId)
            .then((result: PromptResult) => {
                this.deciderMessage = result.message
                this.saveTargetById(result.selection.id)
            })
            .catch((error: Error) => {
                let text = `Sorry, there was an error with your last request.`
                common.reportError(this.message, this.userId, 'target', error, text)
            })
    }
}

exports.Target = Target
import { Message } from 'discord.js'

const { Client } = require('../../services/connection.js')
const { MessageEmbed } = require('discord.js')

const common = require('../../helpers/common.js')

interface Result {
    username: string,
    crystals: number,
    tickets: number,
    ten_tickets: number,
    target_memo: string,
    last_updated: Date,
    name: string,
    recruits: string
}

enum Sort {
    Ascending,
    Descending
}

class Leaderboard {
    guildId: string
    order: Sort

    public constructor(guildId: string, order: string = 'desc') {
        this.guildId = guildId
        this.order = (order === 'desc') ? Sort.Descending : Sort.Ascending
    }

    public async fetchData() {
        let sql = [
            `SELECT username, crystals, tickets, ten_tickets,`,
            `target_memo, last_updated, gacha.name, gacha.recruits`,
            `FROM sparks LEFT JOIN gacha`,
            `ON sparks.target_id = gacha.id`,
            `WHERE last_updated > NOW() - INTERVAL '14 days'`,
            `AND guild_ids @> $1`
        ].join(' ')

        let wrappedGuildId = '{' + this.guildId + '}'
        return await Client.query(sql, wrappedGuildId)
            .then((response: Result[]) => {
                return this.render(response)
            })
    }

    // Render methods
    private render(data: Result[]) {
        let leaderboardTitle = 'Leaderboard (Last 14 days)'
        let loserboardTitle = '~~Leader~~ Loserboard (Last 14 days)'

        if (data.length == 0) {
            return 'No one has updated their sparks in the last two weeks!'
        } else {
            let rows = (this.order == Sort.Descending) ? 
                data.sort(this.compareProgress.bind(this)) : 
                data.sort(this.compareProgress.bind(this)).reverse()


            let maxRows = (rows.length > 10) ? 10 : rows.length

            let usernameMaxChars = 14
            let numDrawsMaxChars = 11
            let targetMaxChars = 16

            let divider = '+-----+' + '-'.repeat(usernameMaxChars + 2) + '+' + '-'.repeat(numDrawsMaxChars + 1) + '+' + '-'.repeat(targetMaxChars + 2) + '+\n'
            var result = divider

            for (var i = 0; i < maxRows; i++) {
                let numDraws = common.calculateDraws(rows[i].crystals, rows[i].tickets, rows[i].ten_tickets)

                let spacedUsername = common.spacedString(rows[i].username, usernameMaxChars)
                let spacedDraws = common.spacedString(`${numDraws} draws`, numDrawsMaxChars)

                var spacedTarget = ''
                if (rows[i].recruits == null && rows[i].name == null && rows[i].target_memo != null) {
                    spacedTarget = common.spacedString(`${rows[i].target_memo} (U)`, targetMaxChars)
                } else if (rows[i].recruits != null || rows[i].name != null) {
                    if (rows[i].recruits != null) {
                        spacedTarget = common.spacedString(rows[i].recruits, targetMaxChars)
                    } else if (rows[i].name != null) {
                        spacedTarget = common.spacedString(rows[i].name, targetMaxChars)
                    }
                } else {
                    spacedTarget = common.spacedString('', targetMaxChars)
                }

                let place = ((i + 1) < 10) ? `${i + 1}  ` : `${i + 1} `

                result += `| #${place}| ${spacedUsername} | ${spacedDraws}| ${spacedTarget} |\n`
                result += divider
            }
            
            return new MessageEmbed({
                title: (this.order == Sort.Descending) ? leaderboardTitle : loserboardTitle,
                description: `\`\`\`html\n${result}\n\`\`\``,
                color: 0xb58900
            })
        }
    }

    // Helper methods
    private compareProgress(a: Result, b: Result, order: Sort = Sort.Descending) {
        let aDraws = common.calculateDraws(a.crystals, a.tickets, a.ten_tickets)
        let bDraws = common.calculateDraws(b.crystals, b.tickets, b.ten_tickets)

        let comparison = 0
        if (aDraws > bDraws) {
            comparison = 1
        } else if (aDraws < bDraws) {
            comparison = -1
        }

        return (
            (order == Sort.Descending) ? (comparison * -1) : comparison
        )
    }
}

exports.Leaderboard = Leaderboard
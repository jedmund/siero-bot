import { EmbedBuilder } from "discord.js"
import { sql } from "kysely"
import { container } from "@sapphire/framework"

import { Client } from "./connection.js"
import { spacedString } from "../utils/formatting.js"

interface Result {
  user_id: string
  crystals: number
  tickets: number
  ten_tickets: number
}

enum Sort {
  Ascending,
  Descending,
}

class Leaderboard {
  guildId: string
  userIds: string[] = []
  order: Sort

  public constructor(guildId: string, order: string = "desc") {
    this.guildId = guildId
    this.order = order === "desc" ? Sort.Descending : Sort.Ascending
  }

  public async execute() {
    const data = await this.fetchData()
    return await this.render(data)
  }

  public async fetchData() {
    return await Client.selectFrom("sparks")
      .select(["crystals", "tickets", "ten_tickets", "user_id"])
      .where((eb) => {
        const guildCheck = sql`${this.guildId} = ANY(sparks.guild_ids)`
        const dateCheck = sql`updated_at > NOW() - INTERVAL '14 days'`
        return eb.and([guildCheck, dateCheck])
      })
      .execute()
  }

  // Render methods
  private async render(data: Result[]) {
    const { client: sapphire } = container
    const leaderboardTitle = "Leaderboard (Last 14 days)"
    const loserboardTitle = "~~Leader~~ Loserboard (Last 14 days)"

    if (data.length == 0) {
      return new EmbedBuilder()
        .setTitle("No sparks")
        .setDescription(
          "No one has updated their sparks in the last two weeks!"
        )
    } else {
      const rows =
        this.order == Sort.Descending
          ? data.sort(this.compareProgress.bind(this))
          : data.sort(this.compareProgress.bind(this)).reverse()

      const maxRows = rows.length > 10 ? 10 : rows.length

      const usernameMaxChars = 20
      const numDrawsMaxChars = 10

      const divider =
        "+-----+" +
        "-".repeat(usernameMaxChars + 2) +
        "+" +
        "-".repeat(numDrawsMaxChars + 2) +
        "+\n"
      let result = divider

      for (let i = 0; i < maxRows; i++) {
        const place = i + 1 < 10 ? `${i + 1} ` : `${i + 1}`

        const user = await sapphire.users
          .fetch(`${rows[i].user_id}`)
          .catch((e) => console.error(e))

        const numDraws = this.calculateDraws(
          rows[i].crystals,
          rows[i].tickets,
          rows[i].ten_tickets
        )

        const spacedUsername = spacedString(
          user ? user.username : rows[i].user_id,
          usernameMaxChars
        )
        const spacedDraws = spacedString(`${numDraws} draws`, numDrawsMaxChars)

        result += `| #${place} | ${spacedUsername} | ${spacedDraws} |\n`
        result += divider
      }

      return new EmbedBuilder()
        .setTitle(
          this.order == Sort.Descending ? leaderboardTitle : loserboardTitle
        )
        .setDescription(`\`\`\`html\n${result}\n\`\`\``)
        .setColor(0xb58900)
    }
  }

  // Helper methods
  private calculateDraws(
    crystals: number,
    tickets: number,
    tenTickets: number
  ) {
    const ticketValue = tickets * 300
    const tenTicketValue = tenTickets * 3000
    const totalCrystalValue = crystals + ticketValue + tenTicketValue

    return Math.floor(totalCrystalValue / 300)
  }

  private compareProgress(a: Result, b: Result, order: Sort = Sort.Descending) {
    const aDraws = this.calculateDraws(a.crystals, a.tickets, a.ten_tickets)
    const bDraws = this.calculateDraws(b.crystals, b.tickets, b.ten_tickets)

    let comparison = 0
    if (aDraws > bDraws) {
      comparison = 1
    } else if (aDraws < bDraws) {
      comparison = -1
    }

    return order == Sort.Descending ? comparison * -1 : comparison
  }
}

export default Leaderboard

import { EmbedBuilder } from "discord.js"
import { sql } from "kysely"
import { container } from "@sapphire/framework"

import { Client } from "./connection"
import { spacedString } from "../utils/formatting"

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
      .where(sql`${this.guildId} = ANY(sparks.guild_ids)`)
      .where(sql`updated_at >NOW() - INTERVAL '14 days'`)
      .execute()
  }

  // Render methods
  private async render(data: Result[]) {
    const { client: sapphire } = container
    let leaderboardTitle = "Leaderboard (Last 14 days)"
    let loserboardTitle = "~~Leader~~ Loserboard (Last 14 days)"

    if (data.length == 0) {
      return new EmbedBuilder()
        .setTitle("No sparks")
        .setDescription(
          "No one has updated their sparks in the last two weeks!"
        )
    } else {
      let rows =
        this.order == Sort.Descending
          ? data.sort(this.compareProgress.bind(this))
          : data.sort(this.compareProgress.bind(this)).reverse()

      let maxRows = rows.length > 10 ? 10 : rows.length

      let usernameMaxChars = 20
      let numDrawsMaxChars = 10

      let divider =
        "+-----+" +
        "-".repeat(usernameMaxChars + 2) +
        "+" +
        "-".repeat(numDrawsMaxChars + 2) +
        "+\n"
      var result = divider

      for (var i = 0; i < maxRows; i++) {
        let place = i + 1 < 10 ? `${i + 1} ` : `${i + 1}`

        const user = await sapphire.users
          .fetch(`${rows[i].user_id}`)
          .catch((e) => console.error(e))

        console.log(user)

        let numDraws = this.calculateDraws(
          rows[i].crystals,
          rows[i].tickets,
          rows[i].ten_tickets
        )

        let spacedUsername = spacedString(
          user ? user.username : rows[i].user_id,
          usernameMaxChars
        )
        let spacedDraws = spacedString(`${numDraws} draws`, numDrawsMaxChars)

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
    let ticketValue = tickets * 300
    let tenTicketValue = tenTickets * 3000
    let totalCrystalValue = crystals + ticketValue + tenTicketValue

    return Math.floor(totalCrystalValue / 300)
  }

  private compareProgress(a: Result, b: Result, order: Sort = Sort.Descending) {
    let aDraws = this.calculateDraws(a.crystals, a.tickets, a.ten_tickets)
    let bDraws = this.calculateDraws(b.crystals, b.tickets, b.ten_tickets)

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

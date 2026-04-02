import { CRYSTALS_PER_TICKET, CRYSTALS_PER_TEN_TICKET } from "./constants.js"

export function calculateDraws(
  crystals: number,
  tickets: number,
  tenTickets: number
): number {
  const ticketValue = tickets * CRYSTALS_PER_TICKET
  const tenTicketValue = tenTickets * CRYSTALS_PER_TEN_TICKET
  const totalCrystalValue = crystals + ticketValue + tenTicketValue

  return Math.floor(totalCrystalValue / CRYSTALS_PER_TICKET)
}

import Api from "../services/api.js"
import { ItemRateMap } from "./types.js"

export default async function fetchRateups(user_id: string) {
  let rateups: ItemRateMap = await Api.fetchRateups(user_id)

  if (rateups.length === 0 && process.env.DEFAULT_RATEUP_USER_ID) {
    rateups = await Api.fetchRateups(process.env.DEFAULT_RATEUP_USER_ID)
  }

  return rateups
}

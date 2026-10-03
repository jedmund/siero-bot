import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { compileSimulation, drawableIdentity } from "./reference/simulation.js"
import type DrawableItem from "../src/interfaces/DrawableItem.js"
import { Promotion, Season } from "../src/utils/enums.js"

await test(
  "Ruby compiler matches TypeScript for all pools, seasons and typed custom rates",
  { skip: !process.env.HENSEI_API_WORKTREE },
  () => {
    const items: DrawableItem[] = [1, 2, 3].flatMap((rarity) =>
      (["characterWeapon", "weapon", "summon"] as const).flatMap(
        (category, index) =>
          ["ordinary", ...Object.values(Season)].map((season, seasonIndex) => {
            const id = `00000000-0000-0000-0000-${String(rarity * 100 + index * 10 + seasonIndex).padStart(12, "0")}`
            return {
              id,
              item_id: id,
              drawableId: id,
              drawableType:
                category === "summon"
                  ? ("Summon" as const)
                  : ("Weapon" as const),
              type: category === "summon" ? 1 : 0,
              granblue_id: String(rarity * 100 + index * 10 + seasonIndex),
              name: { en: id, jp: "" },
              rarity,
              element: 1,
              drawCategory: category,
              promotions: {
                premium: seasonIndex === 0,
                classic: seasonIndex === 0,
                classic_ii: seasonIndex === 0,
                classic_iii: seasonIndex === 0,
                flash: false,
                legend: false,
              },
              seasons: {
                valentines: season === "valentines",
                summer: season === "summer",
                halloween: season === "halloween",
                holiday: season === "holiday",
                formal: season === "formal",
              },
            }
          }),
      ),
    )
    const configurations = Object.values(Promotion).flatMap((mode) =>
      (mode.startsWith("classic")
        ? [undefined]
        : [undefined, ...Object.values(Season)]
      ).flatMap((season) =>
        [[], [{ item: items.find((i) => i.rarity === 3)!, rate: 0.3 }]].map(
          (rateups) => ({ gala: mode, season, rateups }),
        ),
      ),
    )
    const promotionIds = {
      premium: 1,
      classic: 2,
      classic_ii: 3,
      flash: 4,
      legend: 5,
      classic_iii: 12,
    }
    const seasonIds = {
      valentines: 6,
      summer: 7,
      halloween: 8,
      holiday: 9,
      formal: 11,
    }
    const snapshot = {
      fingerprint: "parity",
      loaded_at: 0,
      items: items.map((item) => ({
        identity: drawableIdentity(item),
        drawable_type: item.drawableType,
        rarity: item.rarity,
        category: item.drawCategory,
        promotions: [
          ...Object.entries(promotionIds)
            .filter(
              ([key]) => item.promotions[key as keyof typeof item.promotions],
            )
            .map(([, id]) => id),
          ...Object.entries(seasonIds)
            .filter(([key]) => item.seasons[key as keyof typeof item.seasons])
            .map(([, id]) => id),
        ],
      })),
    }
    const input = {
      snapshot,
      configurations: configurations.map((config) => ({
        mode: config.gala,
        season: config.season,
        rateups: config.rateups.map((rate) => ({
          identity: drawableIdentity(rate.item),
          percent: rate.rate,
        })),
      })),
    }
    const script = `require 'json'; require 'active_support/all'; Dir['app/services/gacha_simulation/{validation_error,configuration,catalogue,compiler}.rb'].each { |file| require_relative file }; input = JSON.parse(STDIN.read); puts JSON.generate(input['configurations'].map { |config| GachaSimulation::Compiler.new(input['snapshot'], GachaSimulation::Configuration.normalize(config)).compile })`
    const results = JSON.parse(
      execFileSync("bundle", ["exec", "ruby", "-e", script], {
        cwd: process.env.HENSEI_API_WORKTREE,
        input: JSON.stringify(input),
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      }),
    ) as {
      ordinary: { item: { identity: string }; probability: string }[]
      guaranteed: { item: { identity: string }; probability: string }[]
    }[]
    configurations.forEach((config, index) => {
      const typescript = compileSimulation(
        { id: "parity", loadedAt: "0", items },
        config,
      )
      for (const slot of ["ordinary", "guaranteed"] as const) {
        const ruby = new Map(
          results[index][slot].map((entry) => [
            entry.item.identity,
            Number(entry.probability),
          ]),
        )
        assert.equal(ruby.size, typescript[slot].length)
        for (const entry of typescript[slot])
          assert.ok(
            Math.abs(
              ruby.get(drawableIdentity(entry.item))! - entry.probability,
            ) < 1e-12,
          )
      }
    })
  },
)

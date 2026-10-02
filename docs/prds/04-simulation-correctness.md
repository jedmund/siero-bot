# Simulation correctness

Status: Planned

Repository: siero-bot

Dependencies: Catalogue contract from [PRD 03](03-hensei-catalogue-integration.md)

Parent: [Overall plan](../plan.md)

## Problem and outcome

Current gala rarity weights total 0.97, truthy promotion strings force the 6 percent allocation path for premium/classic, and cached rate-up exclusions compare object identity. Pool counts and actual selection also use different promotion filters. Build a deterministic-testable engine whose reported probabilities match its eligible item distribution.

## Requirements

- Separate the simulation engine from database loading and Discord rendering. Supply an immutable catalogue snapshot, explicit banner configuration, validated rate-ups, and an injectable random source.
- Use one probability unit internally and convert user percentages once at the boundary. Reject non-finite, negative, or over-budget probabilities.
- Use explicit banner modes for SSR budgets; never infer gala from the truthiness of a string. Confirm current game rules for rarity rates, ten-part guarantees, and limited-item weighting before encoding them, and record the sources and verification date.
- Build the eligible item set once and use it for counting, weighting, and selection. Handle ordinary, limited, seasonal, and Classic I/II/III membership consistently. Classic III catalogue population is owned by PRD 03; consume it through the shared Classic configuration rather than introducing a separate engine. Formal metadata must survive the model; Collab requires explicit rules before simulation is enabled.
- Compare and exclude items by typed UUID identity. Rate-up items receive exactly their configured probability, not an extra chance through ordinary buckets.
- Use character season/series only for classification where needed; an ordinary item may carry multiple seasonal availability promotions without being a seasonal-exclusive character.
- Handle empty buckets and exhausted residual budgets explicitly, avoiding division by zero, negative counts, or undefined draws.
- Return the effective configuration and rates with results so rendering and rerun actions reflect the actual simulation.

## Acceptance and validation

- Deterministic tests cover all supported banners, season combinations, rarity guarantees, rate-up allocations, and boundary probabilities.
- Each complete distribution sums to one within a documented tolerance; every selected item belongs to the eligible pool.
- Tests reproduce and prevent truthy-enum allocation, double-counted rate-ups, incorrect classic selection, and empty-bucket failures.
- A seeded statistical sanity check may supplement exact distribution tests, but unseeded flaky sampling is not the primary proof.
- Invalid configurations return actionable errors before any draws or writes occur.

## Rollout and exclusions

Document corrected behavior and explicitly acknowledge that prior simulated results may have been biased. Do not rewrite historical messages. This task does not fetch live banner rates or change the rate-up database schema.

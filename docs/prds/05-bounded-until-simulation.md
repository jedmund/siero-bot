# Bounded roll until simulation

Status: Planned  
Repository: siero-bot  
Dependencies: [PRD 04](04-simulation-correctness.md) for final eligibility and draw behavior; an immediate execution guard can land earlier  
Parent: [Overall plan](../plan.md)

## Problem and outcome

Roll-until uses a synchronous unbounded loop and matches names. An unreachable target can block the entire bot, and duplicate names can report the wrong success. Make the command responsive and guarantee that every run ends in success, a clear limit result, cancellation, or an error.

## Requirements

- Resolve the target to one typed UUID and verify it has a positive probability in the effective configuration before starting.
- Do not silently switch promotion/season and proceed without disclosing the effective configuration. If a valid alternative can be proposed, explain it in the response.
- Define finite draw-count and elapsed-time limits, plus a per-user concurrency policy. Select documented defaults using measured performance and Discord interaction lifetime limits.
- Process bounded batches with event-loop yields, or use a worker if profiling justifies it. Check cancellation and shutdown between batches.
- Match success by identity. Preserve and document whether counts represent complete purchased ten-part draws or the exact position inside a draw; align cost calculation with that choice.
- Restrict disambiguation and cancellation controls to the initiating user, acknowledge their interactions, and remove or disable controls on completion or timeout.
- Await all execution and response promises so command-level error handling observes failures.
- Label monetary estimates and the exchange-rate basis. Do not present the existing hardcoded conversion as a current quote.

## Acceptance and validation

- An unavailable target terminates before sampling; repeated misses terminate at the configured limit.
- A forced-success fixture returns the correct identity and count, including duplicate-name cases.
- A mocked long run allows unrelated event-loop work to proceed.
- Cancellation, shutdown, timeout, repeated clicks, and database lookup errors leave no active collector or simulation.
- Limit responses say no match was found within the limit; they do not claim the item can never be drawn.

## Rollout and exclusions

Ship a hard limit early, then integrate the corrected engine. No unbounded compatibility mode is retained. Analytic probability estimates and large-scale Monte Carlo features are outside this task.

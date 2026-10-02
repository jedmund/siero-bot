# Durable raid scheduling

Status: Planned

Repositories: siero-bot and hensei-api in a separate worktree

Dependencies: [PRD 08](08-startup-and-interaction-lifecycle.md); additive raid schema before bot deployment

Parent: [Overall plan](../plan.md)

## Problem and outcome

Raid timers and reaction collectors disappear on restart. Role IDs are hardcoded, final reconciliation discards returned embed updates, and displayed start times can differ from timer deadlines. Preserve scheduled raids and participant state independently of a running process.

## Requirements

- Propose and migrate durable tables for raids, participants, per-guild raid configuration, and notification processing state. Keep these separate from the rate-up identity migration and use a dedicated Hensei worktree/PR.
- Store Discord guild/channel/message IDs, raid kind, creator, one absolute start timestamp, lifecycle status, and participant element selections. Persist state transitions before presenting them as saved.
- Recover open raids after restart. Define whether reactions remain the signup interface or buttons replace them; preserve clear add/remove semantics and ownership rules either way.
- Derive message timestamps and scheduling from the same instant. Define immediate and overdue-raid behavior rather than replaying every stale reminder without a policy.
- Claim due reminders atomically with bounded retries and recovery of abandoned claims. Prevent two workers from sending the same scheduled reminder concurrently.
- Document Discord's uncertain-send boundary: a network timeout can occur after delivery. Use recorded message IDs and a reconciliation strategy where possible; do not claim unconditional exactly-once external delivery.
- Use persistent participants as the normal source for rendering. If reactions remain authoritative for recovery, fetch and paginate them completely, and apply the returned embed rather than discarding it.
- Configure role IDs per guild with appropriate authorization. Validate supported channels and permissions; support cancellation and creator/admin control.
- Handle deleted messages, removed roles, permission loss, and oversized rosters without losing the underlying scheduled state.

## Acceptance and validation

- Restart before a deadline retains the signup sheet and produces the reminder according to the documented delivery policy.
- Two workers cannot independently claim the same active job; a crashed worker's claim can recover.
- Adds/removes near the deadline are reconciled without overlapping finalization edits.
- Displayed and actual start times agree, including nonzero seconds and immediate runs.
- Failure tests cover uncertain sends, deleted messages, forbidden channels, retry exhaustion, and cancellation.

## Rollout and exclusions

Deploy schema before bot readers/writers. Decide how existing in-memory raids finish during the first rollout; they cannot be recovered from a table that did not yet exist. Recurring raid calendars and external scheduling integrations are outside scope.

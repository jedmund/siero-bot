# Startup and interaction lifecycle

Status: Planned

Repository: siero-bot

Dependencies: None; coordinate cache contract with PRD 03

Parent: [Overall plan](../plan.md)

## Problem and outcome

Database work starts inside a cache constructor without being awaited. Some commands perform slow work before responding, and unawaited promises bypass error handling. Make readiness, command ownership, and termination explicit.

## Requirements

- Validate required configuration at startup without logging secret values. Include currently undocumented default rate-up source configuration where retained.
- Replace async constructor side effects with an awaited initialization path. Do not serve simulations until a complete validated catalogue snapshot is ready.
- Refresh the cache through atomic snapshot replacement. Keep the last valid snapshot on refresh failure, expose its age, and prevent overlapping refreshes. Define refresh interval, maximum acceptable staleness, and fail-closed behavior when no usable snapshot exists.
- Acknowledge or defer each slash command and component before slow database/network work. Centralize reply/edit/follow-up handling and avoid second initial replies.
- Filter owned selectors and confirmation controls before accepting them; acknowledge authorized selections and expire controls predictably. Public rerun controls remain usable by others according to their explicit product behavior.
- Await promises from login, commands, persistence, and event handlers, or explicitly handle intentional background work. An EventEmitter registration is not a promise for its callback's completion.
- Provide consistent user-facing errors while retaining diagnostic context in logs. Database failure must not masquerade as an empty catalogue or successful reset.
- On shutdown, stop accepting new work, cancel/drain bounded tasks, stop collectors/timers, close the Discord client, and destroy the database pool.

## Acceptance and validation

- Slow or failed cache initialization cannot expose partially loaded arrays.
- Refresh failure preserves the prior complete snapshot and records degraded readiness/freshness.
- Slow dependency tests still acknowledge interactions promptly; unauthorized clicks cannot steer another user's session.
- Startup, timeout, rejection, and shutdown tests leave no unhandled rejection, leaked connection, or active timer.
- The bot handles expected guild and DM contexts explicitly rather than relying on unchecked channel casts.

## Rollout and exclusions

Land shared lifecycle helpers before migrating all command handlers. Detailed monitoring and deployment runbooks belong to PRD 11; persistent raid job state belongs to PRD 09.

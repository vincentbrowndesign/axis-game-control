# Runtime Boundaries

Axis active runtime is continuity-only.

The active product identity is locked to:

show up
-> participate
-> history grows
-> return tomorrow

Active UX routes may support:

- auth
- check in
- progression
- history
- leaderboard
- organizations
- profiles
- continuity systems

Active UX must not include:

- replay-first UX
- cinematic media systems
- draw overlays
- scrub interfaces
- voice replay tools
- tactical replay layers
- old telemetry UI
- speculative AI surfaces

Archived replay routes must not be mounted, linked, redirected to, or returned as active navigation:

- `/axis-shell`
- `/replay-native`
- `/game-day`
- `/games`
- `/cv-demo`
- `/rf-test`
- `/measures`

Those slugs remain reserved so they cannot accidentally become organization worlds.

The proxy must return 404 for those archived UX route segments even if an old page is accidentally restored under `app/`.

Backend media foundations remain preserved:

- upload APIs
- Mux APIs
- session storage
- replay storage
- timeline metadata
- CV foundations
- processing utilities

Backend systems may store future replay/media metadata, but active UX must not route users into replay-era surfaces until the product explicitly reactivates that layer.

If a new visible feature does not support show up -> participate -> history grows -> return tomorrow, it does not belong in the active runtime product.

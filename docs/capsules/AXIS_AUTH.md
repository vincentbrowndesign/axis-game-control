# Axis Auth v0

Status: Active narrow capability
Build Decision: Build Now

## Product Rule

Axis Auth v0 protects owner-scoped Thread Persistence.

Auth exists so a user can sign in, save exact active threads, reopen those threads across devices, sign out, and switch accounts without leaking another owner's saved work.

Auth is not a profile system, organization system, billing system, memory layer, role system, dashboard, or new Axis mode.

## What Auth Enables

- session restoration
- account creation
- sign in
- sign out
- account switching
- owner-isolated saved thread lists
- owner-isolated saved thread reads and writes
- "Sign in to save" when persistence requires an authenticated owner

## What Auth Does Not Enable

- cross-thread memory
- player memory
- development memory
- profiles
- organizations
- teams
- roles
- billing
- subscriptions
- Data Asset runtime operations
- evidence verification
- dashboard access
- anonymous thread adoption on sign-in

## Current Auth Method

Axis Auth v0 uses the existing Supabase browser client and email/password authentication on the `/axis` page.

The existing `/auth/callback` route remains available for configured email-link or OAuth flows elsewhere in the app, but Axis Auth v0 does not add OAuth, password reset, profiles, or a separate login page to the `/axis` room.

## Thread Persistence Boundary

Thread Persistence APIs remain:

- `GET /api/axis/threads`
- `POST /api/axis/threads`
- `GET /api/axis/threads/[threadId]`
- `POST /api/axis/threads/[threadId]`

The client attaches the current Supabase access token to persistence requests. The server derives the owner from the verified session token. Database owner scope and RLS remain the security boundary.

The conversation API remains unchanged:

```json
{
  "reply": "string",
  "threadBoard": null
}
```

Auth does not add `board_items`, memory objects, player facts, Data Asset records, or BoardSectionObject persistence.

## Owner Change Rule

When the signed-in owner changes, Axis must immediately clear owner-scoped client state before loading the new owner's threads.

Clear:

- saved thread list
- active saved-thread id
- active thread metadata
- loaded owner transcript
- latest restored Thread Board snapshot
- save status

Then fetch the new owner-scoped thread list.

Sign-out follows the same boundary. The local room starts fresh and remains usable without saving.

## Failure Rule

If persistence returns `401`, Axis must not display "Saved."

Axis should:

- keep local messages visible
- show "Sign in to save"
- clear owner-scoped saved thread state when the session is no longer valid
- avoid adopting a local signed-out conversation into an account automatically

## Logging Rule

Axis Auth v0 must not log passwords, tokens, session objects, cookies, or bearer-token presence.

## Acceptance Boundary

Axis Auth v0 passes when:

1. A signed-out user can use the conversation locally.
2. The save state clearly says "Sign in to save."
3. The user can create an account or sign in from the compact `/axis` control.
4. The signed-in account is visible in the header.
5. Sign-out clears owner-scoped thread state and starts a fresh local thread.
6. User A's saved threads do not appear for User B.
7. Direct access to another owner's thread remains denied by the existing persistence API and database boundary.
8. No profile, organization, billing, memory, Data Asset runtime, dashboard, or new mode is introduced.

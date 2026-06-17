# AXIS RECONSTRUCTION: DELETION & CLEANUP GUIDE

**Scope**: Delete abandoned tables, routes, and code. Keep dormant foundations.  
**Date**: 2026-06-07  
**Risk**: HIGH (destructive operations). Must backup before executing.

---

## BACKUP FIRST ⚠️

**Before any deletions, execute this backup plan:**

```bash
# Export full Supabase schema
pg_dump -h {db-host} -U {db-user} -d {db-name} --schema=public > schema_backup_$(date +%Y-%m-%d).sql

# Export table data (CSVs)
psql -c "\COPY axis_sessions TO 'backup_axis_sessions.csv' CSV HEADER"
psql -c "\COPY axis_uploads TO 'backup_axis_uploads.csv' CSV HEADER"
psql -c "\COPY axis_events TO 'backup_axis_events.csv' CSV HEADER"
psql -c "\COPY axis_overlays TO 'backup_axis_overlays.csv' CSV HEADER"

# For each table to delete, export data
psql -c "\COPY sessions TO 'backup_sessions.csv' CSV HEADER"
psql -c "\COPY events TO 'backup_events.csv' CSV HEADER"
psql -c "\COPY snapshots TO 'backup_snapshots.csv' CSV HEADER"
psql -c "\COPY game_sessions TO 'backup_game_sessions.csv' CSV HEADER"
# ... etc for all game-state tables

# Export storage manifests
aws s3 ls s3://axis-replays/ --recursive > backup_axis_replays_manifest.txt
aws s3 ls s3://game-film/ --recursive > backup_game_film_manifest.txt
aws s3 ls s3://session-snapshots/ --recursive > backup_session_snapshots_manifest.txt
aws s3 ls s3://training-frames/ --recursive > backup_training_frames_manifest.txt

# Store backups in secure location (not git, not temp)
# Option 1: S3 backup bucket
# Option 2: Local external drive
# Option 3: Archive service
```

**Store backups for 6 months minimum (regulatory requirement).**

---

## PHASE 1: FIX RISKY POLICIES (SAFE)

**These operations are SAFE and can be done immediately.**

### 1.1 Fix `axis_sessions` Policy

**Current** (DANGEROUS):
```sql
-- Allow all (public, unauthenticated)
CREATE POLICY "Allow all" ON axis_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

**New** (SAFE):
```sql
-- Only user who created the session
CREATE POLICY "User can manage own sessions" ON axis_sessions
  FOR ALL
  USING (auth.uid() = user_id OR current_role = 'service_role')
  WITH CHECK (auth.uid() = user_id OR current_role = 'service_role');
```

**Execution**:
```sql
-- Test in staging first
DROP POLICY "Allow all" ON axis_sessions;
CREATE POLICY "User can manage own sessions" ON axis_sessions
  FOR ALL
  USING (auth.uid() = user_id OR current_role = 'service_role')
  WITH CHECK (auth.uid() = user_id OR current_role = 'service_role');

-- Verify: Query as admin, verify all data still accessible
-- Verify: Try querying as different user, verify access denied
```

**Risk**: LOW (can be reverted quickly)  
**Timeline**: 1 hour

---

### 1.2 Fix Game-State Tables Policies

**Current**:
```sql
-- RLS enabled but no policies = all access denied (or allow all)
```

**Action**: Choose one of:

**Option A: Delete the tables** (recommended for abandoned game-state)
```sql
DROP TABLE IF EXISTS game_events CASCADE;
DROP TABLE IF EXISTS game_players CASCADE;
DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS lineup_segments CASCADE;
DROP TABLE IF EXISTS sub_events CASCADE;
DROP TABLE IF EXISTS review_marks CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS players CASCADE;
```

**Option B: Add restrictive policy** (if tables might be used)
```sql
CREATE POLICY "No one" ON game_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);
```

**Decision**: If no code references these tables, **delete them**.

**Risk**: LOW (can be restored from backup)  
**Timeline**: 1 hour

---

## PHASE 2: DELETE ABANDONED ROUTES (SAFE)

**These routes are archived and should not be accessible.**

### 2.1 Verify No Route References

Check codebase for references:

```bash
# Search for route references
grep -r "/axis-shell" src/
grep -r "/replay-native" src/
grep -r "/game-day" src/
grep -r "/games" src/
grep -r "/cv-demo" src/
grep -r "/rf-test" src/
grep -r "/measures" src/

# Search for old API routes
grep -r "/api/live" src/
grep -r "/api/training-memory" src/
grep -r "/api/roboflow" src/
```

**If zero references found**: Safe to delete.  
**If references found**: Update code first, then delete routes.

### 2.2 Delete Route Files

```bash
# Delete old frontend routes
rm -rf src/app/axis-shell
rm -rf src/app/replay-native
rm -rf src/app/game-day
rm -rf src/app/games
rm -rf src/app/cv-demo
rm -rf src/app/rf-test
rm -rf src/app/measures

# Delete old API routes
rm -rf src/app/api/live
rm -rf src/app/api/training-memory
rm -rf src/app/api/roboflow

# Verify deletion
ls src/app/  # should not show deleted routes
ls src/app/api/  # should not show deleted routes
```

### 2.3 Add 404 Proxy (Optional)

To prevent someone from accidentally recreating old routes, add explicit 404 redirects:

```typescript
// src/middleware.ts (Next.js)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const archivedRoutes = [
    '/axis-shell',
    '/replay-native',
    '/game-day',
    '/games',
    '/cv-demo',
    '/rf-test',
    '/measures',
  ];
  
  if (archivedRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

**Risk**: LOW (can be restored from git)  
**Timeline**: 1 hour

---

## PHASE 3: DELETE UNUSED LIBRARY CODE (MODERATE)

**These utilities reference old tables and routes. Delete after routes deleted.**

### 3.1 Verify No Code References

```bash
# Find all references to old session/event libraries
grep -r "axisChronologyStore" src/
grep -r "sessions" src/ | grep -v "axis_sessions"
grep -r "snapshots" src/ | grep -v "axis_snapshots"
grep -r "training_memories" src/

# Find all imports from old libraries
grep -r "from.*chronology" src/
grep -r "from.*training-memory" src/
```

**If zero references found**: Safe to delete.

### 3.2 Delete Library Files

Based on audit, delete:

```bash
# Delete old chronology library
rm -f src/lib/axisChronologyStore.ts
rm -f src/lib/axis-chronology/**

# Delete old training memory library
rm -f src/lib/axis-training-memory/**

# Delete old game-state utilities
rm -f src/lib/axis-game-state/**
rm -f src/lib/axis-teams/**
rm -f src/lib/axis-players/**

# Verify deletion
find src/lib -name "*chronology*" -o -name "*training*memory*" -o -name "*game-state*"  # should be empty
```

**Risk**: MODERATE (must verify zero references first)  
**Timeline**: 2 hours

---

## PHASE 4: DELETE LEGACY TABLES (HIGH RISK)

**These tables store real data and cannot be easily restored.**

### ⚠️ BACKUP EVERYTHING FIRST ⚠️

### 4.1 Old Event/Session Tables

**Tables to delete** (after verifying zero code references):

- `sessions` (old live session tracking, not `axis_sessions`)
- `events` (old chronology events, not `axis_events`)
- `snapshots` (old frame snapshots)
- `training_memories` (old training memory tracking)

**Before deletion, export data**:

```sql
-- Export to CSV
\COPY sessions TO 'backup_sessions.csv' CSV HEADER;
\COPY events TO 'backup_events.csv' CSV HEADER;
\COPY snapshots TO 'backup_snapshots.csv' CSV HEADER;
\COPY training_memories TO 'backup_training_memories.csv' CSV HEADER;

-- Check row counts (should be small or zero)
SELECT COUNT(*) FROM sessions;
SELECT COUNT(*) FROM events;
SELECT COUNT(*) FROM snapshots;
SELECT COUNT(*) FROM training_memories;
```

**Deletion SQL** (execute ONE table at a time):

```sql
-- Step 1: Check dependencies
SELECT 
  table_name, 
  constraint_name 
FROM information_schema.table_constraints 
WHERE table_name IN ('events', 'snapshots', 'training_memories') 
  AND constraint_type = 'FOREIGN KEY';

-- Step 2: Delete foreign key references first
ALTER TABLE snapshots DROP CONSTRAINT snapshots_session_id_fkey;
ALTER TABLE events DROP CONSTRAINT events_session_id_fkey;

-- Step 3: Delete tables one at a time
DROP TABLE IF EXISTS snapshots CASCADE;
-- Verify
SELECT COUNT(*) FROM snapshots;  -- Should error (table not found)

DROP TABLE IF EXISTS events CASCADE;
-- Verify
SELECT COUNT(*) FROM events;  -- Should error (table not found)

DROP TABLE IF EXISTS training_memories CASCADE;
-- Verify
SELECT COUNT(*) FROM training_memories;  -- Should error (table not found)

DROP TABLE IF EXISTS sessions CASCADE;
-- Verify
SELECT COUNT(*) FROM sessions;  -- Should error (table not found)
```

**Risk**: HIGH (irreversible without backup)  
**Timeline**: 2 hours (with careful verification)

### 4.2 Game-State Tables

**Tables to delete**:

- `teams`
- `players` (old players, not schema `players` table)
- `game_sessions`
- `game_players`
- `game_events`
- `lineup_segments`
- `sub_events`
- `review_marks`

**Before deletion**:

```sql
-- Check row counts (should be zero or very small)
SELECT COUNT(*) FROM game_sessions;  -- Expected: 0
SELECT COUNT(*) FROM game_events;    -- Expected: 0
SELECT COUNT(*) FROM teams;          -- Expected: 0
```

**If all zero, safe to delete**:

```sql
DROP TABLE IF EXISTS review_marks CASCADE;
DROP TABLE IF EXISTS sub_events CASCADE;
DROP TABLE IF EXISTS lineup_segments CASCADE;
DROP TABLE IF EXISTS game_events CASCADE;
DROP TABLE IF EXISTS game_players CASCADE;
DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Verify all deleted
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'game%';
-- Should return zero rows
```

**Risk**: HIGH (but tables are empty, so low data loss)  
**Timeline**: 1 hour

---

## PHASE 5: DELETE EMPTY STORAGE BUCKETS (SAFE)

### 5.1 Verify Buckets Are Empty

```bash
# Check bucket sizes
aws s3api head-bucket --bucket game-film
aws s3api list-objects-v2 --bucket game-film --max-items 10  # should return 0 objects

aws s3api list-objects-v2 --bucket session-snapshots --max-items 10  # should return 0 objects

aws s3api list-objects-v2 --bucket training-frames --max-items 10  # should return 0 objects
```

**If empty, safe to delete.**

### 5.2 Delete Buckets

```sql
-- Delete from Supabase Storage (via dashboard or API)

-- Via Supabase API:
DELETE FROM storage.buckets WHERE name IN ('game-film', 'session-snapshots', 'training-frames');

-- Or via Supabase dashboard:
-- Storage -> Buckets -> game-film -> Delete bucket
-- Storage -> Buckets -> session-snapshots -> Delete bucket
-- Storage -> Buckets -> training-frames -> Delete bucket
```

**Risk**: LOW (buckets are empty)  
**Timeline**: 30 minutes

---

## PHASE 6: ARCHIVE DORMANT INFRASTRUCTURE (OPTIONAL)

**These tables store dormant but potentially useful foundations. Can keep or archive.**

### 6.1 Decision: Keep or Archive?

| Table | Data | Keep If | Archive If |
|-------|------|---------|-----------|
| `axis_behavioral_memory` | 0 rows | Planning future intelligence layer | Plan to add intelligence later |
| `axis_session_analysis` | 3 rows | Planning session summaries | Not planned |
| `axis_processing_jobs` | 0 rows | Keep (part of upload pipeline) | Never use Trigger.dev |

**Recommendation**: Keep all three (not breaking anything, low storage cost).

### 6.2 If Archiving

Create archive schema:

```sql
-- Create archive schema
CREATE SCHEMA archive;

-- Move tables to archive
ALTER TABLE axis_behavioral_memory SET SCHEMA archive;
ALTER TABLE axis_session_analysis SET SCHEMA archive;

-- Verify
SELECT table_name FROM information_schema.tables WHERE table_schema = 'archive';
```

**Risk**: LOW (can be restored to public schema)  
**Timeline**: 1 hour

---

## CLEANUP CHECKLIST

### Before Starting
- [ ] Backup schema: `pg_dump > schema_backup_$(date +%Y-%m-%d).sql`
- [ ] Backup table data: Export to CSV
- [ ] Backup storage manifests: Export object lists
- [ ] Store backups securely (external drive, S3, archive service)
- [ ] Notify team: Inform of pending cleanup

### Phase 1: Fix Policies (SAFE)
- [ ] Fix `axis_sessions` policy (auth.uid match)
- [ ] Fix game-state policies (delete or restrict)
- [ ] Test: Verify access works as expected

### Phase 2: Delete Routes (SAFE)
- [ ] Grep for all route references
- [ ] Delete route files: `/axis-shell`, `/replay-native`, `/game-day`, `/games`, `/cv-demo`, `/rf-test`, `/measures`
- [ ] Delete old API routes: `/api/live`, `/api/training-memory`, `/api/roboflow`
- [ ] Add 404 middleware (optional)
- [ ] Test: Verify 404 on old routes

### Phase 3: Delete Library Code (MODERATE)
- [ ] Grep for all library references
- [ ] Delete `axisChronologyStore.ts` and related
- [ ] Delete old training-memory libraries
- [ ] Delete old game-state utilities
- [ ] Verify: No imports broken, tests pass

### Phase 4: Delete Legacy Tables (HIGH RISK)
- [ ] Export all data to CSV
- [ ] Check row counts (should be zero or small)
- [ ] Delete dependencies (foreign keys)
- [ ] Delete tables: `sessions`, `events`, `snapshots`, `training_memories`
- [ ] Delete game-state tables: `teams`, `players`, `game_sessions`, `game_events`, `lineup_segments`, `sub_events`, `review_marks`
- [ ] Verify: SELECT fails on deleted tables

### Phase 5: Delete Empty Storage (SAFE)
- [ ] Verify buckets empty: `game-film`, `session-snapshots`, `training-frames`
- [ ] Delete buckets via Supabase dashboard
- [ ] Verify: Buckets no longer listed

### Phase 6: Archive Dormant Infrastructure (OPTIONAL)
- [ ] Decide: Keep or archive `axis_behavioral_memory`, `axis_session_analysis`, `axis_processing_jobs`
- [ ] If archiving, move to `archive` schema
- [ ] Verify: Tables accessible from archive schema

### After Cleanup
- [ ] Run full test suite: `npm test`
- [ ] Deploy to staging: Verify app works
- [ ] Deploy to production (after staging verification)
- [ ] Monitor: Check logs for any errors
- [ ] Verify: Old routes return 404, no broken links in UI
- [ ] Update documentation: Note what was deleted and when

---

## DELETION COMMAND SUMMARY

### Quick Delete (After Backup & Verification)

```bash
# 1. Delete routes (git)
git rm -r src/app/axis-shell src/app/replay-native src/app/game-day src/app/games src/app/cv-demo src/app/rf-test src/app/measures
git rm -r src/app/api/live src/app/api/training-memory src/app/api/roboflow

# 2. Delete libraries (git)
git rm -r src/lib/axisChronologyStore.ts src/lib/axis-chronology src/lib/axis-training-memory src/lib/axis-game-state

# 3. Commit
git commit -m "Cleanup: Remove archived routes and legacy libraries"

# 4. Delete tables (SQL) - EXECUTE AFTER BACKUP
psql << EOF
-- Fix policies
DROP POLICY IF EXISTS "Allow all" ON axis_sessions;
CREATE POLICY "User can manage own sessions" ON axis_sessions
  FOR ALL
  USING (auth.uid() = user_id OR current_role = 'service_role')
  WITH CHECK (auth.uid() = user_id OR current_role = 'service_role');

-- Delete legacy tables
DROP TABLE IF EXISTS review_marks CASCADE;
DROP TABLE IF EXISTS sub_events CASCADE;
DROP TABLE IF EXISTS lineup_segments CASCADE;
DROP TABLE IF EXISTS game_events CASCADE;
DROP TABLE IF EXISTS game_players CASCADE;
DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS training_memories CASCADE;
DROP TABLE IF EXISTS snapshots CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

-- Delete buckets (via dashboard, not SQL)
EOF

# 5. Verify
npm test
npm run build
```

---

## ROLLBACK PLAN

If cleanup causes issues:

1. **Restore from backup**:
   ```bash
   pg_restore < schema_backup_2026-06-07.sql
   ```

2. **Revert code changes**:
   ```bash
   git revert HEAD
   ```

3. **Restore storage**:
   ```bash
   # Re-upload from backup manifest
   aws s3 sync backup-s3-contents s3://axis-replays/
   ```

4. **Root cause analysis**: Determine what went wrong, fix design, try again.

---

## VERIFICATION POST-CLEANUP

After each phase, verify:

### Application Tests
```bash
npm test                    # All tests pass
npm run build               # Builds without errors
npm run type-check          # No TypeScript errors
```

### Database Verification
```sql
-- Check no orphaned foreign keys
SELECT 
  kcu.column_name, 
  ccu.table_name, 
  ccu.column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu 
  ON tc.constraint_name = kcu.constraint_name 
WHERE tc.table_schema = 'public' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND (ccu.table_name NOT IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public')
       OR kcu.column_name IS NULL);
-- Should return zero rows (all foreign keys valid)

-- Check RLS policies
SELECT table_name, policy_name FROM pg_policies WHERE table_schema = 'public';
-- Verify axis_sessions has correct policy
```

### Storage Verification
```bash
# Check no broken storage references
aws s3api list-objects-v2 --bucket axis-replays --query 'Contents[].Key' --output text | wc -l
# Should still have original count

aws s3api list-objects-v2 --bucket game-film --query 'Contents[]' 2>/dev/null
# Should return nothing (empty or deleted)
```

---

## DOCUMENTATION UPDATES

After cleanup, update:

1. **Architecture docs**: Remove references to deleted tables
2. **API docs**: Remove deleted endpoints
3. **Schema migration guide**: Document what was deleted and when
4. **README**: Update tech stack (removed legacy components)

---

## COMPLIANCE & AUDIT

**Document the cleanup**:

```markdown
# Cleanup Log - 2026-06-07

**Executed by**: [Name]  
**Approved by**: [Name]  
**Timestamp**: 2026-06-07 14:00 UTC

## What Was Deleted
- Routes: `/axis-shell`, `/replay-native`, `/game-day`, `/games`, `/cv-demo`, `/rf-test`, `/measures`
- APIs: `/api/live/*`, `/api/training-memory/*`
- Tables: `sessions`, `events`, `snapshots`, `training_memories`, all game-state tables
- Buckets: `game-film`, `session-snapshots`, `training-frames`

## What Was Kept
- `axis_sessions`, `axis_uploads`, `axis_events` (migrated to new `axis_events`)
- `axis_overlays` (new)
- `axis_behavioral_memory`, `axis_session_analysis`, `axis_processing_jobs` (dormant)

## Verification
- [ ] Backup taken
- [ ] Tests pass
- [ ] Staging verified
- [ ] Production deployed

## Rollback Instructions
If issues found:
1. Restore from backup: `pg_restore < schema_backup_2026-06-07.sql`
2. Revert code: `git revert HEAD`
3. Notify team
```

Store this log in your wiki/documentation system.

---

## TIMELINE

| Phase | Duration | Risk | Notes |
|-------|----------|------|-------|
| Backup | 1-2 hours | - | Critical, do first |
| Fix policies | 1 hour | LOW | Safe, can revert |
| Delete routes | 1 hour | LOW | Safe, in git |
| Delete libraries | 2 hours | MODERATE | Verify references first |
| Delete tables | 2 hours | HIGH | Backup, test carefully |
| Delete buckets | 30 min | LOW | Empty buckets only |
| Archive dormant | 1 hour | LOW | Optional |
| **Total** | **~8 hours** | - | Spread over 2-3 days |

---

## FINAL NOTES

**This is a destructive operation. Be careful.**

- ✅ Backup everything
- ✅ Verify zero references
- ✅ Test after each phase
- ✅ Keep backups for 6 months minimum
- ✅ Document what was deleted and when
- ✅ Have a rollback plan

**Do not rush. Better to spend extra time verifying than to lose data.**

Good luck! 🚀

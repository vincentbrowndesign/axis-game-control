-- ─── Movement Knowledge Graph ─────────────────────────────────────────────────
-- The Wikipedia of basketball movement.
-- Nodes = named movement types.
-- Relationships = directed typed edges between movements.
-- Patterns = named sequences of nodes with timing constraints.

-- Enable pgvector for semantic search (no-op if already enabled)
create extension if not exists vector;

-- ─── axis_movement_nodes ──────────────────────────────────────────────────────

create table if not exists axis_movement_nodes (
  id                        text primary key, -- e.g. "node_weak_side_rotation"
  name                      text unique not null, -- canonical snake_case
  display_name              text not null,
  category                  text not null
                              check (category in (
                                'ball_movement','off_ball_movement',
                                'defensive_movement','transition','set_action'
                              )),
  initiator                 text not null
                              check (initiator in (
                                'ball_handler','off_ball','defender','team'
                              )),
  typical_origin_zones      text[] default '{}',
  typical_terminus_zones    text[] default '{}',
  typical_duration_min_ms   int,
  typical_duration_max_ms   int,
  tags                      text[] default '{}',
  description               text not null,
  -- Maps to axis_events.type values
  event_types               text[] default '{}',
  -- pgvector embedding for semantic similarity search (1536 = OpenAI ada-002)
  embedding                 vector(1536),
  occurrence_count          int default 0,
  example_event_ids         uuid[] default '{}',
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- Required for PostgREST access
grant select on axis_movement_nodes to authenticated, anon;
grant insert, update on axis_movement_nodes to authenticated;

alter table axis_movement_nodes enable row level security;

-- Movement knowledge is public read
create policy "Public read movement nodes"
  on axis_movement_nodes for select
  using (true);

-- IVFFlat index for fast cosine similarity search
-- Requires at least 3*lists rows before it activates
create index if not exists axis_movement_nodes_embedding
  on axis_movement_nodes using ivfflat (embedding vector_cosine_ops)
  with (lists = 20);

create index if not exists axis_movement_nodes_category
  on axis_movement_nodes (category);

create index if not exists axis_movement_nodes_tags
  on axis_movement_nodes using gin (tags);

-- ─── axis_movement_relationships ──────────────────────────────────────────────

create table if not exists axis_movement_relationships (
  id                    text primary key,
  from_node_id          text not null references axis_movement_nodes(id) on delete cascade,
  to_node_id            text not null references axis_movement_nodes(id) on delete cascade,
  type                  text not null
                          check (type in (
                            'triggers','precedes','enables','counters','follows'
                          )),
  frequency             float not null check (frequency >= 0 and frequency <= 1),
  mean_gap_ms           int,
  required_zone_from    text,
  required_zone_to      text,
  confidence            float not null default 0.8,
  example_session_ids   uuid[] default '{}',
  created_at            timestamptz default now()
);

grant select on axis_movement_relationships to authenticated, anon;
grant insert, update on axis_movement_relationships to authenticated;

alter table axis_movement_relationships enable row level security;

create policy "Public read movement relationships"
  on axis_movement_relationships for select
  using (true);

create index if not exists axis_movement_rel_from
  on axis_movement_relationships (from_node_id, type);

create index if not exists axis_movement_rel_to
  on axis_movement_relationships (to_node_id, type);

-- Prevent duplicate directed edges of the same type
create unique index if not exists axis_movement_rel_unique
  on axis_movement_relationships (from_node_id, to_node_id, type);

-- ─── axis_movement_patterns ───────────────────────────────────────────────────

create table if not exists axis_movement_patterns (
  id                    text primary key,
  name                  text unique not null,
  display_name          text not null,
  description           text not null,
  -- Array of {node_id, position, required, max_gap_ms}
  sequence              jsonb not null,
  relationship_ids      text[] default '{}',
  typical_zones         text[] default '{}',
  tags                  text[] default '{}',
  embedding             vector(1536),
  occurrence_count      int default 0,
  mean_duration_ms      int,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

grant select on axis_movement_patterns to authenticated, anon;
grant insert, update on axis_movement_patterns to authenticated;

alter table axis_movement_patterns enable row level security;

create policy "Public read movement patterns"
  on axis_movement_patterns for select
  using (true);

create index if not exists axis_movement_patterns_embedding
  on axis_movement_patterns using ivfflat (embedding vector_cosine_ops)
  with (lists = 20);

create index if not exists axis_movement_patterns_tags
  on axis_movement_patterns using gin (tags);

-- ─── axis_session_movement_events ─────────────────────────────────────────────
-- Links observed axis_events to knowledge graph nodes.
-- Populated by the movement classifier pipeline.

create table if not exists axis_session_movement_events (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null,
  user_id         uuid references auth.users(id) on delete set null,
  event_id        uuid references axis_events(id) on delete cascade,
  node_id         text references axis_movement_nodes(id),
  pattern_id      text references axis_movement_patterns(id),
  confidence      float not null default 1.0,
  classified_at   timestamptz default now()
);

grant select, insert on axis_session_movement_events to authenticated;
grant select on axis_session_movement_events to anon;

alter table axis_session_movement_events enable row level security;

create policy "Users see own session movement events"
  on axis_session_movement_events for select
  using (auth.uid() = user_id);

create policy "Users insert own session movement events"
  on axis_session_movement_events for insert
  with check (auth.uid() = user_id);

create index if not exists axis_sme_session
  on axis_session_movement_events (session_id, classified_at);

create index if not exists axis_sme_node
  on axis_session_movement_events (node_id);

create index if not exists axis_sme_pattern
  on axis_session_movement_events (pattern_id);

-- ─── Seed: nodes ──────────────────────────────────────────────────────────────

insert into axis_movement_nodes
  (id, name, display_name, category, initiator, typical_origin_zones,
   typical_terminus_zones, typical_duration_min_ms, typical_duration_max_ms,
   tags, description, event_types)
values
  ('node_drive','drive','Drive','ball_movement','ball_handler',
   array['top_key','wing_left','wing_right','mid_range_left','mid_range_right'],
   array['paint'], 400, 2000,
   array['attack','downhill','penetration','live_dribble'],
   'Ball handler attacks the basket downhill off the dribble, moving toward the paint.',
   array['drive']),

  ('node_baseline_drive','baseline_drive','Baseline Drive','ball_movement','ball_handler',
   array['corner_left','corner_right','wing_left','wing_right'],
   array['paint'], 400, 1800,
   array['attack','baseline','downhill','penetration'],
   'Ball handler drives from the wing or corner along the baseline toward the basket.',
   array['drive']),

  ('node_kick','kick','Kick','ball_movement','ball_handler',
   array['paint','mid_range_left','mid_range_right'],
   array['wing_left','wing_right','top_key','corner_left','corner_right'], 200, 600,
   array['pass','kick_out','perimeter','advantage_creation'],
   'Pass from a driving ball handler out to a perimeter player.',
   array['kick','pass']),

  ('node_cut','cut','Cut','off_ball_movement','off_ball',
   array['wing_left','wing_right','top_key','corner_left','corner_right'],
   array['paint'], 500, 2500,
   array['off_ball','backdoor','UCLA','scoring','basket_cut'],
   'Off-ball player makes a decisive cut toward the basket.',
   array['cut']),

  ('node_relocate','relocate','Relocate','off_ball_movement','off_ball',
   array['wing_left','wing_right','corner_left','corner_right','top_key'],
   array['wing_left','wing_right','corner_left','corner_right','top_key'], 600, 3000,
   array['off_ball','spacing','movement','open_look'],
   'Off-ball player relocates to an open area of the floor.',
   array['relocate']),

  ('node_closeout','closeout','Closeout','defensive_movement','defender',
   array['paint','mid_range_left','mid_range_right'],
   array['wing_left','wing_right','corner_left','corner_right','top_key'], 300, 1200,
   array['defense','closeout','recovery','contest'],
   'Defender sprints to close out on a perimeter player receiving the ball.',
   array['closeout']),

  ('node_rotation','rotation','Rotation','defensive_movement','defender',
   array['wing_left','wing_right','top_key'],
   array['paint','mid_range_left','mid_range_right'], 400, 2000,
   array['defense','help','rotation','paint_protection'],
   'Help-side defender rotates toward the basket to protect the paint.',
   array['rotation']),

  ('node_weak_side_rotation','weak_side_rotation','Weak Side Rotation',
   'defensive_movement','defender',
   array['wing_left','wing_right'],
   array['paint'], 500, 2000,
   array['defense','weak_side','help','rotation','paint_protection'],
   'Weak-side defender rotates from the opposite side to protect the paint on baseline drive penetration.',
   array['rotation']),

  ('node_transition','transition','Transition','transition','team',
   array['backcourt','transition'],
   array['paint','wing_left','wing_right'], 1000, 5000,
   array['fast_break','numbers_advantage','push','conversion'],
   'Offense pushes the ball in transition before the defense can set.',
   array['transition']),

  ('node_screen','screen','Screen','set_action','off_ball',
   array['top_key','wing_left','wing_right','mid_range_left','mid_range_right'],
   array['top_key','wing_left','wing_right'], 500, 3000,
   array['screen','ball_screen','off_ball_screen','action'],
   'Player sets a screen to free a teammate from a defender.',
   array['screen'])
on conflict (id) do nothing;

-- ─── Seed: relationships ──────────────────────────────────────────────────────

insert into axis_movement_relationships
  (id, from_node_id, to_node_id, type, frequency, mean_gap_ms, confidence,
   required_zone_from, required_zone_to)
values
  ('rel_drive_kick',          'node_drive',          'node_kick',                 'triggers', 0.55, 800,  0.85, null, null),
  ('rel_drive_rotation',      'node_drive',          'node_rotation',             'triggers', 0.70, 600,  0.88, null, null),
  ('rel_baseline_drive_wsr',  'node_baseline_drive', 'node_weak_side_rotation',   'triggers', 0.72, 550,  0.90, 'wing_left', 'paint'),
  ('rel_kick_closeout',       'node_kick',           'node_closeout',             'triggers', 0.80, 400,  0.87, null, null),
  ('rel_closeout_drive',      'node_closeout',       'node_drive',                'enables',  0.45, 500,  0.78, null, null),
  ('rel_rotation_kick',       'node_rotation',       'node_kick',                 'enables',  0.40, 300,  0.72, null, null),
  ('rel_relocate_kick',       'node_relocate',       'node_kick',                 'enables',  0.55, 800,  0.80, null, null),
  ('rel_cut_kick',            'node_cut',            'node_kick',                 'enables',  0.48, 400,  0.74, null, null),
  ('rel_drive_cut',           'node_drive',          'node_cut',                  'enables',  0.30, 700,  0.70, null, null),
  ('rel_screen_drive',        'node_screen',         'node_drive',                'enables',  0.50, 600,  0.80, null, null),
  ('rel_transition_drive',    'node_transition',     'node_drive',                'precedes', 0.60, 1200, 0.75, null, null)
on conflict (from_node_id, to_node_id, type) do nothing;

-- ─── Seed: patterns ───────────────────────────────────────────────────────────

insert into axis_movement_patterns
  (id, name, display_name, description, sequence, relationship_ids,
   typical_zones, tags, mean_duration_ms)
values
  ('pattern_drive_and_kick',
   'drive_and_kick', 'Drive and Kick',
   'Ball handler attacks downhill, defense collapses, pass to open perimeter shooter.',
   '[{"node_id":"node_drive","position":1,"required":true,"max_gap_ms":1000},{"node_id":"node_kick","position":2,"required":true}]',
   array['rel_drive_kick'],
   array['paint','wing_left','wing_right'],
   array['attack','advantage_creation','perimeter'],
   2200),

  ('pattern_baseline_drive_wsr',
   'baseline_drive_weak_side_rotation', 'Baseline Drive — Weak Side Rotation',
   'Baseline drive forces weak-side defender to abandon assignment and rotate to protect the paint.',
   '[{"node_id":"node_baseline_drive","position":1,"required":true,"max_gap_ms":600},{"node_id":"node_weak_side_rotation","position":2,"required":true}]',
   array['rel_baseline_drive_wsr'],
   array['wing_left','paint'],
   array['defense','drive','rotation','weak_side'],
   1800),

  ('pattern_drive_kick_closeout_drive',
   'drive_kick_closeout_drive', 'Drive, Kick, Closeout, Drive Again',
   'Penetration creates kick-out. Aggressive closeout on receiver creates second drive.',
   '[{"node_id":"node_drive","position":1,"required":true,"max_gap_ms":1000},{"node_id":"node_kick","position":2,"required":true,"max_gap_ms":500},{"node_id":"node_closeout","position":3,"required":true,"max_gap_ms":1200},{"node_id":"node_drive","position":4,"required":true}]',
   array['rel_drive_kick','rel_kick_closeout','rel_closeout_drive'],
   array['paint','wing_left','wing_right'],
   array['secondary_break','second_drive','chain_action'],
   4500),

  ('pattern_transition_attack',
   'transition_attack', 'Transition Attack',
   'Push in transition before defense sets, leading to a rim attack.',
   '[{"node_id":"node_transition","position":1,"required":true,"max_gap_ms":3000},{"node_id":"node_drive","position":2,"required":true}]',
   array['rel_transition_drive'],
   array['backcourt','transition','paint'],
   array['transition','fast_break','numbers_advantage'],
   4000),

  ('pattern_pick_and_drive',
   'pick_and_drive', 'Pick and Drive',
   'Ball handler uses screen to create driving lane, attacks downhill.',
   '[{"node_id":"node_screen","position":1,"required":true,"max_gap_ms":1500},{"node_id":"node_drive","position":2,"required":true}]',
   array['rel_screen_drive'],
   array['top_key','wing_left','wing_right'],
   array['ball_screen','drive','set_action'],
   3500)
on conflict (id) do nothing;

comment on table axis_movement_nodes is
  'The Wikipedia of basketball movement. Each row is a named movement type with spatial, temporal, and behavioral metadata.';
comment on table axis_movement_relationships is
  'Directed typed edges between movement nodes. Encodes causal, temporal, and strategic relationships.';
comment on table axis_movement_patterns is
  'Named sequences of movement nodes representing recognizable basketball actions.';
comment on table axis_session_movement_events is
  'Links observed session events to knowledge graph nodes and patterns. Built by the movement classifier pipeline.';

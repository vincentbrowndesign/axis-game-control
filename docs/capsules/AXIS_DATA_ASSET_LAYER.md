# Axis Data Asset Layer

Status:
Future layer with one active foundation contract complete

Build Decision:
Foundation complete for Axis Data Asset Contract v0

Active Runtime:
No

## Completion Lock

Axis Data Asset Contract v0 is complete.

Checkpoints:

- 93cfbfe = technical vocabulary
- 31a214f = product and build boundaries

Do not add a third Data Asset implementation chunk yet.

Current status:

- Axis Data Asset Contract v0: Active foundation - complete
- Operational Axis Data Asset Layer: Future / Define Capsule
- Runtime behavior: Unchanged
- Next runtime build: A1 session memory integrity

## Locked Sentence

Axis manufactures structured data assets from reality.

## Architecture

```text
Source material -> Suggested structured records -> Deliberately kept records -> Datasets -> Data assets -> Output products
```

## Layer Definitions

Source Record:
Raw material such as text, voice, image, clip, file, screenshot, stream, camera capture, or manual note.

Structured Record:
A normalized event, observation, claim, player action, zone, result, constraint, relationship, or source reference.

Dataset:
A controlled grouping of source and structured records around a player, team, practice, game, project, program, content stream, or skill.

Data Asset:
A durable reusable package derived from records and datasets.

Output Product:
A rendered derivative such as a recap, plan, report, coach board, clip pack, playbook, or content pack.

## Lifecycle

```text
Raw Source -> Suggested -> Kept -> Verified -> Asset
```

Raw Source:
Original material with provenance.

Suggested:
Axis or a user has proposed structure, but it is not durable truth.

Kept:
A person or future explicit workflow chose to retain the record.

Verified:
Reserved for records that satisfy future Evidence/Witness requirements.

Asset:
A packaged reusable object created from governed records and datasets.

## Boundaries

- Session remains the active product object.
- Do not rename Session to Research Trail in the active product.
- A future Research Trail may be derived from one or more saved sessions.
- Session persistence saves exact owner-scoped session drafts and future session memory.
- Data Asset Layer may later structure derived material.
- Persistence is not player memory.
- Observation is not Claim.
- Clip is Source Record, not automatic Evidence Object.
- Kept is a lifecycle stage, not a new card type.
- Verified requires future Evidence/Witness rules.
- Confidence is not truth.
- Output Product is not source of truth.
- Visual proof status is not verified evidence.
- BoardSectionObject arrangement is not a data asset.
- Session persistence must not become cross-thread player memory, inferred truth, or automatic data asset promotion.

## Contract-Only Behavior

Axis Data Asset Contract v0 currently provides:

- types
- lifecycle vocabulary
- provenance boundary
- sensitivity boundary
- conservative verification helpers

It currently does not:

- create records
- persist records
- group datasets
- create assets
- render outputs
- retrieve across threads
- run background work
- verify evidence

## Future Asynchronous Behavior

Future workers may:

- inspect governed source material
- create suggested records
- propose datasets
- draft output products

Future workers must not:

- silently create verified truth
- promote records without provenance
- merge players or threads without an explicit boundary
- generate products from unsupported claims

Asynchronous processing is future work, not part of v0.

## Child And Minor Data Rules

- represent minor data with explicit sensitivity
- use owner-scoped access controls
- collect only what is necessary
- preserve correction paths
- preserve deletion paths
- do not sell raw child data
- do not treat inferred child/player profiles as unquestionable truth
- future monetization may concern tools, reports, access, and development products
- marketplace and monetization are not part of v0

## Relationship To Current Capabilities

Axis Session Memory:
Where basketball work becomes searchable, reviewable, correctable memory.

Axis Session:
The exact saved basketball session shell and future memory container.

Axis Moment:
One typed, tapped, spoken, or supported thing that happened in the session.

Axis Session Persistence:
Restores owner-scoped session drafts and future saved session memory.

Axis Data Asset Contract:
Defines future structured records, datasets, assets, and outputs.

Axis Memory Layer:
Still future and locked.

Axis Evidence/Witness:
Still future and required before verification.

Axis Lens:
Still future and cannot create verified truth.

Axis Asset Flywheel:
Strategy only. Defines a possible future business and field-test loop for governed source material, reusable outputs, distribution signals, and better next sessions. It does not activate operational Data Asset runtime, monetization tooling, reports, subscriptions, sponsor tooling, or background processing.

## Current Runtime Priorities

The Data Asset Contract does not replace the active runtime priorities:

- session entity integrity
- live Supabase persistence verification
- session memory quality

## Do Not Build Yet

- operational Data Asset Layer
- persistent Source Records
- persistent Structured Records
- automatic Dataset generation
- automatic Data Asset creation
- asset promotion
- Keeper UI/workflows
- verified assets
- player profiles
- development memory
- automatic cross-thread recall
- background processing
- reports and exports
- subscriptions
- sponsor tooling
- Data Product generation
- marketplace/platform monetization
- raw child-data monetization
- Lens/CV ingestion

# Axis App Flow v1

Status: ACTIVE PRODUCT FLOW

Axis is a memory + vision product for training.

## Product Model

```text
Axis = user-facing memory and control layer
Vision = camera/object-lock input
Measure = background detector/CV engine
Session = internal saved record of what happened
```

Session is useful internally, but it should not be the main user-facing CTA.

## Three Doors

Axis should open into three simple choices:

1. Vision
2. Log
3. Review

### Vision

Vision opens the camera quickly.

User-facing promise:

```text
Find the player. Find the rim. Find the ball.
```

Vision can create or attach a saved record quietly when the user saves evidence. The user should not need to think about a session before using the camera.

### Log

Log gives value without vision.

Use it when:

- camera is unavailable
- the user wants to type a note
- the user wants to save memory after a workout
- the user wants to capture coaching corrections manually

User-facing labels:

- Log Work
- Save Memory
- New Record
- Today’s Work

### Review

Review is where saved memory, evidence, and progress come back.

Review should require auth because it is about saved memory. Public landing stays public. Vision can preview before auth.

## Measure

Measure is the detector/CV engine.

On `axismeasure.com`, lab/service language is okay.

On `ontheaxis.com`, users should see Axis Vision, not Axis Measure.

## Copy Rules

Use simple value copy:

- See what happened.
- Save what matters.
- Build player memory.
- Find the player. Find the rim. Find the ball.

Avoid normal-user copy about:

- providers
- detector routes
- confidence
- class IDs
- raw JSON
- pipelines

## Product Flow

```text
Open Axis
-> choose Vision, Log, or Review
-> capture camera evidence or log work manually
-> save memory
-> review what matters later
```

Vision and Log are inputs. Memory is the product.

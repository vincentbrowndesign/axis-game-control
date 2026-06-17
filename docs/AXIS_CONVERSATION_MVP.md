# Axis Conversation MVP

## Product truth

The conversation itself is the product.

Axis helps the work develop. That is all it does today.

The user may be a coach, player, parent, founder, creator, trainer, or builder.
Axis does not ask which. It treats everything as developing work.

---

## MVP scope

### What is in scope

- One page: `/axis`
- One API: `POST /api/axis/conversation`
- Text in, text out
- Conversation history held in browser memory for the session
- Axis opens every session: "What are we working on?"
- User responds. Axis develops the work. Conversation continues.

### What is out of scope

- Voice
- Camera
- Upload / evidence
- Dashboard
- Sidebars
- Cards
- Mode picker (coach mode, player mode, etc.)
- Analytics
- Long-term memory / database
- Missions
- Game tracking
- CV / computer vision
- Sketches (available in infrastructure, not active in MVP page)
- Replay / overlay / export

---

## Active route

`/` → renders `src/app/axis/page.tsx`
`/axis` → same page
`/axis/mission` → redirects to `/axis`
`/chat` → redirects to `/axis`

---

## Axis conversation behavior

Axis operates on a single internal pattern:

**Catch → Develop → Return → Move**

This pattern is never shown in the UI. It shapes every response.

1. **Catch** — notice what is forming in what the user said
2. **Develop** — name what is developing, protect the important point
3. **Return** — give the user language they can use
4. **Move** — ask the smallest next question only when it moves the work forward

---

## System prompt summary

Axis is not a dashboard, notebook, coach bot, tracker, analytics tool, training system, or generic assistant.

Axis does not interrogate. Does not ask generic AI questions. Does not sound like a consultant or a coach cliché machine.

Axis uses direct, useful language. It sounds like a world-class development partner.

Full system prompt lives in: `src/app/api/axis/conversation/route.ts`

---

## Acceptance tests

These should be tested manually through the page after any change to the conversation system.

### Prompt 1
> "I'm trying to figure out Axis."

**Expected:** Axis treats Axis itself as developing work. It should push toward what the conversation helps develop, not explain a product stack.

### Prompt 2
> "I need to organize practice."

**Expected:** Axis does not jump into drills or a plan. It helps identify what the practice is developing — what the goal of the practice session is at a deeper level.

### Prompt 3
> "I need better content."

**Expected:** Axis does not produce a content calendar. It helps clarify what the content should reveal or develop. What is the content trying to do?

### Prompt 4
> "I'm trying to help my kid."

**Expected:** Axis does not turn preachy or parenting-coach. It helps identify what kind of development needs protecting right now.

### Prompt 5
> "I need to make this business real."

**Expected:** Axis helps make the work more usable, believable, and movable — without generic startup advice or frameworks.

---

## Anti-patterns

Axis must never say:
- "This sounds like a clarity problem"
- "This feels like a product identity issue"
- "What are your goals?"
- "Can you provide more context?"
- "What challenges are you facing?"
- "How can I help?"
- "That's a great question"
- "I understand that..."

Axis must never frame the user as stuck.

---

## Page UI spec

| Element | Value |
|---|---|
| Header | Axis |
| Subheader | Develop the work through conversation. |
| Initial assistant message | What are we working on? |
| Helper copy (initial state only) | Bring the rough version. I'll help it develop. |
| Input placeholder | Say the rough version… |
| Submit button | Send |
| Support line | Axis helps the work develop one layer at a time. |
| Loading state | Three pulsing dots |
| Error state | Plain text: "Something went wrong. Try again." |

---

## File map

| File | Purpose |
|---|---|
| `src/app/axis/page.tsx` | Active MVP page |
| `src/app/api/axis/conversation/route.ts` | Conversation API (no DB required) |
| `src/app/axis/mission/page.tsx` | Redirects to /axis |
| `src/app/page.tsx` | Root — renders AxisPage |

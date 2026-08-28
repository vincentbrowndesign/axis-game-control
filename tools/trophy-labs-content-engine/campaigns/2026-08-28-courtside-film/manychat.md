# ManyChat - Why your basketball film isn't telling you anything

Build this by hand in ManyChat. The engine does not touch live automations.

## 1. Trigger

Comment keyword on this post: `FILM`

## 2. Public comment reply

> Sent it - check your DMs. 🏀

## 3. Opening DM

> Want the Trophy Labs Courtside Film Setup Checklist?

Button: `SEND THE CHECKLIST`

## 4. Follow request (optional step)

> Before I send it, follow trophy.labs so you don't miss the Film breakdowns and basketball intelligence we're building.

Buttons: `SEND THE CHECKLIST` after following, and `JUST SEND IT` to continue without following.

ManyChat's comment-to-DM automation can check whether a commenter follows the account and ask
them to follow before it sends the link. That check depends on the Opening DM being enabled -
without the Opening DM, the follow request and some follow-ups are unavailable.
Reference: https://help.manychat.com/hc/en-us/articles/16654065283100-Quick-Automation-Auto-DM-links-from-comments

Trophy Labs policy: the follow request stays skippable. The resource is a fair exchange,
not a follower trap.

## 5. Delivery DM

> Here it is - the Courtside Film Setup Checklist:
> [OPEN THE CHECKLIST]
> It covers camera position, framing, lighting, stability, and what needs to remain visible during a shooting rep.

Link target: https://ontheaxis.com/guides/courtside-film

## 6. Follow-up DM (send 24h later if unopened)

> Were you able to open it?
> If you're recording a workout soon, reply with what kind of session it is and I'll suggest the cleanest camera position.

## Build checklist

- [ ] Keyword `FILM` attached to the published post only
- [ ] Opening DM enabled (required before the follow step exists)
- [ ] Follow request left skippable
- [ ] Resource link live at https://ontheaxis.com/guides/courtside-film
- [ ] Follow-up scheduled
- [ ] Campaign performance fields recorded after 7 days

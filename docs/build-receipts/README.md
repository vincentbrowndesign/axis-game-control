# Build Receipts

Every agent build (Claude or Codex) writes one receipt here when it finishes.

Filename: `YYYY-MM-DD-short-slug.md`

Each receipt must include:

- Files changed
- What was built and why
- What works now
- What still needs backend persistence
- Risks
- Next recommended build step

Receipts are committed to git. They are the write-back half of the loop:

```text
Obsidian -> PowerShell Sync -> Repo Context -> Claude/Codex Build -> Build Receipt -> Obsidian Update
```

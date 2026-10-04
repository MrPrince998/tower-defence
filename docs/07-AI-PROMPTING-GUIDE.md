# 07 — AI Prompting Guide

## Session template
```
Read CLAUDE.md, docs/README.md, docs/08-PROGRESS-TRACKER.md, and docs/phases/PHASE-XX-*.md
plus its "Required reading". Implement Phase XX only. Follow the acceptance criteria.
Show me the file tree of what you created, then run the tests.
```

## Good habits
- One phase per session; start a new chat for each phase and paste the file tree (`tree -I node_modules -L 4`).
- If output is wrong, paste the exact error and the file path.
- Ask for tests first for simulation code ("write failing tests, then implement").
- After each phase: run tests, commit, tick the tracker.
- If the AI proposes logic on the client, remind it: "server is authoritative, see CLAUDE.md".

## Recovery prompts
- Drift: "Re-read docs/03-PROTOCOL.md. Your event names differ from shared. Fix to match."
- Scope creep: "Only Phase XX tasks. Remove anything not in the deliverables list."
- Debugging: "Here is the failing test and stack trace. Explain the root cause before changing code."

# Duration value wrapped awkwardly next to its Edit/Remove buttons

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** in the narrow side panels, a duration like
  "02d-00h-00m-00s" wrapped mid-string onto two lines while sharing a row
  with the Edit and Remove buttons, cramped and hard to read.
- **Root cause:** the value, its Edit button, and its Remove button were
  laid out in a single flex row with no wrap handling suited to a long,
  unbreakable value string in a narrow container.
- **Fix:** the value now sits on its own line (`white-space: nowrap` so it
  never breaks internally) with Edit/Remove grouped in a row beneath it.
- **Verified by:** a screenshot comparison before and after the change.
- **Found & fixed:** 2026-09-13.

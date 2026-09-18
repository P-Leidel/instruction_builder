# Fixed Issues

> 📌 **Doc status: CURRENT** — living index, evergreen across phases. Add an
> entry (a new file in this folder, linked below) the moment a real bug (not
> a design decision, not a planned addition) is found and fixed; see
> [../milestones.md](../milestones.md#documentation-status-conventions) for
> what CURRENT/HISTORICAL mean project-wide.

A log of defects that actually shipped (or were caught mid-session before
shipping) and how they were fixed - the resolved counterpart to
[../known-issues.md](../known-issues.md), which tracks the opposite: issues
found and deliberately left unfixed. Fuller "what was being built when this
was found" narrative lives in
[../phase-2/progress/README.md](../phase-2/progress/README.md); each entry
below is self-contained enough to read on its own, focused on what broke,
why, and how it was confirmed fixed.

One file per bug, newest last (matching the order they were found):

1. [SVG canvas controls unreachable via keyboard (`tabindex` casing)](./svg-canvas-tabindex-casing.md)
2. [Token connector lines invisible despite correct markup](./token-connector-lines-invisible.md)
3. [Row-wrap connectors reading as one continuous bar across several rows](./row-wrap-connectors-continuous-bar.md)
4. [Stale step selection after a persisted document loads](./stale-step-selection-after-persisted-load.md)
5. [Row-wrap connector's stub only existed on one end](./row-wrap-connector-stub-one-end.md)
6. [Row-wrap bends looked inconsistently "tight" between wraps](./row-wrap-bends-inconsistent-tightness.md)
7. [DurationField showed a stale, unsaved edit after switching tokens or steps](./duration-field-stale-edit-on-switch.md)
8. [Forward drag-reorder overshot by one position (tokens and steps)](./forward-drag-reorder-overshoot.md)
9. [`descriptionFor` helper duplicated verbatim across two components](./description-for-helper-duplicated.md)
10. [Unreachable `"note"` token category shared a name with an unrelated field](./note-category-name-collision.md)
11. [QuantityForm draft amount/unit leaked from one token to the next](./quantity-form-draft-leaked-between-tokens.md)
12. [Attachment remove button labeled with the category name, not the actual value](./attachment-remove-button-wrong-label.md)
13. [Saved document silently discarded and overwritten on a schema version mismatch](./schema-version-mismatch-data-loss.md)
14. [SVG export would have downloaded unstyled, invisible-looking shapes](./svg-export-unstyled-shapes.md)
15. [Duration value wrapped awkwardly next to its Edit/Remove buttons](./duration-value-wrapped-awkwardly.md)
16. [Toolbar export/import buttons overflowed the page on narrow phones](./toolbar-export-buttons-overflow-on-phones.md)
17. [A long step title overflowed the page instead of truncating with an ellipsis](./long-step-title-overflowed-page.md)
18. [A long token title in Step details starved its description column](./long-token-title-starved-description-column.md)
19. [The accent color's white text/icons fell short of WCAG AA contrast](./accent-color-failed-contrast-minimum.md)
20. [The hidden Import file input had no accessible label](./import-file-input-had-no-accessible-label.md)
21. [A naive service worker fetch handler broke every page reload](./service-worker-broke-every-page-reload.md)
22. [The service worker's runtime cache silently cached nothing, ever](./service-worker-never-actually-cached-anything.md)
23. [PDF export's step-bounds reader also matched token groups](./pdf-pagination-step-bounds-selector-collision.md)
24. [The confirm dialogs behaved like modals without ever declaring it](./confirm-dialogs-were-modal-in-behavior-only.md)
25. [The hidden export canvas was a keyboard tab stop](./hidden-export-canvas-was-a-keyboard-tab-stop.md)

# SVG canvas controls unreachable via keyboard (`tabindex` casing)

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** the step-select badge and token remove control were
  meant to be keyboard-focusable (`role="button"`, task 6's accessibility
  requirement) but `Tab` skipped over them entirely, with no console error.
- **Root cause:** the JSX used `tabIndex={0}`, the HTML/React-conventional
  camelCase. Preact sets whatever case is written as the *literal* DOM
  attribute name on SVG elements - `tabIndex="0"` becomes an attribute the
  browser doesn't recognize, silently doing nothing. SVG elements need the
  all-lowercase `tabindex`.
- **Fix:** changed to `tabindex={0}` on both elements.
- **Verified by:** a dedicated Playwright check (`CANVAS_KEYBOARD_FOCUSABLE`
  in the project skill's driver) that focuses the badge and asserts
  `document.activeElement`'s role, added specifically as a regression test
  for this bug.
- **Found & fixed:** 2026-09-13.

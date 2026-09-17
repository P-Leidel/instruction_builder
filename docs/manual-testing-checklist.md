# Manual Testing Checklist

> 📌 **Doc status: CURRENT** — living doc, evergreen across phases. Update
> it whenever a check stops being relevant, a known issue listed here gets
> fixed, or a new area needs cover; see
> [milestones.md](./milestones.md#documentation-status-conventions) for what
> CURRENT/HISTORICAL mean project-wide.

One list for everyone testing the live app at
<https://instructionbuilder-seven.vercel.app>. The **Everyone** section
applies to every device; after it, desktop testers and mobile/tablet testers
each have their own shorter section.

Written for task 30 (Test Real Users) - see [milestones.md](./milestones.md)
for where that sits in the project. You do not need to know anything about
the code to work through this.

## Before you start

Have these ready for anything you report:

- Device and browser (e.g. "iPhone 13, Safari" / "Windows laptop, Chrome").
- Orientation, if you are on a phone or tablet.
- Roughly how wide your browser window is, if you are on desktop.
- Whether the document you were working on was **brand new**, **already
  saved from an earlier session**, or **imported from a JSON file**. Several
  past bugs only ever appeared in one of those three.

## How to report something

1. What you did, step by step, so someone else can repeat it.
2. What you expected, and what actually happened.
3. Device, browser, orientation.
4. Whether it happened again when you retried.

**Anything that loses your work or corrupts a saved document is top
priority** - report it straight away rather than saving it up with the rest.

---

## Everyone

### Building a document

- [ ] Add a step; give it a title and some details.
- [ ] Add tokens from each category in "Add to step".
- [ ] Select a step, then select a token inside it. (This takes two
      taps/clicks - the first selects the step, the second selects the
      token.)
- [ ] Give a token a title and notes.
- [ ] Attach a Quantity to a token, then **change it without removing it
      first**.
- [ ] Attach a Warning to a token.
- [ ] Set a Time on a token, and a separate Time on the step itself.
- [ ] Check the heading above the canvas shows your document title and the
      total time, and that the total updates as you add times.
- [ ] Remove a token. Remove a step.
- [ ] Build a 5-step recipe start to finish with no help from anyone. Note
      anything you had to guess at, hunt for, or got wrong the first time -
      this is the single most useful feedback in the whole list.

### Copy and paste a token

- [ ] Copy a token, select a different step, paste it. Its quantity,
      warning, time and notes should all come across with it.
- [ ] Edit the pasted token - the original must not change with it.

### Undo and redo

- [ ] Undo and redo each of: adding a token, removing a step, reordering
      steps, pasting a token, importing a file.
- [ ] Type a long title, then undo once. The whole burst of typing should
      undo together, not one letter at a time.

### Saving and reloading

- [ ] Make some changes, wait a moment, then reload the page. Everything
      should still be there.
- [ ] Open the app in two browser tabs and edit in both. Report anything
      that looks like one tab overwriting the other.
- [ ] Start a New document and confirm you are warned before your current
      work is replaced.

### Exporting and importing

- [ ] Export JSON, then import that same file back. You should be asked to
      confirm before it replaces what you have.
- [ ] Import a file that is not a valid document (any random `.json`, or a
      renamed text file). It should be refused cleanly and leave your
      current work untouched.
- [ ] Export SVG, PNG and PDF, and open each one.
- [ ] The downloaded filename should match your document title.
- [ ] Export with an unfinished step (one with no action token). You should
      see a warning, but the file should still download.
- [ ] **Long PDF:** build 8 or more steps with very different numbers of
      tokens, then export PDF. No step should ever be cut in half across a
      page break, and there should be no blank pages.
- [ ] Exports should always look like the **wide desktop version** of the
      canvas, whatever device you made them on.

---

## Desktop testers

Automated tests already cover the ordinary path in a maximised window, so
the value here is in the awkward cases.

### Drag and drop

- [ ] Drag a token to a different position within its own step.
- [ ] Drag a token into a different step.
- [ ] Watch the insertion marker while dragging - does it point at the slot
      the token actually lands in?
- [ ] Drag a step by its handle to reorder it.
- [ ] A quick click with no movement should just **select**, never move
      anything.
- [ ] Use the Move up / Move down buttons as well as dragging.

### Window sizes

- [ ] Maximised.
- [ ] **Resized to roughly 850-1100px wide.** This narrow-desktop band is
      the least tested part of the app - watch the middle canvas getting
      squeezed between the two side columns.
- [ ] Very wide (1920px or more) - the canvas background should not stretch
      away to the right of the drawing.
- [ ] Add steps until the page grows tall enough to scroll. Nothing should
      jump sideways when the scrollbar appears.
- [ ] Drag the window narrower than about 800px - the layout should switch
      cleanly to the single-column phone layout.

### Exports opened properly

- [ ] Open an exported SVG in Inkscape or Illustrator. Shapes, colours and
      icons should all be there - not a blank or unstyled outline.
- [ ] Zoom right into an exported PNG. It should stay sharp.
- [ ] Actually print a PDF, or at least page through it at 100%.

### Keyboard only

- [ ] Tab through the whole app without touching the mouse. Can you reach
      everything?
- [ ] In "Add to step", switch category using the Left and Right arrow keys.
- [ ] Use Space or Enter on the canvas buttons (select step, remove, move
      up/down, add step).
- [ ] Ctrl+Z and Ctrl+Y (or Ctrl+Shift+Z) for undo and redo.
- [ ] Ctrl+C and Ctrl+V on a selected token - but inside a text box they
      must still do ordinary text copy and paste.
- [ ] Open the Time or Quantity panel and press Escape. It should close and
      put the focus back on the button you opened it from.

### Documents saved before 17 September 2026

- [ ] If you used the app between 14 and 17 September 2026, reopen a
      document you saved back then and check any Quantity still shows the
      value you originally set - **not** "1 g". This was a real data bug,
      since repaired; we want confirmation the repair works on your actual
      documents.

---

## Mobile and tablet testers

The most important thing to know: **the layout switches at 800px screen
width.** A phone always gets the single-column layout. An iPad in
*portrait* also gets the single-column layout - rotate it to *landscape* and
you get the full three-column desktop layout instead. Rotating a tablet is
therefore one of the most valuable things you can test, and the whole size
band between phone and full desktop has had less testing than anything else
in the app.

### Touch basics

- [ ] Drag a token with your finger. The page must not scroll underneath you
      while you drag.
- [ ] The insertion marker should be visible and accurate while dragging.
- [ ] A tap without moving should still just select.
- [ ] Drag a step by its handle to reorder it.
- [ ] Are the buttons big enough to hit reliably? Note any you keep
      mis-tapping.
- [ ] Try pinch-zoom and double-tap on the canvas - report anything that
      breaks or gets stuck.

### The Time and Quantity panel — please test this hard

It opens as a small floating panel underneath whichever button you tapped,
and it is the newest and least-proven piece of the interface on touch.

- [ ] Open "+ Time" when its button is near the **bottom** of the screen. Is
      the panel fully visible, or does part of it sit off-screen?
- [ ] With the panel open, tap a number field so the on-screen keyboard
      comes up. Does the keyboard cover the panel?
- [ ] Open the panel, then **rotate the device**. Does it end up somewhere
      sensible?
- [ ] Open it when its button is near the right edge of the screen - it
      should flip rather than run off the edge.
- [ ] Tapping outside the panel should close it.
- [ ] The four time boxes (days / hours / minutes / seconds) should all fit
      and be usable.

### Rotation

- [ ] Rotate while a step is selected.
- [ ] Rotate in the middle of a drag.
- [ ] Rotate with a confirmation dialog open (Import, or New document).
- [ ] Work through the Everyone section above in **both** orientations if
      you are on a tablet.

### Sideways scrolling

- [ ] The page should **never** scroll left and right. If it does, note the
      exact screen width and what was on screen at the time - a panel, a
      dialog, a drag in progress. Those particular cases are not covered by
      any automated check.

### Exporting from a phone or tablet

- [ ] Export PDF. The first time, the app fetches an extra piece in the
      background, so it may pause on a slow connection - report it if it
      fails or hangs.
- [ ] Check where the file actually went. Some phone browsers open it in a
      viewer instead of saving it.
- [ ] Confirm the exported file shows the wide desktop layout, not the
      narrow phone one.

### Install and offline

- [ ] iPhone/iPad: Share, then Add to Home Screen, then open it from the
      home screen.
- [ ] Android: use the install prompt, or menu, then Install app.
- [ ] Turn on airplane mode and build, save and export. It should all still
      work.
- [ ] Close the installed app completely and reopen it - your document
      should still be there.

### Private browsing

- [ ] Open the app in a Safari Private tab. If saving does not work there,
      you should see a visible warning message. Silent failure is a bug.

### Typing

- [ ] Type into every text field with the on-screen keyboard up. Does the
      keyboard hide the field you are typing into?
- [ ] Length limits: document title and step title stop at 50 characters,
      token title at 18, step details and token notes at 249. When you hit a
      limit the field simply stops accepting text - tell us if that felt
      confusing or looked broken.

---

## Known issues — please don't report these

These are already logged and scheduled (see
[known-issues.md](./known-issues.md)). Telling us **how much they bother
you** is genuinely useful; telling us they exist is not.

1. **Phone layout order.** The canvas sits below an empty "Token details"
   area, so you scroll past a placeholder before reaching the thing you are
   actually building.
2. **Small tokens on a phone.** The icons and labels on the canvas are small
   at phone width.
3. **No keyboard way to move a token** between steps or within a step -
   dragging is the only way. (Steps themselves do have keyboard Move up and
   Move down buttons.)
4. **A change made in the last fraction of a second before closing the tab**
   can be lost. Closing a tab a second or more after your last keystroke is
   safe.

## Quick reference

| | |
|---|---|
| App | <https://instructionbuilder-seven.vercel.app> |
| Layout switches at | 800px screen width |
| Highest priority | Anything that loses or corrupts saved work |
| Then | Anything unreachable by keyboard or touch |
| Then | Layout and visual problems, with the screen width noted |
| Not needed | The four known issues listed above |

# @zag-js/input-mask

Format-as-you-type input masking with caret preservation

## Installation

```sh
yarn add @zag-js/input-mask
# or
npm i @zag-js/input-mask
```

## Usage

For a plain `<input>` or `<textarea>` with a fixed placeholder template:

```ts
import { attachInputMask } from "@zag-js/input-mask"

const detach = attachInputMask(inputEl, {
  mask: "__-__-____",
  accept: /\d/,
})

// later, when the element unmounts
detach()
```

The initial value is formatted immediately on attach - there is no need to
pre-format it yourself. `accept` is an allowlist: only characters it matches
are treated as content, everything else in the mask string is a literal
(the `-` above). Typing a character `accept` rejects is a no-op, not a
silent substitution.

### `editMode: "insert"` vs `"overwrite"`

This only applies when `mask` is set, and only changes what happens when you
type into an *already-filled* slot:

- `"insert"` (the default) behaves like a normal text field: the typed
  character is inserted at the cursor and everything after it shifts right,
  truncating anything that no longer fits the template.
- `"overwrite"` replaces the character at the cursor's slot in place, without
  shifting anything after it. Typing past the last filled slot still appends
  normally - overwrite only changes behavior when there's something at the
  cursor to replace.

Either way, the template's slot count is a hard cap: once every slot is
filled, further input can change what's already there (in `"overwrite"`
mode) but never grows the raw content past that limit.

For a free-form formatter with no fixed template (e.g. grouping digits with
commas, with no literal separators at fixed positions), omit `mask` and
provide `format` instead:

```ts
attachInputMask(inputEl, {
  format: (raw) => raw.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
  accept: /\d/,
})
```

### Lower-level primitives

If you're wiring this into something other than a plain DOM element (a
framework component, a state machine's own event handlers), `createInputMask`
returns the same formatting and cursor logic as plain functions instead of
attaching listeners itself. `recordCursor`/`restoreCursor`/
`getNextCursorPosition` are also exported directly for consumers that already
own their own input event wiring and only need caret preservation across a
value swap.

## Contribution

Yes please! See the
[contributing guidelines](https://github.com/chakra-ui/zag/blob/main/CONTRIBUTING.md)
for details.

## Licence

This project is licensed under the terms of the
[MIT license](https://github.com/chakra-ui/zag/blob/main/LICENSE).

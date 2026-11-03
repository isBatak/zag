# Step 3: number-input adopts the extracted package (dedup)

## Scope

Point `number-input` at `@zag-js/input-mask` instead of its private copy; delete the duplicate.

## Work

- Delete `packages/machines/number-input/src/cursor.ts` and `packages/machines/number-input/tests/cursor.test.ts` (both
  now superseded by the versions moved into the new package in step 2).
- Add `"@zag-js/input-mask": "workspace:*"` to `packages/machines/number-input/package.json`.
- `number-input.machine.ts:22` — import from `@zag-js/input-mask`; the two call sites in `syncInputElement`
  (`number-input.machine.ts:446,449`) drop the `scope` argument.
- `number-input.connect.ts:15` — same import change; the two `recordCursor(event.currentTarget, scope)` call sites
  (`:159`, `:207`, in `onInput` and the Enter-key handler) drop `scope`.
- Leave `number-input.utils.ts` (`createFormatter`/`createParser`/`parseValue`/ `formatValue`) untouched — out of scope
  here.

## Deliverable

`number-input` has one fewer private file, one new workspace dependency, zero behavior change.

## Verification

`pnpm --filter @zag-js/number-input typecheck` and run its test files directly via vitest — must pass unchanged. Manual
smoke test: `pnpm start-react` number-input example — type a currency value, delete/insert mid-string, confirm cursor
feel is unchanged.

# Step 2: extract into a standalone package, zero behavior change

## Scope

Move `packages/machines/number-input/src/cursor.ts` into a new package verbatim, with only the `@zag-js/core` `Scope`
coupling removed. Carry forward the updated `cursor.test.ts` from step 1 (including its new scenario tests) with its
now-known pass/fail results unchanged by the move (this step must not change any outcome from step 1).

## Work

- `pnpm generate-util` -> `packages/utilities/input-mask` (`@zag-js/input-mask`).
- `src/diff.ts`: move `getNextCursorPosition` unchanged — already a pure string function with no DOM/Scope dependency.
- `src/selection.ts`: move `recordCursor`/`restoreCursor`, replacing the `Scope` parameter with `@zag-js/dom-query`'s
  existing standalone `isActiveElement(el)` (`packages/utilities/dom-query/src/node.ts:43` — already shadow-DOM-aware
  via `getRootNode()`, a straight swap, not new logic):

  ```ts
  export function recordCursor(el: HTMLInputElement | HTMLTextAreaElement | null): Selection | undefined
  export function restoreCursor(
    el: HTMLInputElement | HTMLTextAreaElement | null,
    selection: Selection | undefined,
  ): void
  ```

- `src/index.ts`: re-export both plus the `Selection` type.
- `tests/diff.test.ts`: move the updated `packages/machines/number-input/tests/cursor.test.ts` verbatim (import path
  only), including the scenario tests added in step 1.

## Deliverable

New package builds, lints, typechecks; its test suite (the moved, updated `cursor.test.ts`) passes with identical
results to step 1. Not yet consumed by anything — `number-input` still has its own copy in this step.

## Verification

`pnpm --filter @zag-js/input-mask build test` — the scenario-test pass/fail results must be byte-for-byte the same as
step 1's.

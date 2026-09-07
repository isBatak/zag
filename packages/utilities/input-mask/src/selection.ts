import { isActiveElement } from "@zag-js/dom-query"
import { getNextCursorPosition } from "./diff"

export interface Selection {
  start: number
  end: number
  value: string
}

type Element = HTMLInputElement | HTMLTextAreaElement

export function recordCursor(inputEl: Element | null): Selection | undefined {
  if (!inputEl || !isActiveElement(inputEl)) return

  try {
    const { selectionStart: start, selectionEnd: end, value } = inputEl
    if (start == null || end == null) return undefined

    return { start, end, value }
  } catch {
    return undefined
  }
}

export function restoreCursor(inputEl: Element | null, selection: Selection | undefined) {
  if (!inputEl || !isActiveElement(inputEl)) return

  if (!selection) {
    const len = inputEl.value.length
    inputEl.setSelectionRange(len, len)
    return
  }

  try {
    const newValue = inputEl.value
    const { start, end, value: oldValue } = selection

    if (newValue === oldValue) {
      inputEl.setSelectionRange(start, end)
      return
    }

    const newStart = getNextCursorPosition(oldValue, newValue, start)
    const newEnd = start === end ? newStart : getNextCursorPosition(oldValue, newValue, end)

    const clampedStart = Math.max(0, Math.min(newStart, newValue.length))
    const clampedEnd = Math.max(clampedStart, Math.min(newEnd, newValue.length))

    inputEl.setSelectionRange(clampedStart, clampedEnd)
  } catch {
    const len = inputEl.value.length
    inputEl.setSelectionRange(len, len)
  }
}

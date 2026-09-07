import {
  applyMask,
  editRawChars,
  maskIndexAfterRawCount,
  parseMaskTemplate,
  rawIndexAt,
  type MaskTemplate,
} from "./mask"
import { recordCursor, restoreCursor, type Selection } from "./selection"

export type AcceptPredicate = RegExp | ((char: string) => boolean)

export interface InputMaskOptions {
  format?: (value: string) => string
  accept?: AcceptPredicate
  mask?: string
  placeholder?: string
  editMode?: "insert" | "overwrite"
}

export interface OverwriteEditResult {
  value: string
  cursor: number
}

export interface InputMaskController {
  format(rawValue: string): string
  extractRawContent(value: string): string
  accepts(char: string): boolean
  recordCursor(el: HTMLInputElement | HTMLTextAreaElement | null): Selection | undefined
  restoreCursor(el: HTMLInputElement | HTMLTextAreaElement | null, selection: Selection | undefined): void
  applyOverwriteEdit(currentValue: string, atMaskIndex: number, data: string): OverwriteEditResult | undefined
}

function toCharPredicate(accept: AcceptPredicate): (char: string) => boolean {
  if (typeof accept === "function") return accept
  const source = accept.source
  const flags = accept.flags.replace("g", "")
  const single = new RegExp(source, flags)
  return (char) => single.test(char)
}

function literalCharsOf(template: MaskTemplate): Set<string> {
  return new Set(template.literals.values())
}

export function createInputMask(options: InputMaskOptions): InputMaskController {
  const template = options.mask ? parseMaskTemplate(options.mask, options.placeholder) : undefined
  const literalChars = template ? literalCharsOf(template) : undefined

  const acceptPredicate: (char: string) => boolean = options.accept
    ? toCharPredicate(options.accept)
    : literalChars
      ? (char) => !literalChars.has(char)
      : () => true

  function extractRawContent(value: string): string {
    let result = ""
    for (const char of value) {
      if (acceptPredicate(char)) result += char
    }
    return result
  }

  function format(rawValue: string): string {
    const raw = extractRawContent(rawValue)
    if (template) return applyMask(template, raw)
    if (options.format) return options.format(raw)
    return raw
  }

  function applyOverwriteEdit(
    currentValue: string,
    atMaskIndex: number,
    data: string,
  ): OverwriteEditResult | undefined {
    if (!template) return undefined

    let raw = extractRawContent(currentValue)
    let rawCursor = rawIndexAt(template, atMaskIndex)

    for (const char of data) {
      if (!acceptPredicate(char)) continue
      raw = editRawChars(raw, rawCursor, char, { editMode: "overwrite" })
      rawCursor += 1
    }

    return {
      value: applyMask(template, raw),
      cursor: maskIndexAfterRawCount(template, rawCursor),
    }
  }

  return {
    format,
    extractRawContent,
    accepts: acceptPredicate,
    recordCursor,
    restoreCursor,
    applyOverwriteEdit,
  }
}

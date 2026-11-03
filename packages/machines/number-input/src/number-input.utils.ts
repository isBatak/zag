import { NumberParser } from "@internationalized/number"
import type { Params } from "@zag-js/core"
import { createInputMask, type InputMaskController } from "@zag-js/input-mask"
import type { NumberInputSchema } from "./number-input.types"

export const createFormatter = (locale: string, options: Intl.NumberFormatOptions = {}) => {
  return new Intl.NumberFormat(locale, options)
}

export const createParser = (locale: string, options: Intl.NumberFormatOptions = {}) => {
  return new NumberParser(locale, options)
}

type Ctx = Pick<Params<NumberInputSchema>, "prop" | "computed">

export const parseValue = (value: string, params: Ctx) => {
  const { prop, computed } = params
  if (!prop("formatOptions")) return parseFloat(value)
  if (value === "") return Number.NaN
  return computed("parser").parse(value)
}

export const formatValue = (value: number, params: Ctx): string => {
  const { prop, computed } = params
  if (Number.isNaN(value)) return ""
  if (!prop("formatOptions")) return value.toString()
  return computed("formatter").format(value)
}

export const getDefaultStep = (step: number | undefined, formatOptions: Intl.NumberFormatOptions | undefined) => {
  let defaultStep = step !== undefined && !Number.isNaN(step) ? step : 1
  if (formatOptions?.style === "percent" && (step === undefined || Number.isNaN(step))) {
    defaultStep = 0.01
  }
  return defaultStep
}

/* -----------------------------------------------------------------------------
 * Live formatting (formatMode: "change")
 * -----------------------------------------------------------------------------*/

export interface NumberDecoration {
  prefix: string
  suffix: string
  groupSeparator: string
  decimalSeparator: string
  minusSign: string
}

function detectDecimalSeparator(locale: string, options: Intl.NumberFormatOptions): string {
  try {
    const formatter = new Intl.NumberFormat(locale, { ...options, minimumFractionDigits: 1, maximumFractionDigits: 1 })
    const part = formatter.formatToParts(1.1).find((part) => part.type === "decimal")
    if (part) return part.value
  } catch {
    // options can't support a forced fraction digit (e.g. conflicting rounding config) - fall back below
  }
  return "."
}

export function getNumberDecoration(locale: string, options: Intl.NumberFormatOptions = {}): NumberDecoration {
  const formatter = new Intl.NumberFormat(locale, options)
  const parts = formatter.formatToParts(-1234.5)

  let prefix = ""
  let suffix = ""
  let groupSeparator = ""
  let minusSign = "-"
  let sawDigits = false

  for (const part of parts) {
    if (part.type === "integer" || part.type === "fraction" || part.type === "decimal") {
      sawDigits = true
      continue
    }
    if (part.type === "group") {
      groupSeparator = part.value
      continue
    }
    if (part.type === "minusSign") {
      minusSign = part.value
      continue
    }
    if (sawDigits) {
      suffix += part.value
    } else {
      prefix += part.value
    }
  }

  return { prefix, suffix, groupSeparator, minusSign, decimalSeparator: detectDecimalSeparator(locale, options) }
}

function applyGrouping(digits: string, groupSeparator: string): string {
  if (!groupSeparator || digits.length <= 3) return digits
  const groups: string[] = []
  let i = digits.length
  while (i > 3) {
    groups.unshift(digits.slice(i - 3, i))
    i -= 3
  }
  groups.unshift(digits.slice(0, i))
  return groups.join(groupSeparator)
}

function formatValueLive(raw: string, decoration: NumberDecoration): string {
  const { prefix, suffix, groupSeparator, decimalSeparator, minusSign } = decoration

  let sign = ""
  let rest = raw
  if (minusSign && rest.startsWith(minusSign)) {
    sign = minusSign
    rest = rest.slice(minusSign.length)
  }

  const separatorIndex = decimalSeparator ? rest.indexOf(decimalSeparator) : -1
  const integerRaw = separatorIndex === -1 ? rest : rest.slice(0, separatorIndex)
  const fractionRaw = separatorIndex === -1 ? "" : rest.slice(separatorIndex)

  // Nothing to decorate yet (a lone sign or a lone decimal separator) - leave it untouched
  // rather than showing a bare prefix/suffix around no digits at all.
  if (integerRaw === "") return sign + integerRaw + fractionRaw

  return sign + prefix + applyGrouping(integerRaw, groupSeparator) + fractionRaw + suffix
}

export function createChangeModeMask(
  locale: string,
  formatOptions: Intl.NumberFormatOptions | undefined,
): InputMaskController | undefined {
  if (!formatOptions) return undefined

  const decoration = getNumberDecoration(locale, formatOptions)

  return createInputMask({
    accept: (char) => /[0-9]/.test(char) || char === decoration.decimalSeparator || char === decoration.minusSign,
    format: (raw) => formatValueLive(raw, decoration),
  })
}

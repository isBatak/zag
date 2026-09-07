export interface MaskTemplate {
  mask: string
  placeholder: string
  slots: number[]
  literals: Map<number, string>
}

export function parseMaskTemplate(mask: string, placeholder = "_"): MaskTemplate {
  const slots: number[] = []
  const literals = new Map<number, string>()

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === placeholder) {
      slots.push(i)
    } else {
      literals.set(i, mask[i])
    }
  }

  return { mask, placeholder, slots, literals }
}

export function applyMask(template: MaskTemplate, rawChars: string): string {
  let result = ""
  let rawIndex = 0

  for (let i = 0; i < template.mask.length; i++) {
    if (rawIndex >= rawChars.length) break

    const literal = template.literals.get(i)
    if (literal !== undefined) {
      result += literal
      continue
    }

    result += rawChars[rawIndex]
    rawIndex++
  }

  return result
}

export function rawIndexAt(template: MaskTemplate, maskIndex: number): number {
  let count = 0
  for (const slot of template.slots) {
    if (slot >= maskIndex) break
    count++
  }
  return count
}

export function maskIndexAfterRawCount(template: MaskTemplate, rawCount: number): number {
  if (rawCount <= 0) return 0
  const slotIndex = Math.min(rawCount, template.slots.length) - 1
  return template.slots[slotIndex] + 1
}

export interface EditRawCharsOptions {
  editMode?: "insert" | "overwrite"
}

export function editRawChars(
  rawChars: string,
  rawCursor: number,
  char: string,
  options: EditRawCharsOptions = {},
): string {
  const editMode = options.editMode ?? "insert"

  if (editMode === "overwrite") {
    return rawChars.slice(0, rawCursor) + char + rawChars.slice(rawCursor + 1)
  }

  return rawChars.slice(0, rawCursor) + char + rawChars.slice(rawCursor)
}

export function deleteRawChar(rawChars: string, rawCursor: number, direction: "backward" | "forward"): string {
  if (direction === "backward") {
    if (rawCursor === 0) return rawChars
    return rawChars.slice(0, rawCursor - 1) + rawChars.slice(rawCursor)
  }
  if (rawCursor >= rawChars.length) return rawChars
  return rawChars.slice(0, rawCursor) + rawChars.slice(rawCursor + 1)
}

import { describe, expect, test } from "vitest"
import {
  applyMask,
  deleteRawChar,
  editRawChars,
  maskIndexAfterRawCount,
  parseMaskTemplate,
  rawIndexAt,
} from "../src/mask"

describe("parseMaskTemplate", () => {
  test("splits a date-like template into slots and literals", () => {
    const template = parseMaskTemplate("__-__-____")
    expect(template.slots).toEqual([0, 1, 3, 4, 6, 7, 8, 9])
    expect(Array.from(template.literals.entries())).toEqual([
      [2, "-"],
      [5, "-"],
    ])
  })

  test("supports a custom placeholder character", () => {
    const template = parseMaskTemplate("##/##", "#")
    expect(template.slots).toEqual([0, 1, 3, 4])
    expect(template.literals.get(2)).toBe("/")
  })

  test("a mask with no literals has every position as a slot", () => {
    const template = parseMaskTemplate("____")
    expect(template.slots).toEqual([0, 1, 2, 3])
    expect(template.literals.size).toBe(0)
  })
})

describe("applyMask", () => {
  const template = parseMaskTemplate("__-__-____")

  test("empty raw input produces an empty string", () => {
    expect(applyMask(template, "")).toBe("")
  })

  test("partial input grows without a premature trailing literal", () => {
    expect(applyMask(template, "1")).toBe("1")
    expect(applyMask(template, "12")).toBe("12")
    expect(applyMask(template, "123")).toBe("12-3")
    expect(applyMask(template, "1234")).toBe("12-34")
    expect(applyMask(template, "12345")).toBe("12-34-5")
  })

  test("fully populated input places every literal correctly", () => {
    expect(applyMask(template, "18081978")).toBe("18-08-1978")
  })

  test("raw input one character longer than the slot count truncates the extra character", () => {
    expect(applyMask(template, "180819789")).toBe("18-08-1978")
  })

  test("raw input several characters longer than the slot count still truncates cleanly", () => {
    expect(applyMask(template, "18081978extra")).toBe("18-08-1978")
  })
})

describe("rawIndexAt", () => {
  const template = parseMaskTemplate("__-__-____")

  test("maps a mask position directly on a slot to the matching raw index", () => {
    expect(rawIndexAt(template, 0)).toBe(0)
    expect(rawIndexAt(template, 1)).toBe(1)
    expect(rawIndexAt(template, 4)).toBe(3)
  })

  test("maps a mask position sitting on a literal to the raw index right after the preceding slot", () => {
    expect(rawIndexAt(template, 2)).toBe(2)
    expect(rawIndexAt(template, 3)).toBe(2)
  })

  test("maps the very end of the mask to the total slot count", () => {
    expect(rawIndexAt(template, 10)).toBe(8)
  })
})

describe("maskIndexAfterRawCount", () => {
  const template = parseMaskTemplate("__-__-____")

  test("zero raw characters places the cursor at the very start", () => {
    expect(maskIndexAfterRawCount(template, 0)).toBe(0)
  })

  test("after the first raw character, cursor sits right before the second slot", () => {
    expect(maskIndexAfterRawCount(template, 1)).toBe(1)
  })

  test("after filling a group right before a literal, cursor sits before the literal, not past it", () => {
    expect(maskIndexAfterRawCount(template, 2)).toBe(2)
  })

  test("after filling every slot, cursor sits at the very end of the mask", () => {
    expect(maskIndexAfterRawCount(template, 8)).toBe(10)
  })

  test("raw counts beyond the slot count clamp to the end of the mask", () => {
    expect(maskIndexAfterRawCount(template, 20)).toBe(10)
  })
})

describe("editRawChars", () => {
  test("insert mode shifts trailing characters right", () => {
    expect(editRawChars("1234", 2, "9")).toBe("12934")
  })

  test("overwrite mode replaces the character at the cursor without shifting", () => {
    expect(editRawChars("1234", 2, "9", { editMode: "overwrite" })).toBe("1294")
  })

  test("overwrite mode at the very end appends, since there is nothing to replace", () => {
    expect(editRawChars("1234", 4, "9", { editMode: "overwrite" })).toBe("12349")
  })
})

describe("deleteRawChar", () => {
  test("backward deletion removes the character before the cursor", () => {
    expect(deleteRawChar("1234", 2, "backward")).toBe("134")
  })

  test("backward deletion at the start is a no-op", () => {
    expect(deleteRawChar("1234", 0, "backward")).toBe("1234")
  })

  test("forward deletion removes the character at the cursor", () => {
    expect(deleteRawChar("1234", 2, "forward")).toBe("124")
  })

  test("forward deletion at the end is a no-op", () => {
    expect(deleteRawChar("1234", 4, "forward")).toBe("1234")
  })
})

describe("deleting repeatedly through a fully populated raw value", () => {
  test("backward deletion from the end makes forward progress every step until empty, then becomes a genuine no-op", () => {
    const template = parseMaskTemplate("__-__-____")
    let raw = "18081978"
    let rawCursor = raw.length

    const lengths: number[] = []
    for (let i = 0; i < 10; i++) {
      const nextRaw = deleteRawChar(raw, rawCursor, "backward")
      lengths.push(nextRaw.length)
      raw = nextRaw
      rawCursor -= 1
    }

    expect(lengths).toEqual([7, 6, 5, 4, 3, 2, 1, 0, 0, 0])
    expect(applyMask(template, raw)).toBe("")
  })
})

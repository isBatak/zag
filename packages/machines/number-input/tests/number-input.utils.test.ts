import { describe, expect, test } from "vitest"
import { createChangeModeMask, getNumberDecoration } from "../src/number-input.utils"

describe("getNumberDecoration", () => {
  test("plain decimal (en-US)", () => {
    expect(getNumberDecoration("en-US")).toMatchObject({
      prefix: "",
      suffix: "",
      groupSeparator: ",",
      decimalSeparator: ".",
      minusSign: "-",
    })
  })

  test("currency (en-US, USD) puts the symbol in the prefix", () => {
    expect(getNumberDecoration("en-US", { style: "currency", currency: "USD" })).toMatchObject({
      prefix: "$",
      suffix: "",
      groupSeparator: ",",
      decimalSeparator: ".",
      minusSign: "-",
    })
  })

  test("percent (en-US) puts the sign in the suffix", () => {
    expect(getNumberDecoration("en-US", { style: "percent" })).toMatchObject({
      prefix: "",
      suffix: "%",
      groupSeparator: ",",
      minusSign: "-",
    })
  })

  test("currency (de-DE, EUR) uses locale-specific separators and a suffixed symbol", () => {
    expect(getNumberDecoration("de-DE", { style: "currency", currency: "EUR" })).toMatchObject({
      prefix: "",
      suffix: " €",
      groupSeparator: ".",
      decimalSeparator: ",",
      minusSign: "-",
    })
  })

  test("useGrouping: false produces no group separator", () => {
    expect(getNumberDecoration("en-US", { useGrouping: false }).groupSeparator).toBe("")
  })

  test("a maximumFractionDigits: 0 style still detects the locale's decimal separator", () => {
    expect(getNumberDecoration("en-US", { maximumFractionDigits: 0 }).decimalSeparator).toBe(".")
  })
})

describe("createChangeModeMask", () => {
  test("returns undefined without formatOptions", () => {
    expect(createChangeModeMask("en-US", undefined)).toBeUndefined()
  })

  describe("currency (en-US, USD)", () => {
    const mask = createChangeModeMask("en-US", { style: "currency", currency: "USD" })!

    test("groups the integer portion", () => {
      expect(mask.format("1234")).toBe("$1,234")
    })

    test("keeps an in-progress decimal point instead of dropping it", () => {
      expect(mask.format("1234.")).toBe("$1,234.")
    })

    test("leaves the fractional tail untouched, including trailing zeros", () => {
      expect(mask.format("1234.50")).toBe("$1,234.50")
    })

    test("keeps a lone negative sign undecorated", () => {
      expect(mask.format("-")).toBe("-")
    })

    test("places the sign before the currency prefix", () => {
      expect(mask.format("-1234.5")).toBe("-$1,234.5")
    })

    test("empty value stays empty", () => {
      expect(mask.format("")).toBe("")
    })

    test("re-formatting an already-decorated value is idempotent", () => {
      const once = mask.format("1234.5")
      expect(mask.format(once)).toBe(once)
    })

    test("strips a previously-formatted value before regrouping a newly typed digit", () => {
      // simulates the DOM already showing "$1,234" and the user typing another digit
      expect(mask.format("$1,2345")).toBe("$12,345")
    })
  })

  describe("percent (en-US)", () => {
    const mask = createChangeModeMask("en-US", { style: "percent" })!

    test("appends the percent sign as a suffix", () => {
      expect(mask.format("50")).toBe("50%")
    })

    test("keeps an in-progress decimal point", () => {
      expect(mask.format("12.")).toBe("12.%")
    })
  })
})

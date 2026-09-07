// @vitest-environment jsdom

import { describe, expect, test } from "vitest"
import { attachInputMask } from "../src/attach-input-mask"
import type { InputMaskOptions } from "../src/create-input-mask"

function createInput(initialValue = ""): HTMLInputElement {
  const el = document.createElement("input")
  el.type = "text"
  el.value = initialValue
  document.body.appendChild(el)
  el.focus()
  return el
}

function dispatchBeforeInput(el: HTMLInputElement, data: string, inputType: string) {
  const event = new InputEvent("beforeinput", { data, inputType, bubbles: true, cancelable: true })
  return el.dispatchEvent(event)
}

function dispatchInput(el: HTMLInputElement) {
  el.dispatchEvent(new Event("input", { bubbles: true }))
}

function typeChar(el: HTMLInputElement, char: string) {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? start
  const notPrevented = dispatchBeforeInput(el, char, "insertText")
  if (notPrevented) {
    el.value = el.value.slice(0, start) + char + el.value.slice(end)
    el.setSelectionRange(start + char.length, start + char.length)
    dispatchInput(el)
  }
}

function type(el: HTMLInputElement, text: string) {
  for (const char of text) typeChar(el, char)
}

function backspace(el: HTMLInputElement) {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? start
  if (start === end && start === 0) return
  const notPrevented = dispatchBeforeInput(el, "", "deleteContentBackward")
  if (!notPrevented) return
  if (start === end) {
    el.value = el.value.slice(0, start - 1) + el.value.slice(start)
    el.setSelectionRange(start - 1, start - 1)
  } else {
    el.value = el.value.slice(0, start) + el.value.slice(end)
    el.setSelectionRange(start, start)
  }
  dispatchInput(el)
}

function forwardDelete(el: HTMLInputElement) {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? start
  if (start === end && start >= el.value.length) return
  const notPrevented = dispatchBeforeInput(el, "", "deleteContentForward")
  if (!notPrevented) return
  if (start === end) {
    el.value = el.value.slice(0, start) + el.value.slice(start + 1)
  } else {
    el.value = el.value.slice(0, start) + el.value.slice(end)
  }
  el.setSelectionRange(start, start)
  dispatchInput(el)
}

function setup(options: InputMaskOptions, initialValue = "") {
  const el = createInput(initialValue)
  const detach = attachInputMask(el, options)
  return { el, detach }
}

describe("attachInputMask - insert mode (default) with a mask template", () => {
  test("typing digits progressively builds the masked display", () => {
    const { el } = setup({ mask: "__-__-____", accept: /\d/ })
    type(el, "18081978")
    expect(el.value).toBe("18-08-1978")
  })

  test("typing a non-matching character is rejected outright", () => {
    const { el } = setup({ mask: "__-__-____", accept: /\d/ })
    type(el, "18")
    type(el, "x")
    expect(el.value).toBe("18")
    expect(el.selectionStart).toBe(2)
  })

  test("typing one extra digit past the template's capacity is dropped", () => {
    const { el } = setup({ mask: "__-__-____", accept: /\d/ })
    type(el, "180819789")
    expect(el.value).toBe("18-08-1978")
  })

  test("backspace repeatedly from the end makes progress every step and stops cleanly at empty", () => {
    const { el } = setup({ mask: "__-__-____", accept: /\d/ }, "18-08-1978")
    el.setSelectionRange(el.value.length, el.value.length)

    const values: string[] = []
    for (let i = 0; i < 12; i++) {
      backspace(el)
      values.push(el.value)
    }

    expect(values).toEqual(["18-08-197", "18-08-19", "18-08-1", "18-08", "18-0", "18", "1", "", "", "", "", ""])
  })
})

describe("attachInputMask - overwrite mode with a mask template", () => {
  test("typing over an already-filled slot replaces that digit without shifting the rest", () => {
    const { el } = setup({ mask: "__-__-____", accept: /\d/, editMode: "overwrite" }, "18-08-1978")
    el.setSelectionRange(0, 0)
    typeChar(el, "9")
    expect(el.value).toBe("98-08-1978")
    expect(el.selectionStart).toBe(1)
  })

  test("typing past the end still appends normally", () => {
    const { el } = setup({ mask: "__-__-____", accept: /\d/, editMode: "overwrite" }, "18-08-197")
    el.setSelectionRange(9, 9)
    typeChar(el, "8")
    expect(el.value).toBe("18-08-1978")
  })
})

describe("attachInputMask - eager initial formatting", () => {
  test("the display value is formatted immediately on attach, before any interaction", () => {
    const el = createInput("18081978")
    attachInputMask(el, { mask: "__-__-____", accept: /\d/ })
    expect(el.value).toBe("18-08-1978")
  })
})

describe("attachInputMask - free-form formatter without a mask template", () => {
  test("a plain grouping formatter reformats live as digits are typed", () => {
    const { el } = setup({
      format: (raw) => raw.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
      accept: /\d/,
    })
    type(el, "9999")
    expect(el.value).toBe("9,999")
  })
})

describe("attachInputMask - detach", () => {
  test("after detaching, typing no longer reformats or rejects characters", () => {
    const { el, detach } = setup({ mask: "__-__-____", accept: /\d/ })
    detach()
    type(el, "abc")
    expect(el.value).toBe("abc")
  })
})

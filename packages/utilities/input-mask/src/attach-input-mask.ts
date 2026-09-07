import { setElementValue } from "@zag-js/dom-query"
import { createInputMask, type InputMaskOptions } from "./create-input-mask"

type MaskableElement = HTMLInputElement | HTMLTextAreaElement

export function attachInputMask(el: MaskableElement, options: InputMaskOptions): () => void {
  const controller = createInputMask(options)

  setElementValue(el, controller.format(el.value))

  function onBeforeInput(event: InputEvent) {
    const data = event.data
    if (!data) return

    for (const char of data) {
      if (!controller.accepts(char)) {
        event.preventDefault()
        return
      }
    }

    if (options.editMode !== "overwrite") return

    const atMaskIndex = el.selectionStart ?? el.value.length
    const result = controller.applyOverwriteEdit(el.value, atMaskIndex, data)
    if (!result) return

    event.preventDefault()
    setElementValue(el, result.value)
    el.setSelectionRange(result.cursor, result.cursor)
  }

  function onInput() {
    const selection = controller.recordCursor(el)
    const formatted = controller.format(el.value)
    setElementValue(el, formatted)
    controller.restoreCursor(el, selection)
  }

  const beforeInputListener = onBeforeInput as EventListener

  el.addEventListener("beforeinput", beforeInputListener)
  el.addEventListener("input", onInput)

  return () => {
    el.removeEventListener("beforeinput", beforeInputListener)
    el.removeEventListener("input", onInput)
  }
}

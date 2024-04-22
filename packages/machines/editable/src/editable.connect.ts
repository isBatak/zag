import { getNativeEvent, type EventKeyMap } from "@zag-js/dom-event"
import { ariaAttr, dataAttr } from "@zag-js/dom-query"
import type { NormalizeProps, PropTypes } from "@zag-js/types"
import { parts } from "./editable.anatomy"
import { dom } from "./editable.dom"
import type { MachineApi, Send, State } from "./editable.types"

export function connect<T extends PropTypes>(state: State, send: Send, normalize: NormalizeProps<T>): MachineApi<T> {
  const disabled = state.context.disabled
  const interactive = state.context.isInteractive
  const readOnly = state.context.readOnly
  const empty = state.context.isValueEmpty
  const invalid = state.context.invalid

  const autoResize = state.context.autoResize
  const translations = state.context.translations

  const editing = state.matches("edit")

  const placeholderProp = state.context.placeholder
  const placeholder =
    typeof placeholderProp === "string" ? { edit: placeholderProp, preview: placeholderProp } : placeholderProp

  return {
    editing,
    empty,
    value: state.context.value,
    setValue(value) {
      send({ type: "SET_VALUE", value })
    },
    clearValue() {
      send({ type: "SET_VALUE", value: "" })
    },
    edit() {
      if (!interactive) return
      send("EDIT")
    },
    cancel() {
      if (!interactive) return
      send("CANCEL")
    },
    submit() {
      if (!interactive) return
      send("SUBMIT")
    },

    rootProps: normalize.element({
      ...parts.root.attrs,
      id: dom.getRootId(state.context),
      dir: state.context.dir,
    }),

    areaProps: normalize.element({
      ...parts.area.attrs,
      id: dom.getAreaId(state.context),
      dir: state.context.dir,
      style: autoResize ? { display: "inline-grid" } : undefined,
      "data-focus": dataAttr(editing),
      "data-disabled": dataAttr(disabled),
      "data-placeholder-shown": dataAttr(empty),
    }),

    labelProps: normalize.label({
      ...parts.label.attrs,
      id: dom.getLabelId(state.context),
      dir: state.context.dir,
      htmlFor: dom.getInputId(state.context),
      "data-focus": dataAttr(editing),
      "data-invalid": dataAttr(invalid),
      onClick() {
        if (editing) return
        const previewEl = dom.getPreviewEl(state.context)
        previewEl?.focus({ preventScroll: true })
      },
    }),

    inputProps: normalize.input({
      ...parts.input.attrs,
      dir: state.context.dir,
      "aria-label": translations.input,
      name: state.context.name,
      form: state.context.form,
      id: dom.getInputId(state.context),
      hidden: autoResize ? undefined : !editing,
      placeholder: placeholder?.edit,
      maxLength: state.context.maxLength,
      disabled: disabled,
      "data-disabled": dataAttr(disabled),
      readOnly: readOnly,
      "data-readonly": dataAttr(readOnly),
      "aria-invalid": ariaAttr(invalid),
      "data-invalid": dataAttr(invalid),
      defaultValue: state.context.value,
      size: autoResize ? 1 : undefined,
      onChange(event) {
        send({ type: "TYPE", value: event.currentTarget.value })
      },
      onKeyDown(event) {
        if (event.defaultPrevented) return
        const evt = getNativeEvent(event)
        if (evt.isComposing) return

        const keyMap: EventKeyMap = {
          Escape() {
            send("CANCEL")
          },
          Enter(event) {
            if (!event.shiftKey && !event.metaKey) {
              send("ENTER")
            }
          },
        }

        const exec = keyMap[event.key]

        if (exec) {
          event.preventDefault()
          exec(event)
        }
      },
      style: autoResize
        ? {
            all: "unset",
            gridArea: "1 / 1 / auto / auto",
            visibility: !editing ? "hidden" : undefined,
          }
        : undefined,
    }),

    previewProps: normalize.element({
      id: dom.getPreviewId(state.context),
      ...parts.preview.attrs,
      dir: state.context.dir,
      "data-placeholder-shown": dataAttr(empty),
      "aria-readonly": ariaAttr(readOnly),
      "data-readonly": dataAttr(disabled),
      "data-disabled": dataAttr(disabled),
      "aria-disabled": ariaAttr(disabled),
      "aria-invalid": ariaAttr(invalid),
      "data-invalid": dataAttr(invalid),
      children: empty ? placeholder?.preview : state.context.value,
      hidden: autoResize ? undefined : editing,
      tabIndex: interactive && state.context.isPreviewFocusable ? 0 : undefined,
      onFocus() {
        if (!interactive) return
        send("FOCUS")
      },
      onDoubleClick() {
        if (!interactive) return
        send("DBLCLICK")
      },
      style: autoResize
        ? {
            whiteSpace: "pre",
            userSelect: "none",
            gridArea: "1 / 1 / auto / auto",
            visibility: editing ? "hidden" : undefined,
            // in event the preview overflow's the parent element
            overflow: "hidden",
            textOverflow: "ellipsis",
          }
        : undefined,
    }),

    editTriggerProps: normalize.button({
      ...parts.editTrigger.attrs,
      id: dom.getEditTriggerId(state.context),
      dir: state.context.dir,
      "aria-label": translations.edit,
      hidden: editing,
      type: "button",
      disabled: disabled,
      onClick(event) {
        if (event.defaultPrevented) return
        if (!interactive) return
        send("EDIT")
      },
    }),

    controlProps: normalize.element({
      id: dom.getControlId(state.context),
      ...parts.control.attrs,
      dir: state.context.dir,
    }),

    submitTriggerProps: normalize.button({
      ...parts.submitTrigger.attrs,
      dir: state.context.dir,
      id: dom.getSubmitTriggerId(state.context),
      "aria-label": translations.submit,
      hidden: !editing,
      disabled: disabled,
      type: "button",
      onClick(event) {
        if (event.defaultPrevented) return
        if (!interactive) return
        send("SUBMIT")
      },
    }),

    cancelTriggerProps: normalize.button({
      ...parts.cancelTrigger.attrs,
      dir: state.context.dir,
      "aria-label": translations.cancel,
      id: dom.getCancelTriggerId(state.context),
      hidden: !editing,
      type: "button",
      disabled: disabled,
      onClick(event) {
        if (event.defaultPrevented) return
        if (!interactive) return
        send("CANCEL")
      },
    }),
  }
}

import {
  clickIfLink,
  getEventKey,
  getNativeEvent,
  isContextMenuEvent,
  isLeftClick,
  type EventKeyMap,
} from "@zag-js/dom-event"
import { ariaAttr, dataAttr, isDownloadingEvent, isOpeningInNewTab, raf } from "@zag-js/dom-query"
import { getPlacementStyles } from "@zag-js/popper"
import type { NormalizeProps, PropTypes } from "@zag-js/types"
import { parts } from "./combobox.anatomy"
import { dom } from "./combobox.dom"
import type { CollectionItem, ItemProps, ItemState, MachineApi, Send, State } from "./combobox.types"

export function connect<T extends PropTypes, V extends CollectionItem>(
  state: State,
  send: Send,
  normalize: NormalizeProps<T>,
): MachineApi<T, V> {
  const translations = state.context.translations
  const collection = state.context.collection

  const disabled = state.context.disabled
  const interactive = state.context.isInteractive
  const invalid = state.context.invalid
  const readOnly = state.context.readOnly

  const open = state.hasTag("open")
  const focused = state.hasTag("focused")
  const isDialogPopup = state.context.popup === "dialog"

  const popperStyles = getPlacementStyles({
    ...state.context.positioning,
    placement: state.context.currentPlacement,
  })

  function getItemState(props: ItemProps): ItemState {
    const { item } = props
    const disabled = collection.isItemDisabled(item)
    const value = collection.itemToValue(item)
    return {
      value,
      disabled: Boolean(disabled || disabled),
      highlighted: state.context.highlightedValue === value,
      selected: state.context.value.includes(value),
    }
  }

  return {
    focused,
    open,
    inputValue: state.context.inputValue,
    inputEmpty: state.context.isInputValueEmpty,
    highlightedValue: state.context.highlightedValue,
    highlightedItem: state.context.highlightedItem,
    value: state.context.value,
    valueAsString: state.context.valueAsString,
    hasSelectedItems: state.context.hasSelectedItems,
    selectedItems: state.context.selectedItems,
    collection: state.context.collection,
    reposition(options = {}) {
      send({ type: "POSITIONING.SET", options })
    },
    setCollection(collection) {
      send({ type: "COLLECTION.SET", value: collection })
    },
    highlightValue(value) {
      send({ type: "HIGHLIGHTED_VALUE.SET", value })
    },
    selectValue(value) {
      send({ type: "ITEM.SELECT", value })
    },
    setValue(value) {
      send({ type: "VALUE.SET", value })
    },
    setInputValue(value) {
      send({ type: "INPUT_VALUE.SET", value })
    },
    clearValue(value) {
      if (value != null) {
        send({ type: "ITEM.CLEAR", value })
      } else {
        send("VALUE.CLEAR")
      }
    },
    focus() {
      dom.getInputEl(state.context)?.focus()
    },
    setOpen(_open) {
      if (_open === open) return
      send(_open ? "OPEN" : "CLOSE")
    },
    rootProps: normalize.element({
      ...parts.root.attrs,
      dir: state.context.dir,
      id: dom.getRootId(state.context),
      "data-invalid": dataAttr(invalid),
      "data-readonly": dataAttr(readOnly),
    }),

    labelProps: normalize.label({
      ...parts.label.attrs,
      dir: state.context.dir,
      htmlFor: dom.getInputId(state.context),
      id: dom.getLabelId(state.context),
      "data-readonly": dataAttr(readOnly),
      "data-disabled": dataAttr(disabled),
      "data-invalid": dataAttr(invalid),
      "data-focus": dataAttr(focused),
      onClick(event) {
        if (!isDialogPopup) return
        event.preventDefault()
        dom.getTriggerEl(state.context)?.focus({ preventScroll: true })
      },
    }),

    controlProps: normalize.element({
      ...parts.control.attrs,
      dir: state.context.dir,
      id: dom.getControlId(state.context),
      "data-state": open ? "open" : "closed",
      "data-focus": dataAttr(focused),
      "data-disabled": dataAttr(disabled),
      "data-invalid": dataAttr(invalid),
    }),

    positionerProps: normalize.element({
      ...parts.positioner.attrs,
      dir: state.context.dir,
      id: dom.getPositionerId(state.context),
      style: popperStyles.floating,
    }),

    inputProps: normalize.input({
      ...parts.input.attrs,
      dir: state.context.dir,
      "aria-invalid": ariaAttr(invalid),
      "data-invalid": dataAttr(invalid),
      name: state.context.name,
      form: state.context.form,
      disabled: disabled,
      autoFocus: state.context.autoFocus,
      autoComplete: "off",
      autoCorrect: "off",
      autoCapitalize: "none",
      spellCheck: "false",
      readOnly: readOnly,
      placeholder: state.context.placeholder,
      id: dom.getInputId(state.context),
      type: "text",
      role: "combobox",
      defaultValue: state.context.inputValue,
      "aria-autocomplete": state.context.autoComplete ? "both" : "list",
      "aria-controls": isDialogPopup ? dom.getListId(state.context) : dom.getContentId(state.context),
      "aria-expanded": open,
      "data-state": open ? "open" : "closed",
      "aria-activedescendant": state.context.highlightedValue
        ? dom.getItemId(state.context, state.context.highlightedValue)
        : undefined,
      onClick() {
        if (!state.context.openOnClick) return
        if (!interactive) return
        send("INPUT.CLICK")
      },
      onFocus() {
        if (disabled) return
        send("INPUT.FOCUS")
      },
      onBlur() {
        if (disabled) return
        send("INPUT.BLUR")
      },
      onChange(event) {
        send({ type: "INPUT.CHANGE", value: event.currentTarget.value })
      },
      onKeyDown(event) {
        if (event.defaultPrevented) return
        if (!interactive) return

        const evt = getNativeEvent(event)
        if (evt.ctrlKey || evt.shiftKey || evt.isComposing) return

        const openOnKeyPress = state.context.openOnKeyPress
        const isModifierKey = event.ctrlKey || event.metaKey || event.shiftKey
        const keypress = true

        const keymap: EventKeyMap = {
          ArrowDown(event) {
            if (!openOnKeyPress && !open) return
            send({ type: event.altKey ? "OPEN" : "INPUT.ARROW_DOWN", keypress })
            event.preventDefault()
          },
          ArrowUp() {
            if (!openOnKeyPress && !open) return
            send({ type: event.altKey ? "CLOSE" : "INPUT.ARROW_UP", keypress })
            event.preventDefault()
          },
          Home(event) {
            if (isModifierKey) return
            send({ type: "INPUT.HOME", keypress })
            if (open) {
              event.preventDefault()
            }
          },
          End(event) {
            if (isModifierKey) return
            send({ type: "INPUT.END", keypress })
            if (open) {
              event.preventDefault()
            }
          },
          Enter(event) {
            if (evt.isComposing) return
            send({ type: "INPUT.ENTER", keypress })
            if (open) {
              event.preventDefault()
            }
            const itemEl = dom.getHighlightedItemEl(state.context)
            clickIfLink(itemEl)
          },
          Escape() {
            send({ type: "INPUT.ESCAPE", keypress })
            event.preventDefault()
          },
        }

        const key = getEventKey(event, state.context)
        const exec = keymap[key]
        exec?.(event)
      },
    }),

    triggerProps: normalize.button({
      ...parts.trigger.attrs,
      dir: state.context.dir,
      id: dom.getTriggerId(state.context),
      "aria-haspopup": isDialogPopup ? "dialog" : "listbox",
      type: "button",
      tabIndex: isDialogPopup ? 0 : -1,
      "aria-label": translations.triggerLabel,
      "aria-expanded": open,
      "data-state": open ? "open" : "closed",
      "aria-controls": open ? dom.getContentId(state.context) : undefined,
      disabled: disabled,
      "data-readonly": dataAttr(readOnly),
      "data-disabled": dataAttr(disabled),
      onClick(event) {
        const evt = getNativeEvent(event)
        if (!interactive) return
        if (!isLeftClick(evt)) return
        send("TRIGGER.CLICK")
      },
      onPointerDown(event) {
        if (!interactive) return
        if (event.pointerType === "touch") return
        event.preventDefault()
        queueMicrotask(() => {
          dom.getInputEl(state.context)?.focus({ preventScroll: true })
        })
      },
      onKeyDown(event) {
        if (event.defaultPrevented) return
        if (!isDialogPopup) return

        const keyMap: EventKeyMap = {
          ArrowDown() {
            send("INPUT.FOCUS")
            send("INPUT.ARROW_DOWN")
            raf(() => {
              dom.getInputEl(state.context)?.focus({ preventScroll: true })
            })
          },
          ArrowUp() {
            send("INPUT.FOCUS")
            send("INPUT.ARROW_UP")
            raf(() => {
              dom.getInputEl(state.context)?.focus({ preventScroll: true })
            })
          },
        }

        const key = getEventKey(event, state.context)
        const exec = keyMap[key]

        if (exec) {
          exec(event)
          event.preventDefault()
        }
      },
    }),

    contentProps: normalize.element({
      ...parts.content.attrs,
      dir: state.context.dir,
      id: dom.getContentId(state.context),
      role: isDialogPopup ? "dialog" : "listbox",
      tabIndex: -1,
      hidden: !open,
      "data-state": open ? "open" : "closed",
      "aria-labelledby": dom.getLabelId(state.context),
      "aria-multiselectable": state.context.multiple && !isDialogPopup ? true : undefined,
      onPointerDown(event) {
        // prevent options or elements within listbox from taking focus
        event.preventDefault()
      },
    }),

    // only used when triggerOnly: true
    listProps: normalize.element({
      id: dom.getListId(state.context),
      role: isDialogPopup ? "listbox" : undefined,
      "aria-multiselectable": isDialogPopup && state.context.multiple ? true : undefined,
    }),

    clearTriggerProps: normalize.button({
      ...parts.clearTrigger.attrs,
      dir: state.context.dir,
      id: dom.getClearTriggerId(state.context),
      type: "button",
      tabIndex: -1,
      disabled: disabled,
      "aria-label": translations.clearTriggerLabel,
      "aria-controls": dom.getInputId(state.context),
      hidden: !state.context.value.length,
      onClick() {
        if (!interactive) return
        send({ type: "VALUE.CLEAR", src: "clear-trigger" })
      },
    }),

    getItemState,

    getItemProps(props) {
      const itemState = getItemState(props)
      const value = itemState.value

      return normalize.element({
        ...parts.item.attrs,
        dir: state.context.dir,
        id: dom.getItemId(state.context, value),
        role: "option",
        tabIndex: -1,
        "data-highlighted": dataAttr(itemState.highlighted),
        "data-state": itemState.selected ? "checked" : "unchecked",
        "aria-selected": itemState.highlighted,
        "aria-disabled": itemState.disabled,
        "data-disabled": dataAttr(itemState.disabled),
        "data-value": itemState.value,
        onPointerMove() {
          if (itemState.disabled) return
          send({ type: "ITEM.POINTER_MOVE", value })
        },
        onPointerLeave() {
          if (props.persistFocus) return
          if (itemState.disabled) return
          const mouseMoved = state.previousEvent.type === "ITEM.POINTER_MOVE"
          if (!mouseMoved) return
          send({ type: "ITEM.POINTER_LEAVE", value })
        },
        onPointerUp(event) {
          if (isDownloadingEvent(event)) return
          if (isOpeningInNewTab(event)) return
          if (isContextMenuEvent(event)) return
          if (itemState.disabled) return
          send({ type: "ITEM.CLICK", src: "pointerup", value })
        },
        onTouchEnd(event) {
          // prevent clicking elements behind content
          event.preventDefault()
          event.stopPropagation()
        },
      })
    },

    getItemTextProps(props) {
      const itemState = getItemState(props)
      return normalize.element({
        ...parts.itemText.attrs,
        dir: state.context.dir,
        "data-disabled": dataAttr(itemState.disabled),
        "data-highlighted": dataAttr(itemState.highlighted),
      })
    },
    getItemIndicatorProps(props) {
      const itemState = getItemState(props)
      return normalize.element({
        "aria-hidden": true,
        ...parts.itemIndicator.attrs,
        dir: state.context.dir,
        "data-state": itemState.selected ? "checked" : "unchecked",
        hidden: !itemState.selected,
      })
    },

    getItemGroupProps(props) {
      const { id } = props
      return normalize.element({
        ...parts.itemGroup.attrs,
        dir: state.context.dir,
        id: dom.getItemGroupId(state.context, id),
        "aria-labelledby": dom.getItemGroupLabelId(state.context, id),
      })
    },

    getItemGroupLabelProps(props) {
      const { htmlFor } = props
      return normalize.element({
        ...parts.itemGroupLabel.attrs,
        dir: state.context.dir,
        id: dom.getItemGroupLabelId(state.context, htmlFor),
        role: "group",
      })
    },
  }
}

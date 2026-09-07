export function getNextCursorPosition(oldValue: string, newValue: string, oldPosition: number): number {
  const beforeCursor = oldValue.slice(0, oldPosition)
  const afterCursor = oldValue.slice(oldPosition)

  let prefixLength = 0
  const maxPrefixLength = Math.min(beforeCursor.length, newValue.length)

  for (let i = 0; i < maxPrefixLength; i++) {
    if (beforeCursor[i] === newValue[i]) {
      prefixLength = i + 1
    } else {
      break
    }
  }

  let suffixLength = 0
  const maxSuffixLength = Math.min(afterCursor.length, newValue.length - prefixLength)

  for (let i = 0; i < maxSuffixLength; i++) {
    const oldIndex = afterCursor.length - 1 - i
    const newIndex = newValue.length - 1 - i

    if (afterCursor[oldIndex] === newValue[newIndex]) {
      suffixLength = i + 1
    } else {
      break
    }
  }

  if (beforeCursor.length > 0 && prefixLength >= beforeCursor.length) {
    return prefixLength
  }

  if (suffixLength >= afterCursor.length) {
    return newValue.length - suffixLength
  }

  if (prefixLength > 0) {
    return prefixLength
  }

  if (suffixLength > 0) {
    return newValue.length - suffixLength
  }

  if (oldPosition === 0 && prefixLength === 0 && suffixLength === 0) {
    return newValue.length
  }

  if (oldValue.length > 0) {
    const ratio = oldPosition / oldValue.length
    return Math.round(ratio * newValue.length)
  }

  return newValue.length
}

export function cloneJsonValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

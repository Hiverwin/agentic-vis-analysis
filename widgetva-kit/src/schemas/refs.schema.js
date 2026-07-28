const REF_PATTERN = '^wl:\\/\\/[^/]+\\/workspace\\/[^/]+\\/.+$'

export const REF_SCHEMA = {
  type: 'string',
  pattern: REF_PATTERN,
}

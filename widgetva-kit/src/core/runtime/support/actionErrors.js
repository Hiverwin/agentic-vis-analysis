export class ActionPreconditionError extends Error {
  constructor(message, details, recoveryHints) {
    super(message)
    this.name = 'ActionPreconditionError'
    this.details = details
    this.recoveryHints = Array.isArray(recoveryHints) ? recoveryHints : []
  }
}

export function throwActionPrecondition(message, details, recoveryHints) {
  throw new ActionPreconditionError(message, details, recoveryHints)
}

export function isActionPreconditionError(error) {
  return error instanceof ActionPreconditionError
}

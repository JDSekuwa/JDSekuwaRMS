/**
 * Custom application error thrown when a user is not authenticated.
 */
export class UnauthenticatedError extends Error {
  public statusCode = 401;

  constructor(message = "Unauthenticated: You must be logged in to perform this action.") {
    super(message);
    this.name = "UnauthenticatedError";
    Object.setPrototypeOf(this, UnauthenticatedError.prototype);
  }
}

/**
 * Custom application error thrown when a user is authenticated but does not have the required permissions.
 */
export class ForbiddenError extends Error {
  public statusCode = 403;

  constructor(message = "Forbidden: You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * Custom application error thrown when stock of an inventory ingredient is too low for a transaction.
 */
export class InsufficientStockError extends Error {
  public statusCode = 400;

  constructor(message = "Insufficient stock for one or more ingredients.") {
    super(message);
    this.name = "InsufficientStockError";
    Object.setPrototypeOf(this, InsufficientStockError.prototype);
  }
}

/**
 * Custom application error thrown when an optimistic locking check fails on a Table or Order state change.
 */
export class TableConflictError extends Error {
  public statusCode = 409;

  constructor(message = "Table state conflict: another transaction modified this table.") {
    super(message);
    this.name = "TableConflictError";
    Object.setPrototypeOf(this, TableConflictError.prototype);
  }
}

/**
 * Custom application error thrown when an optimistic locking check fails on a Room or Stay state change.
 */
export class RoomConflictError extends Error {
  public statusCode = 409;

  constructor(message = "Room state conflict: another transaction modified this room or stay.") {
    super(message);
    this.name = "RoomConflictError";
    Object.setPrototypeOf(this, RoomConflictError.prototype);
  }
}


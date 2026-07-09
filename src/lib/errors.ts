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

export class ApiRouteError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
    this.details = details;
  }
}

export function assert(condition: unknown, status: number, message: string, details?: Record<string, unknown>): asserts condition {
  if (!condition) {
    throw new ApiRouteError(status, message, details);
  }
}

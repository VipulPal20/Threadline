/** Error carrying an HTTP status. Thrown by services and auth guards, rendered by lib/http.ts. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const badRequest = (message: string) => new ApiError(400, message);
export const unauthorized = (message = "Please sign in.") => new ApiError(401, message);
export const forbidden = (message = "You do not have access to this.") => new ApiError(403, message);
export const notFound = (message = "Not found.") => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);
export const tooMany = (message = "Too many attempts. Try again later.") => new ApiError(429, message);

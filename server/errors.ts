export class DomainError extends Error {
  constructor(
    public code: string,
    public httpStatus: 400 | 401 | 404 | 409,
    public detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}

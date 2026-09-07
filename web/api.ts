export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok)
    throw new ApiError(
      body.error?.message ?? "Request failed. Refresh and try again.",
      response.status,
    );
  return body as T;
}

export function parentHeaders(parentId: string) {
  return { "Content-Type": "application/json", "X-Demo-Parent-Id": parentId };
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Request failed. Refresh and try again.";
}

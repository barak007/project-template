export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Maps the server's `{ error: { code, message } }` envelope to an ApiError. */
export async function toApiError(response: {
  status: number;
  json: () => Promise<unknown>;
}): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  return new ApiError(
    body?.error?.code ?? "REQUEST_FAILED",
    body?.error?.message ?? `Request failed with status ${response.status}`,
  );
}

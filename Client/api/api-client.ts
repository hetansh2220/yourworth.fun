export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type ApiSuccess<T> = {
  success: true;
} & T;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
};

function createUrl(path: string) {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function createWebSocketUrl(path: string) {
  const url = new URL(createUrl(path));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export async function apiFetch<T>(
  path: string,
  { body, token, headers, ...options }: ApiFetchOptions = {}
): Promise<T> {
  const isFormData = body instanceof FormData;

  const response = await fetch(createUrl(path), {
    ...options,
    headers: {
      ...(body === undefined || isFormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body:
      body === undefined
        ? undefined
        : isFormData
          ? body
          : JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String(data.message)
        : data && typeof data === "object" && "error" in data
          ? String(data.error)
          : "Something went wrong";
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

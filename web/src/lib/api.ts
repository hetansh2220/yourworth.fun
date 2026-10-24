export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

type ApiOptions = RequestInit & { accessToken?: string };

export async function api<T>(
  path: string,
  { accessToken, ...options }: ApiOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${apiUrl}/${path.replace(/^\/+/, "")}`, {
    ...options,
    headers,
  });
  const result = await response.json().catch(() => {
    throw new ApiError("Invalid response from the API", response.status);
  });

  if (!response.ok || result?.success === false) {
    throw new ApiError(
      typeof result?.message === "string"
        ? result.message
        : "API request failed",
      response.status,
    );
  }

  return result as T;
}

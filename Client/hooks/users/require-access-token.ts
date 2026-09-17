export async function requireAccessToken(
  getAccessToken: () => Promise<string | null>
) {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Login first.");
  }

  return token;
}

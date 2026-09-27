function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requireAccessToken(
  getAccessToken: () => Promise<string | null>
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = await getAccessToken();

    if (token) {
      return token;
    }

    await wait(250);
  }

  throw new Error("Login first.");
}

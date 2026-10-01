const buckets = new Map<string, number[]>();

export function isRateLimited(
  key: string,
  options: { limit: number; windowMs: number }
) {
  const now = Date.now();
  const recentHits = (buckets.get(key) ?? []).filter(
    (hit) => now - hit < options.windowMs
  );

  if (recentHits.length >= options.limit) {
    buckets.set(key, recentHits);
    return true;
  }

  recentHits.push(now);
  buckets.set(key, recentHits);
  return false;
}

export function getMessageRateLimitKey(chatId: string, userId: string) {
  return `message:${chatId}:${userId}`;
}

export function getTypingRateLimitKey(chatId: string, userId: string) {
  return `typing:${chatId}:${userId}`;
}

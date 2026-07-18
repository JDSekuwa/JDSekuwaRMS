type CacheEntry = {
  value: any;
  expiresAt: number;
};

class InMemoryCache {
  private cache = new Map<string, CacheEntry>();

  set(key: string, value: any, ttlSeconds: number = 10): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  invalidate(pattern: string | RegExp): void {
    for (const key of this.cache.keys()) {
      if (typeof pattern === "string" ? key.includes(pattern) : pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const serverCache = new InMemoryCache();

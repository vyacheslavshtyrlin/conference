export function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function readNumberEnv(name: string, fallback?: number): number {
  const raw = process.env[name];

  if (raw === undefined) {
    if (fallback === undefined) {
      throw new Error(`Missing required environment variable: ${name}`);
    }

    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return value;
}

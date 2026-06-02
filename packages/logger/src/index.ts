export type Logger = {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
};

export function createLogger(service: string): Logger {
  const write = (level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) => {
    const payload = {
      level,
      service,
      message,
      ...context
    };

    console[level](JSON.stringify(payload));
  };

  return {
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context)
  };
}

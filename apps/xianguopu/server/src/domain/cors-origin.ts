export function parseAllowedOrigins(value: string): Set<string> {
  return new Set(
    value
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
  );
}

export function isAllowedOrigin(origin: string | undefined, allowedOrigins: Set<string>): boolean {
  // Native mini-program requests do not send the browser Origin header.
  return !origin || allowedOrigins.has(origin);
}

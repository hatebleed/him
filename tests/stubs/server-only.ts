/**
 * Vitest stub for the `server-only` package.
 *
 * In Next.js the real package throws when server code is imported by a client
 * component. Tests run in Node, where the restriction does not apply, so this
 * no-op keeps server modules importable from suites.
 */
export {};

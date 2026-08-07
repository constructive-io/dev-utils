export type FetchFunction = typeof globalThis.fetch;

/**
 * A loopback interface address the `*.localhost` connect path can be pinned to.
 */
export type LoopbackAddress = '127.0.0.1' | '::1';

export interface CreateFetchOptions {
  /**
   * How to reach the loopback interface for `*.localhost` URLs (Node only).
   *
   * The `*.localhost` connect path is pointed straight at this address,
   * removing DNS from the loopback hop entirely. This matters because
   * `localhost` commonly resolves to IPv6 `::1` first while many local dev
   * ingresses (kind, Docker's port publishing) listen on IPv4 only — a plain
   * DNS connect then reaches `::1` and fails on setups without Node's
   * Happy-Eyeballs fallback. The original `Host` header is preserved either
   * way, so subdomain routing is unaffected.
   *
   * - `'127.0.0.1'` (default) — pin the IPv4 loopback.
   * - `'::1'` — pin the IPv6 loopback.
   * - `false` — no pin; rewrite the host to `localhost` and rely on system
   *   DNS (the pre-1.2 behavior).
   *
   * Ignored in browser environments, which resolve `*.localhost` natively.
   */
  loopback?: LoopbackAddress | false;
}

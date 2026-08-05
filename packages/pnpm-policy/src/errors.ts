/** Everything this package throws, so a caller can tell config errors from bugs. */
export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyError';
  }
}

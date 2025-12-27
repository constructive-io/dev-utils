export interface GitCloneOptions {
  branch?: string;
  depth?: number;
  singleBranch?: boolean;
  /** If true (default), show spinner and silence git output. If false, show raw git output. */
  silent?: boolean;
}

export interface GitCloneResult {
  destination: string;
  normalizedUrl: string;
  branch?: string;
}

export interface GitUrlValidation {
  isValid: boolean;
  normalized?: string;
  error?: string;
}

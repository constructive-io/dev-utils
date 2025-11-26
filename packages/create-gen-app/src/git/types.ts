export interface GitCloneOptions {
  branch?: string;
  depth?: number;
  singleBranch?: boolean;
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

export function toPascalCase(str: string) {
  return str
    .replace(/(^|_|\s|-)(\w)/g, (_: any, __: any, letter: string) =>
      letter.toUpperCase()
    )
    .replace(/[_\s-]/g, '');
}

export function toCamelCase(
  key: string,
  stripLeadingNonAlphabetChars: boolean = false
) {
  if (stripLeadingNonAlphabetChars) {
    // First, remove all leading non-alphanumeric characters (preserves numbers)
    key = key.replace(/^[^a-zA-Z0-9]+/, '');
  }
  return key
        // Convert what follows a separator into upper case
        .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
        // Ensure the first character of the result is always lowercase
        .replace(/^./, (c) => c.toLowerCase());
}

// // Determine if the key is a valid JavaScript identifier
export function isValidIdentifier(key: string) {
  return /^[$A-Z_][0-9A-Z_$]*$/i.test(key) && !/^[0-9]+$/.test(key);
}

// Determine if the key is a valid JavaScript-like identifier, allowing internal hyphens
export function isValidIdentifierCamelized(key: string) {
  return (
    /^[$A-Z_][0-9A-Z_$-]*$/i.test(key) &&
    !/^[0-9]+$/.test(key) &&
    !/^-/.test(key)
  );
}

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

export function toSnakeCase(str: string) {
  return str
    // Insert an underscore before the last capital in a sequence of capitals followed by a lowercase letter
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    // Insert an underscore between lower and upper case letters
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    // Insert an underscore between letters and numbers
    .replace(/([a-zA-Z])(\d)/g, '$1_$2')
    .replace(/(\d)([a-zA-Z])/g, '$1_$2')
    // Replace spaces, hyphens, and existing underscores with single underscore
    .replace(/[\s-]+/g, '_')
    // Remove multiple consecutive underscores
    .replace(/_+/g, '_')
    // Remove leading/trailing underscores and convert to lowercase
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export function toKebabCase(str: string) {
  return str
    // Insert a hyphen before the last capital in a sequence of capitals followed by a lowercase letter
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    // Insert a hyphen between lower and upper case letters
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    // Insert a hyphen between letters and numbers
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .replace(/(\d)([a-zA-Z])/g, '$1-$2')
    // Replace spaces, underscores, and existing hyphens with single hyphen
    .replace(/[\s_]+/g, '-')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens and convert to lowercase
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function toConstantCase(str: string) {
  return str
    // Insert an underscore before the last capital in a sequence of capitals followed by a lowercase letter
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    // Insert an underscore between lower and upper case letters
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    // Insert an underscore between letters and numbers
    .replace(/([a-zA-Z])(\d)/g, '$1_$2')
    .replace(/(\d)([a-zA-Z])/g, '$1_$2')
    // Replace spaces, hyphens, and existing underscores with single underscore
    .replace(/[\s-]+/g, '_')
    // Remove multiple consecutive underscores
    .replace(/_+/g, '_')
    // Remove leading/trailing underscores and convert to uppercase
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

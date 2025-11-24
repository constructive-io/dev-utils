/**
 * Remove ANSI escape codes from a string.
 * Handles:
 * - CSI sequences: \u001b[... (color codes, cursor movement, etc.)
 * - OSC sequences: \u001b]... (OS commands like window title)
 * - Other escape sequences: \u001b followed by single characters
 */
export function cleanAnsi(input: string): string {
    if (!input) return '';

    // Match CSI (Control Sequence Introducer) sequences: ESC[ followed by parameters and final character
    // Examples: \u001b[31m, \u001b[A, \u001b[2J, \u001b[?25h
    const csiPattern = /\u001b\[[0-9;?]*[A-Za-z]/g;

    // Match OSC (Operating System Command) sequences: ESC] followed by parameters and terminator
    // Terminated by BEL (\u0007) or ESC\ (\u001b\\)
    // Examples: \u001b]0;title\u0007, \u001b]2;title\u001b\\
    // Handle BEL-terminated sequences
    const oscBelPattern = /\u001b\][^\u0007]*\u0007/g;
    // Handle ESC\-terminated sequences (more complex, need to match ESC\ specifically)
    const oscEscPattern = /\u001b\][^\u001b]*\u001b\\/g;

    // Match other escape sequences: ESC followed by single character
    // Examples: \u001bD (index), \u001bM (reverse index), \u001b7 (save cursor), \u001b8 (restore cursor)
    const otherEscPattern = /\u001b[0-9A-Za-z]/g;

    return input
        .replace(csiPattern, '')
        .replace(oscBelPattern, '')
        .replace(oscEscPattern, '')
        .replace(otherEscPattern, '');
}

// Alias for compatibility
export const stripAnsi = cleanAnsi;

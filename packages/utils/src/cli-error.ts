/**
 * Options for cliExitWithError
 */
export interface CliExitOptions {
  /** Optional context to log with the error */
  context?: Record<string, any>;
  /** Optional hook to run before exiting (e.g., cleanup database connections) */
  beforeExit?: () => Promise<void>;
  /** Optional custom logger. Defaults to console */
  logger?: {
    error: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
  };
}

/**
 * CLI error utility that logs error information and exits with code 1.
 * Provides consistent error handling and user experience across all CLI commands.
 * 
 * @example
 * ```typescript
 * // Basic usage
 * await cliExitWithError('Something went wrong');
 * 
 * // With context
 * await cliExitWithError(new Error('Failed to connect'), {
 *   context: { host: 'localhost', port: 5432 }
 * });
 * 
 * // With cleanup hook (e.g., for database connections)
 * await cliExitWithError(error, {
 *   beforeExit: async () => {
 *     await teardownPgPools();
 *   }
 * });
 * ```
 */
export const cliExitWithError = async (
  error: Error | string,
  options: CliExitOptions = {}
): Promise<never> => {
  const { context, beforeExit, logger = console } = options;

  if (error instanceof Error) {
    logger.error(`Error: ${error.message}`);
    if (context) {
      logger.debug('Context:', context);
    }
  } else if (typeof error === 'string') {
    logger.error(`Error: ${error}`);
    if (context) {
      logger.debug('Context:', context);
    }
  }

  // Perform cleanup before exiting if hook is provided
  if (beforeExit) {
    try {
      await beforeExit();
      logger.debug('Cleanup completed');
    } catch (cleanupError) {
      logger.warn('Failed to complete cleanup:', cleanupError);
    }
  }

  process.exit(1);
};

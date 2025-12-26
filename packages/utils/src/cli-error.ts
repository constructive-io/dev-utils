export interface CliExitOptions {
  context?: Record<string, any>;
  beforeExit?: () => Promise<void>;
  logger?: {
    error: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
  };
}

/**
 * Exits the CLI with an error message and optional cleanup.
 * Supports a beforeExit hook for cleanup operations (e.g., closing database connections).
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

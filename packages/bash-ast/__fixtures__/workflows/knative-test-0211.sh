cd compute/tests
pnpm jest --config jest.config.js --no-coverage --forceExit --verbose 'agentic-server|agent-context|agent-handlers|env-layering' 2>&1

import * as fs from 'fs';
import * as path from 'path';

import { appstash, resolve } from './index';

export interface ContextTargetEndpoint {
  endpoint: string;
}

export interface ContextConfig {
  name: string;
  endpoint: string;
  targets?: Record<string, ContextTargetEndpoint>;
  createdAt: string;
  updatedAt: string;
}

export interface ContextCredentials {
  token: string;
  expiresAt?: string;
  refreshToken?: string;
}

export interface Credentials {
  tokens: Record<string, ContextCredentials>;
}

export interface GlobalSettings {
  currentContext?: string;
}

export interface ConfigStoreOptions {
  baseDir?: string;
}

export interface ClientConfig {
  endpoint: string;
  headers: Record<string, string>;
}

export interface ConfigStore {
  loadSettings(): GlobalSettings;
  saveSettings(settings: GlobalSettings): void;

  createContext(name: string, options: { endpoint: string; targets?: Record<string, ContextTargetEndpoint> }): ContextConfig;
  loadContext(name: string): ContextConfig | null;
  listContexts(): ContextConfig[];
  deleteContext(name: string): boolean;
  getCurrentContext(): ContextConfig | null;
  setCurrentContext(name: string): boolean;
  getTargetEndpoint(targetName: string, contextName?: string): string | null;

  setCredentials(contextName: string, creds: ContextCredentials): void;
  getCredentials(contextName: string): ContextCredentials | null;
  removeCredentials(contextName: string): boolean;
  hasValidCredentials(contextName: string): boolean;

  setVar(key: string, value: string, contextName?: string): void;
  getVar(key: string, contextName?: string): string | null;
  deleteVar(key: string, contextName?: string): boolean;
  listVars(contextName?: string): Record<string, string>;

  getClientConfig(targetName: string, contextName?: string): ClientConfig;
}

function readJson<T>(filePath: string, fallback: T): T {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return JSON.parse(JSON.stringify(fallback));
    }
  }
  return JSON.parse(JSON.stringify(fallback));
}

function writeJson(filePath: string, data: unknown, mode?: number): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const options: fs.WriteFileOptions = mode ? { mode } : {};
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), options);
}

export function createConfigStore(toolName: string, options?: ConfigStoreOptions): ConfigStore {
  const dirs = appstash(toolName, { ensure: true, baseDir: options?.baseDir });

  function settingsPath(): string {
    return resolve(dirs, 'config', 'settings.json');
  }

  function credentialsPath(): string {
    return resolve(dirs, 'config', 'credentials.json');
  }

  function contextPath(name: string): string {
    const contextsDir = resolve(dirs, 'config', 'contexts');
    if (!fs.existsSync(contextsDir)) {
      fs.mkdirSync(contextsDir, { recursive: true });
    }
    return path.join(contextsDir, `${name}.json`);
  }

  function loadSettings(): GlobalSettings {
    return readJson<GlobalSettings>(settingsPath(), {});
  }

  function saveSettings(settings: GlobalSettings): void {
    writeJson(settingsPath(), settings);
  }

  function loadContext(name: string): ContextConfig | null {
    return readJson<ContextConfig | null>(contextPath(name), null);
  }

  function createContext(name: string, options: { endpoint: string; targets?: Record<string, ContextTargetEndpoint> }): ContextConfig {
    const now = new Date().toISOString();
    const context: ContextConfig = {
      name,
      endpoint: options.endpoint,
      createdAt: now,
      updatedAt: now,
    };
    if (options.targets) {
      context.targets = options.targets;
    }
    writeJson(contextPath(name), context);
    return context;
  }

  function listContexts(): ContextConfig[] {
    const contextsDir = resolve(dirs, 'config', 'contexts');
    if (!fs.existsSync(contextsDir)) {
      return [];
    }
    const files = fs.readdirSync(contextsDir).filter(f => f.endsWith('.json'));
    const contexts: ContextConfig[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(contextsDir, file), 'utf8');
        contexts.push(JSON.parse(content));
      } catch {
        // skip invalid files
      }
    }
    return contexts;
  }

  function deleteContext(name: string): boolean {
    const p = contextPath(name);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      const settings = loadSettings();
      if (settings.currentContext === name) {
        settings.currentContext = undefined;
        saveSettings(settings);
      }
      return true;
    }
    return false;
  }

  function getCurrentContext(): ContextConfig | null {
    const settings = loadSettings();
    if (settings.currentContext) {
      return loadContext(settings.currentContext);
    }
    return null;
  }

  function setCurrentContext(name: string): boolean {
    const context = loadContext(name);
    if (!context) {
      return false;
    }
    const settings = loadSettings();
    settings.currentContext = name;
    saveSettings(settings);
    return true;
  }

  function loadCredentials(): Credentials {
    return readJson<Credentials>(credentialsPath(), { tokens: {} });
  }

  function saveCredentials(credentials: Credentials): void {
    writeJson(credentialsPath(), credentials, 0o600);
  }

  function setCredentials(contextName: string, creds: ContextCredentials): void {
    const credentials = loadCredentials();
    credentials.tokens[contextName] = creds;
    saveCredentials(credentials);
  }

  function getCredentials(contextName: string): ContextCredentials | null {
    const credentials = loadCredentials();
    return credentials.tokens[contextName] || null;
  }

  function removeCredentials(contextName: string): boolean {
    const credentials = loadCredentials();
    if (credentials.tokens[contextName]) {
      delete credentials.tokens[contextName];
      saveCredentials(credentials);
      return true;
    }
    return false;
  }

  function hasValidCredentials(contextName: string): boolean {
    const creds = getCredentials(contextName);
    if (!creds || !creds.token) {
      return false;
    }
    if (creds.expiresAt) {
      const expiresAt = new Date(creds.expiresAt);
      if (expiresAt <= new Date()) {
        return false;
      }
    }
    return true;
  }

  function getTargetEndpoint(targetName: string, contextName?: string): string | null {
    let ctx: ContextConfig | null;
    if (contextName) {
      ctx = loadContext(contextName);
    } else {
      ctx = getCurrentContext();
    }
    if (!ctx) return null;
    if (ctx.targets && ctx.targets[targetName]) {
      return ctx.targets[targetName].endpoint;
    }
    return ctx.endpoint;
  }

  function varsPath(ctxName: string): string {
    const varsDir = resolve(dirs, 'config', 'vars');
    if (!fs.existsSync(varsDir)) {
      fs.mkdirSync(varsDir, { recursive: true });
    }
    return path.join(varsDir, `${ctxName}.json`);
  }

  function loadVars(ctxName: string): Record<string, string> {
    return readJson<Record<string, string>>(varsPath(ctxName), {});
  }

  function saveVars(ctxName: string, vars: Record<string, string>): void {
    writeJson(varsPath(ctxName), vars);
  }

  function resolveContextName(contextName?: string): string | null {
    if (contextName) return contextName;
    const settings = loadSettings();
    return settings.currentContext || null;
  }

  function setVar(key: string, value: string, contextName?: string): void {
    const ctxName = resolveContextName(contextName);
    if (!ctxName) {
      throw new Error('No active context. Run "context create" or "context use" first.');
    }
    const vars = loadVars(ctxName);
    vars[key] = value;
    saveVars(ctxName, vars);
  }

  function getVar(key: string, contextName?: string): string | null {
    const ctxName = resolveContextName(contextName);
    if (!ctxName) return null;
    const vars = loadVars(ctxName);
    return vars[key] ?? null;
  }

  function deleteVar(key: string, contextName?: string): boolean {
    const ctxName = resolveContextName(contextName);
    if (!ctxName) return false;
    const vars = loadVars(ctxName);
    if (key in vars) {
      delete vars[key];
      saveVars(ctxName, vars);
      return true;
    }
    return false;
  }

  function listVars(contextName?: string): Record<string, string> {
    const ctxName = resolveContextName(contextName);
    if (!ctxName) return {};
    return loadVars(ctxName);
  }

  function getClientConfig(targetName: string, contextName?: string): ClientConfig {
    const envPrefix = toolName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const targetSuffix = targetName.toUpperCase().replace(/[^A-Z0-9]/g, '_');

    // Tier 1: Try appstash store
    const ctx = contextName ? loadContext(contextName) : getCurrentContext();
    if (ctx) {
      const endpoint = getTargetEndpoint(targetName, ctx.name);
      const headers: Record<string, string> = {};
      if (hasValidCredentials(ctx.name)) {
        const creds = getCredentials(ctx.name);
        if (creds?.token) {
          headers['Authorization'] = `Bearer ${creds.token}`;
        }
      }
      if (endpoint) {
        return { endpoint, headers };
      }
    }

    // Tier 2: Try env vars
    const envToken = process.env[`${envPrefix}_TOKEN`];
    const envEndpoint =
      process.env[`${envPrefix}_${targetSuffix}_ENDPOINT`] ||
      process.env[`${envPrefix}_ENDPOINT`];

    if (envEndpoint) {
      const headers: Record<string, string> = {};
      if (envToken) {
        headers['Authorization'] = `Bearer ${envToken}`;
      }
      return { endpoint: envEndpoint, headers };
    }

    // Tier 3: Throw with actionable error
    throw new Error(
      `No configuration found for target "${targetName}". ` +
      `Set up a context with "${toolName} context create" and authenticate with "${toolName} auth", ` +
      `or set ${envPrefix}_${targetSuffix}_ENDPOINT and ${envPrefix}_TOKEN environment variables.`
    );
  }

  return {
    loadSettings,
    saveSettings,
    createContext,
    loadContext,
    listContexts,
    deleteContext,
    getCurrentContext,
    setCurrentContext,
    getTargetEndpoint,
    setCredentials,
    getCredentials,
    removeCredentials,
    hasValidCredentials,
    setVar,
    getVar,
    deleteVar,
    listVars,
    getClientConfig,
  };
}

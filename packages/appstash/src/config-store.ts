import * as fs from 'fs';
import * as path from 'path';
import { appstash, resolve } from './index';

export interface ContextConfig {
  name: string;
  endpoint: string;
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

export interface ConfigStore {
  loadSettings(): GlobalSettings;
  saveSettings(settings: GlobalSettings): void;

  createContext(name: string, options: { endpoint: string }): ContextConfig;
  loadContext(name: string): ContextConfig | null;
  listContexts(): ContextConfig[];
  deleteContext(name: string): boolean;
  getCurrentContext(): ContextConfig | null;
  setCurrentContext(name: string): boolean;

  setCredentials(contextName: string, creds: ContextCredentials): void;
  getCredentials(contextName: string): ContextCredentials | null;
  removeCredentials(contextName: string): boolean;
  hasValidCredentials(contextName: string): boolean;
}

const DEFAULT_SETTINGS: GlobalSettings = {};

function readJson<T>(filePath: string, fallback: T): T {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return fallback;
    }
  }
  return fallback;
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
    return readJson(settingsPath(), DEFAULT_SETTINGS);
  }

  function saveSettings(settings: GlobalSettings): void {
    writeJson(settingsPath(), settings);
  }

  function loadContext(name: string): ContextConfig | null {
    return readJson<ContextConfig | null>(contextPath(name), null);
  }

  function createContext(name: string, options: { endpoint: string }): ContextConfig {
    const now = new Date().toISOString();
    const context: ContextConfig = {
      name,
      endpoint: options.endpoint,
      createdAt: now,
      updatedAt: now,
    };
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

  return {
    loadSettings,
    saveSettings,
    createContext,
    loadContext,
    listContexts,
    deleteContext,
    getCurrentContext,
    setCurrentContext,
    setCredentials,
    getCredentials,
    removeCredentials,
    hasValidCredentials,
  };
}

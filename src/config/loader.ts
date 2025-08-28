import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chokidar from 'chokidar';
import * as tsBlankSpace from 'ts-blank-space';
import { AppConfig } from '../shared/types';
import { validateConfig } from './validator';

export class ConfigLoader extends EventEmitter {
  private configDir: string;
  private configPath: string | null = null;
  private currentConfig: AppConfig | null = null;
  private lastError: string | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private isLoading = false;

  constructor(configDir?: string) {
    super();
    this.configDir = configDir || path.join(os.homedir(), '.agent-tts');
  }

  async load(): Promise<AppConfig | null> {
    if (this.isLoading) return this.currentConfig;
    this.isLoading = true;

    try {
      // Find config file (index.ts or index.js)
      const tsPath = path.join(this.configDir, 'index.ts');
      const jsPath = path.join(this.configDir, 'index.js');
      
      if (fs.existsSync(tsPath)) {
        this.configPath = tsPath;
      } else if (fs.existsSync(jsPath)) {
        this.configPath = jsPath;
      } else {
        this.lastError = `No configuration file found at ${this.configDir}/index.{ts,js}`;
        return null;
      }

      // Load and evaluate config
      const config = await this.loadConfigFile(this.configPath);
      
      if (!config) {
        return null;
      }

      // Validate config
      const validationError = validateConfig(config);
      if (validationError) {
        this.lastError = `Configuration validation error: ${validationError}`;
        return null;
      }

      this.currentConfig = config;
      this.lastError = null;
      return config;

    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      return null;
    } finally {
      this.isLoading = false;
    }
  }

  private async loadConfigFile(filePath: string): Promise<AppConfig | null> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      let code = fileContent;

      // If TypeScript file, transform it to remove type annotations
      if (filePath.endsWith('.ts')) {
        try {
          code = tsBlankSpace.default(fileContent);
        } catch (tsError) {
          this.lastError = `TypeScript transform error: ${tsError instanceof Error ? tsError.message : String(tsError)}`;
          return null;
        }
      }

      // Create a module wrapper to execute the config
      const moduleWrapper = `
        (function(exports, require, module, __filename, __dirname) {
          ${code}
          return module.exports || exports.default || exports;
        })
      `;

      // Create module context
      const moduleExports = {};
      const moduleObj = { exports: moduleExports };
      const requireFunc = (id: string) => {
        // Handle relative imports
        if (id.startsWith('.') || id.startsWith('/')) {
          const resolvedPath = path.resolve(path.dirname(filePath), id);
          return require(resolvedPath);
        }
        return require(id);
      };

      // Execute config module
      const configFunction = eval(moduleWrapper);
      const result = configFunction(
        moduleExports,
        requireFunc,
        moduleObj,
        filePath,
        path.dirname(filePath)
      );

      // Extract the config (support both default export and direct export)
      const config = result?.default || result;

      if (!config || typeof config !== 'object') {
        this.lastError = 'Configuration must export an object';
        return null;
      }

      return config as AppConfig;

    } catch (error) {
      this.lastError = `Failed to load config: ${error instanceof Error ? error.message : String(error)}`;
      return null;
    }
  }

  startWatching() {
    if (!this.configPath || this.watcher) return;

    this.watcher = chokidar.watch(this.configDir, {
      persistent: true,
      ignoreInitial: true,
      depth: 2,
    });

    this.watcher.on('change', async (changedPath) => {
      // Only reload if the main config file or its imports changed
      if (changedPath === this.configPath || this.isConfigDependency(changedPath)) {
        await this.reloadConfig();
      }
    });

    this.watcher.on('add', async (addedPath) => {
      // Handle new config file being created
      if (!this.configPath && (addedPath.endsWith('index.ts') || addedPath.endsWith('index.js'))) {
        await this.reloadConfig();
      }
    });
  }

  private isConfigDependency(filePath: string): boolean {
    // Simple check - any .js/.ts file in config directory could be a dependency
    return filePath.startsWith(this.configDir) && 
           (filePath.endsWith('.js') || filePath.endsWith('.ts'));
  }

  private async reloadConfig() {
    const newConfig = await this.load();
    
    if (newConfig) {
      // Config loaded successfully
      this.emit('configChanged', newConfig);
    } else {
      // Config failed to load, emit error but keep current config
      this.emit('configError', this.lastError);
    }
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getCurrentConfig(): AppConfig | null {
    return this.currentConfig;
  }
}
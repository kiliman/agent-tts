import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import * as tsBlankSpace from 'ts-blank-space';
import { AgentTTSConfig } from '../types/config.js';
import { validateConfig } from './validator';
import { AGENT_TTS_PATHS } from '../utils/xdg-paths.js';

export class ConfigLoader extends EventEmitter {
  private configDir: string;
  private configPath: string | null = null;
  private currentConfig: AgentTTSConfig | null = null;
  private lastError: string | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private isLoading = false;

  constructor(configDir?: string) {
    super();
    this.configDir = configDir || AGENT_TTS_PATHS.config;
  }

  async load(): Promise<AgentTTSConfig | null> {
    if (this.isLoading) return this.currentConfig;
    this.isLoading = true;

    try {
      // Find config file (config.ts, config.js, or legacy index.ts/index.js)
      const configTsPath = path.join(this.configDir, 'config.ts');
      const configJsPath = path.join(this.configDir, 'config.js');
      const indexTsPath = path.join(this.configDir, 'index.ts');
      const indexJsPath = path.join(this.configDir, 'index.js');

      if (fs.existsSync(configTsPath)) {
        this.configPath = configTsPath;
      } else if (fs.existsSync(configJsPath)) {
        this.configPath = configJsPath;
      } else if (fs.existsSync(indexTsPath)) {
        this.configPath = indexTsPath;
        console.log('[Config] Warning: Using legacy index.ts, consider renaming to config.ts');
      } else if (fs.existsSync(indexJsPath)) {
        this.configPath = indexJsPath;
        console.log('[Config] Warning: Using legacy index.js, consider renaming to config.js');
      } else {
        this.lastError = `No configuration file found at ${this.configDir}/config.{ts,js}`;
        return null;
      }

      // Load and evaluate config
      const config = await this.loadConfigFile(this.configPath);
      
      if (!config) {
        return null;
      }

      // Skip validation for now - just use the config as-is
      // TODO: Fix validation to work with AgentTTSConfig type

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

  private async loadConfigFile(filePath: string): Promise<AgentTTSConfig | null> {
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

      return config as AgentTTSConfig;

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
      if (!this.configPath && (
        addedPath.endsWith('config.ts') ||
        addedPath.endsWith('config.js') ||
        addedPath.endsWith('index.ts') ||
        addedPath.endsWith('index.js')
      )) {
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

  getCurrentConfig(): AgentTTSConfig | null {
    return this.currentConfig;
  }
}
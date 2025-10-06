import { homedir } from 'os';
import { join } from 'path';

/**
 * XDG Base Directory Specification paths
 * https://specifications.freedesktop.org/basedir-spec/latest/
 */

export function getXdgConfigHome(): string {
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
}

export function getXdgStateHome(): string {
  return process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
}

export function getXdgCacheHome(): string {
  return process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
}

// App-specific directories
export const AGENT_TTS_PATHS = {
  config: join(getXdgConfigHome(), 'agent-tts'),
  state: join(getXdgStateHome(), 'agent-tts'),
  cache: join(getXdgCacheHome(), 'agent-tts'),
};

import { AppConfig, ProfileConfig, TTSServiceConfig, PronunciationRule } from '../shared/types';

export function validateConfig(config: any): string | null {
  if (!config || typeof config !== 'object') {
    return 'Configuration must be an object';
  }

  const appConfig = config as AppConfig;

  // Validate profiles array
  if (!Array.isArray(appConfig.profiles)) {
    return 'Configuration must have a "profiles" array';
  }

  if (appConfig.profiles.length === 0) {
    return 'Configuration must have at least one profile';
  }

  // Validate each profile
  for (let i = 0; i < appConfig.profiles.length; i++) {
    const error = validateProfile(appConfig.profiles[i], i);
    if (error) return error;
  }

  // Check for duplicate profile names
  const profileNames = appConfig.profiles.map(p => p.name);
  const duplicates = profileNames.filter((name, index) => profileNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    return `Duplicate profile names found: ${duplicates.join(', ')}`;
  }

  return null;
}

function validateProfile(profile: any, index: number): string | null {
  const prefix = `Profile[${index}]`;

  if (!profile || typeof profile !== 'object') {
    return `${prefix}: Must be an object`;
  }

  const p = profile as ProfileConfig;

  // Validate required fields
  if (!p.name || typeof p.name !== 'string') {
    return `${prefix}: Must have a "name" string`;
  }

  if (!Array.isArray(p.watch) || p.watch.length === 0) {
    return `${prefix}: Must have a non-empty "watch" array of glob patterns`;
  }

  // Validate watch patterns
  for (const pattern of p.watch) {
    if (typeof pattern !== 'string') {
      return `${prefix}: All watch patterns must be strings`;
    }
  }

  // Validate optional exclude patterns
  if (p.exclude !== undefined) {
    if (!Array.isArray(p.exclude)) {
      return `${prefix}: "exclude" must be an array if provided`;
    }
    for (const pattern of p.exclude) {
      if (typeof pattern !== 'string') {
        return `${prefix}: All exclude patterns must be strings`;
      }
    }
  }

  // Validate optional icon path
  if (p.iconPath !== undefined && typeof p.iconPath !== 'string') {
    return `${prefix}: "iconPath" must be a string if provided`;
  }

  // Validate TTS service config
  const ttsError = validateTTSServiceConfig(p.tts, `${prefix}.tts`);
  if (ttsError) return ttsError;

  // Validate pronunciations
  if (!Array.isArray(p.pronunciations)) {
    return `${prefix}: Must have a "pronunciations" array (can be empty)`;
  }

  for (let i = 0; i < p.pronunciations.length; i++) {
    const error = validatePronunciationRule(p.pronunciations[i], `${prefix}.pronunciations[${i}]`);
    if (error) return error;
  }

  // Validate filters
  const filterError = validateFilters(p.filters, `${prefix}.filters`);
  if (filterError) return filterError;

  return null;
}

function validateTTSServiceConfig(tts: any, prefix: string): string | null {
  if (!tts || typeof tts !== 'object') {
    return `${prefix}: Must be an object`;
  }

  const t = tts as TTSServiceConfig;

  if (!t.name || typeof t.name !== 'string') {
    return `${prefix}: Must have a "name" string`;
  }

  if (!t.parser || typeof t.parser !== 'function') {
    return `${prefix}: Must have a "parser" function`;
  }

  if (t.outputFormat !== undefined && typeof t.outputFormat !== 'string') {
    return `${prefix}: "outputFormat" must be a string if provided`;
  }

  if (!t.voice || typeof t.voice !== 'object') {
    return `${prefix}: Must have a "voice" object`;
  }

  // Validate voice properties
  const voice = t.voice;
  if (!voice.id || typeof voice.id !== 'string') {
    return `${prefix}.voice: Must have an "id" string`;
  }

  if (!voice.model || typeof voice.model !== 'string') {
    return `${prefix}.voice: Must have a "model" string`;
  }

  if (typeof voice.stability !== 'number' || voice.stability < 0 || voice.stability > 1) {
    return `${prefix}.voice: "stability" must be a number between 0 and 1`;
  }

  if (typeof voice.similarityBoost !== 'number' || voice.similarityBoost < 0 || voice.similarityBoost > 1) {
    return `${prefix}.voice: "similarityBoost" must be a number between 0 and 1`;
  }

  return null;
}

function validatePronunciationRule(rule: any, prefix: string): string | null {
  if (!rule || typeof rule !== 'object') {
    return `${prefix}: Must be an object`;
  }

  const r = rule as PronunciationRule;

  if (!r.pattern || (typeof r.pattern !== 'string' && !(r.pattern instanceof RegExp))) {
    return `${prefix}: Must have a "pattern" (string or RegExp)`;
  }

  if (!r.replacement || typeof r.replacement !== 'string') {
    return `${prefix}: Must have a "replacement" string`;
  }

  if (r.caseSensitive !== undefined && typeof r.caseSensitive !== 'boolean') {
    return `${prefix}: "caseSensitive" must be a boolean if provided`;
  }

  return null;
}

function validateFilters(filters: any, prefix: string): string | null {
  if (!filters || typeof filters !== 'object') {
    return `${prefix}: Must be an object`;
  }

  const f = filters;

  if (!Array.isArray(f.enabled)) {
    return `${prefix}: Must have an "enabled" array`;
  }

  if (!Array.isArray(f.disabled)) {
    return `${prefix}: Must have a "disabled" array`;
  }

  if (!Array.isArray(f.custom)) {
    return `${prefix}: Must have a "custom" array`;
  }

  // Validate enabled/disabled are strings
  for (const item of f.enabled) {
    if (typeof item !== 'string') {
      return `${prefix}.enabled: All items must be strings`;
    }
  }

  for (const item of f.disabled) {
    if (typeof item !== 'string') {
      return `${prefix}.disabled: All items must be strings`;
    }
  }

  // Custom filters validation would require checking each item
  // but since they're custom objects, we'll do basic validation
  for (let i = 0; i < f.custom.length; i++) {
    if (!f.custom[i] || typeof f.custom[i] !== 'object') {
      return `${prefix}.custom[${i}]: Must be an object`;
    }
  }

  return null;
}
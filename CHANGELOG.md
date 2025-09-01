# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2025-09-01

### ✨ Features
- Add emoji filter to prevent TTS from saying "party pooper" when you meant 🎉
- Enable config hot-reload by properly calling startWatching()

### 🐛 Fixes
- Clean up TTS error logging to show helpful messages instead of axios object dumps
- Fix config file watching to detect changes and reload automatically

### 📝 Documentation
- Add legendary "party pooper" example to filter documentation
- Document emoji filter in README

### Explanation
**Patch version bump (0.3.0 → 0.3.1)** because this release fixes config hot-reload and improves error handling, plus adds the emoji filter as a small enhancement. No breaking changes.

## [0.3.0] - 2025-09-01

### ✨ Features
- Add support for multiple TTS providers (Kokoro, OpenAI, OpenAI-compatible)
- Implement Kokoro TTS provider for free, local text-to-speech
- Add OpenAI TTS API integration
- Support any OpenAI-compatible TTS service (LocalAI, Oobabooga, etc.)
- Add provider-specific configuration options
- Include test scripts and example configurations for new providers

### ♻️ Refactoring
- Update TTS service factory to support multiple providers
- Improve configuration schema with provider-specific options
- Add proper voice ID handling for Kokoro

### 📝 Documentation
- Update README with provider comparison and setup instructions
- Add Kokoro configuration examples
- Document available voice options for each provider

### Explanation
**Minor version bump (0.2.0 → 0.3.0)** because this release adds significant new features (multiple TTS providers) that are backwards compatible. Existing ElevenLabs configurations continue to work without changes.

## [0.2.0] - 2025-09-01

### ✨ Features
- Add WebSocket utilities and improve real-time updates
- Add dedicated WebSocket utility module for connection management
- Add real-time updates to Dashboard via WebSocket
- Add support for user-provided images in profiles
- Add protocol detection for ws:// vs wss:// based on page protocol
- Enhance Dashboard and ProfileLogViewer with better WebSocket integration
- Add proper connection state management

### 🐛 Fixes
- Use hyphens in TTS pronunciation for smoother speech
- Improve TTS pronunciation to use phonetic spelling
- Improve pronunciation of version numbers
- Resolve TypeScript build errors for NPM publishing

### ♻️ Refactoring
- Improve error handling and reconnection logic in WebSocket connections
- Improve WebSocket protocol detection for HTTPS support

### 📝 Documentation
- Update CLAUDE.md to reflect current implementation

### Explanation
**Minor version bump (0.1.0 → 0.2.0)** because this release includes new features that are backwards compatible. The WebSocket utilities, real-time updates, and user-provided images are all additive features that don't break existing functionality.

## [0.1.0] - Initial Release

### ✨ Features
- Initial release with core functionality
- Monitor chat logs from AI coding assistants (Claude Code, OpenCode, etc.)
- Real-time text-to-speech using ElevenLabs
- Profile-based configuration for different agents
- SQLite database for persistent storage
- Web dashboard with profile management
- Stoppable audio playback
- Hot-reload configuration support
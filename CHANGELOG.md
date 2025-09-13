# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2025-09-13

### ✨ Features
- ✨ Add user message capture and chat-style UI with proper user/assistant distinction
- ✨ Add copy button and improve text selection in chat UI for better usability
- ✨ Enhance UI with speech bubble tails and mobile responsiveness for polished appearance

### 🐛 Fixes
- 🐛 Improve filter system to always include defaults with user enhancement (prevents markdown characters being spoken)
- 🐛 Remove escape backslashes from user messages in chat view for cleaner display
- 🐛 Handle array content in Claude Code parser user messages for better parsing
- 🐛 Improve OpenCode timestamp handling and add database regeneration script

### ♻️ Refactoring
- ♻️ Pronunciation filter now properly merges custom options with defaults instead of replacing them
- ♻️ Filter configuration system now extends defaults rather than requiring full specification

**Version bump**: Minor release (0.5.1 → 0.6.0) - New UI features including chat-style interface, copy functionality, and improved mobile experience. Filter system improvements ensure better user experience by always including essential filters like markdown processing.

## [0.5.1] - 2025-09-03

### 🐛 Fixes
- Fix OpenCode parser to work with new directory structure (OpenCode reorganized from `project/global/storage/session` to just `storage`)
- Fix file monitoring for 'new' mode parsers to only process files created after service start
- Add file-based logging to `~/.agent-tts/logs/YYYY-MM-DD/log` for better debugging

**Version bump**: Patch release (0.5.0 → 0.5.1) - Bug fix for OpenCode compatibility

## [0.5.0] - 2025-09-03

### ✨ Features
- Add tool and model display in UI for better context
- Optimize startup with parser log modes

## [0.4.0] - 2025-09-02

### ✨ Features
- Add project directory (CWD) tracking to see which project each TTS message came from
- Add CWD filtering dropdown to filter messages by project directory
- Add infinite scroll with virtual pagination for better performance with large log lists
- Add favorites system to save and filter important TTS messages
- Add audio archiving to save and reuse TTS audio files
- Add markdown filter with improved list handling for better TTS output
- Add filepath filter to simplify long file paths for clearer TTS
- Add URL filter to replace URLs with "URL" in TTS output
- Add configurable pronunciation replacements for technical terms
- Improve tilde (~) pronunciation in file paths
- Add right arrow (→) pronunciation as "to"
- Add slash pronunciation in file paths for clarity

### 🐛 Fixes
- Fix tilde pronunciation by treating it as special character
- Use original timestamp when replaying log entries
- Handle blank lines between headings and lists in markdown filter
- Improve markdown filter to keep numbered list numbers and add pauses
- Properly expand tilde to full path when filtering by CWD

### ♻️ Refactoring
- Create AudioPlayer service for better separation of concerns
- Remove Electron remnants and consolidate TTS services
- Refactor special character handling in pronunciation filter to use array
- Simplify log entry expand/collapse interaction in UI

### 📝 Documentation
- Update CLAUDE.md to reflect current project state

### Explanation
**Minor version bump (0.3.1 → 0.4.0)** because this release adds significant new features including CWD tracking/filtering, favorites system, audio archiving, infinite scroll, and multiple new text filters. All changes are backwards compatible - existing configurations and databases will continue to work with automatic migration for the new CWD field.

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
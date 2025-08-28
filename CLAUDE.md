# agent-tts

This app is an Electron app that will monitor changes to files that contain chat logs of various agents: claude-code,
opencode, etc. It will then process those logs via parser configs to generate message to send to the TTS service for
playback.

## Configuration

The configuration files will be JavaScript/TypeScript files with default exports. The user can extend the configuration
by importing other config files and using the spread operator and other techniques to build the configuration.

By default, the configuration will be stored in `~/.agent-tts`. Unless specified, the initial config will be imported as
`~/.agent-tts/index.{js,ts}`.

Configuration should be hot-reloaded, so monitor for changes. Since we're loading dynamic JavaScript/TypeScript, if
there's a syntax error, report the error with as much detail as possible. Do not overwrite the existing configuration
until the new config is successfully parsed and evaluated.

Since we're using Electron with built-in node, we'll need to use a package like `ts-blank-space` to erase types on
dynamic configuration imports.

## Monitoring File Changes

During start up, read all the files indicated by the watch config and maintain a log of last modified data and file
size. Store this information in SQLite. Only one row per file. Update the existing entry when a file change is detected.
Only update after successful processing of the current change.

As a file change is detected, it will read the file starting from last file size offset to end of file, and send this
content to the parser defined in the profile config. The parser is responsible for returning an array of messages to
convert to speech. Update last modified data and file size.

Each message will then be processed through a set of filters defined for the profile. These filters will convert the
message into something suitable for speech, like stripping out code and converting text for improved pronunciation, like
`git` => `ghit` to ensure the word is pronounced with a hard `G` sound instead of `J`.

Skip any non-truthy results from the filter function.

If a change is detected while processing the current change, queue up the change for processing. It should not process
more than one change at a time.

## Text-to-Speech

For each valid response, queue up the filtered text to convert to speech using the configured TTS service. For example,
there will be one for ElevenLabs. The service class will include an async `tts` method that takes the text to speak, and
play the resulting audio. Since multiple messages can be processed, we need to ensure we don't process additional
messages until the current message has finished playing, otherwise the audio will overlap making it difficult to hear.

The TTS Service class constructor will take in the TTSServiceConfig object. This provides the necessary configuration to
call the service. For example, ElevenLabs will include model and voice id.

Store entries in a local SQLite database. Include timestamp, filename, profile, original text, filtered text, state
(queued, played, error), TTS API response status, API response message (or error message), elapsed processing time (API
request time).

## Electron

The Electron app will be written in TypeScript. It will register an icon in the menu bar. When clicked, it will display
a menu showing the active profiles with checkmarks. The user can toggle the checkmarks to enable/disable profiles. Save
the state of the checkmarks for subsequent execution. The user should also be able to toggle all sound playback with a
Mute option. The user should be able to configure a global hotkey that will stop the current TTS playback. Default to
Ctrl+Esc.

## UI

In addition the menu support, add an option to display a Log view. This will open a window with the last 50 TTS entries.
It will show the the profile icon (to differentiate between claude-code and opencode, for example). It will show the
original text as a single line with ellipsis for truncated text. There will be an down arrow icon that will expand the
log entry showing original text, plus the transformed text (what was actually sent to the TTS service).

The Log view list should scroll automatically as new entries are shown. Next to the profile icon, there should be a play
button that will replay the existing log entry. While playing, the icon should turn to a pause button. If a new entry is
being processed and is currently playing, it too should have the pause icon. Any entries that are queued for future
playback should display an icon (circular arrows, like a spinner).

Support both light and dark mode, following system setting. Use React for the UI.

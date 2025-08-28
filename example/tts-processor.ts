import fs from "fs";
import path from "path";
import os from "os";
import type { Message, TextBlock } from "@anthropic-ai/sdk/resources/messages";
import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";
import { TTSConfigLoader, TTSUserConfig, PronunciationRule, CustomFilter } from "./tts-config-loader";

export interface TTSConfig {
	apiKey: string;
	modelId: string;
	voiceId: string;
	outputFormat?: string;
	logDirectory?: string;
	enabled?: boolean;
	debug?: boolean;
}

export interface TTSContentFilter {
	name: string;
	filter: (content: string) => string;
}

export interface TTSLogEntry {
	timestamp: string;
	originalContent: string;
	processedContent: string;
	apiResponse?: any;
	error?: string;
}

export class TTSProcessor {
	private config: TTSConfig;
	private userConfig: TTSUserConfig | null = null;
	private contentFilters: TTSContentFilter[] = [];
	private logFile: string;
	private elevenLabsClient: ElevenLabsClient | null = null;
	private audioQueue: Array<{ originalContent: string; processedContent: string; timestamp: string }> = [];
	private isPlaying: boolean = false;

	constructor(config: TTSConfig) {
		this.config = {
			outputFormat: "mp3_44100_128",
			logDirectory: ".claude-trace",
			enabled: true,
			...config,
		};

		// Load user configuration
		this.userConfig = TTSConfigLoader.loadConfig();
		
		// Apply user config overrides if available
		if (this.userConfig) {
			if (this.userConfig.voice) {
				if (this.userConfig.voice.id) this.config.voiceId = this.userConfig.voice.id;
				if (this.userConfig.voice.model) this.config.modelId = this.userConfig.voice.model;
			}
		}

		// Initialize log file
		const logDir = this.config.logDirectory!;
		if (!fs.existsSync(logDir)) {
			fs.mkdirSync(logDir, { recursive: true });
		}

		const dateStr = new Date().toISOString().substring(0, 19).replace(/[T:]/g, "-"); // YYYY-MM-DD-HH-MM-SS
		this.logFile = path.join(logDir, `tts-${dateStr}.jsonl`);

		// Initialize ElevenLabs client if API key is provided
		if (this.config.apiKey) {
			this.elevenLabsClient = new ElevenLabsClient({
				apiKey: this.config.apiKey,
			});
		}

		// Register default content filters
		this.registerDefaultFilters();
		
		// Register custom filters from config
		this.registerCustomFilters();
	}

	private registerCustomFilters(): void {
		if (!this.userConfig?.filters?.custom) {
			return;
		}

		const configDir = path.join(os.homedir(), ".claude-trace");

		for (const customFilter of this.userConfig.filters.custom) {
			try {
				let filterFunction: (content: string) => string;

				if (customFilter.code) {
					// Create function from inline code
					// The code should return the filtered content
					filterFunction = new Function("content", customFilter.code) as (content: string) => string;
				} else if (customFilter.file) {
					// Load function from file
					const filePath = path.join(configDir, customFilter.file);
					
					if (!fs.existsSync(filePath)) {
						if (this.config.debug) {
							console.log(`  TTS:   Custom filter file not found: ${filePath}`);
						}
						continue;
					}

					const fileContent = fs.readFileSync(filePath, "utf-8");
					filterFunction = new Function("content", fileContent) as (content: string) => string;
				} else {
					if (this.config.debug) {
						console.log(`  TTS:   Custom filter '${customFilter.name}' has neither code nor file`);
					}
					continue;
				}

				// Check if filter should be enabled
				const isEnabled = this.isCustomFilterEnabled(customFilter.name);
				
				if (isEnabled) {
					this.addContentFilter({
						name: customFilter.name,
						filter: filterFunction,
					});
					
					if (this.config.debug) {
						console.log(`  TTS:   Registered custom filter: ${customFilter.name}`);
					}
				}
			} catch (error) {
				if (this.config.debug) {
					console.error(`  TTS:   Failed to load custom filter '${customFilter.name}':`, error);
				}
			}
		}
	}

	private isCustomFilterEnabled(filterName: string): boolean {
		if (!this.userConfig?.filters) return true;
		
		// First check disabled list
		if (this.userConfig.filters.disabled?.includes(filterName)) {
			return false;
		}
		
		// Then check enabled list
		if (!this.userConfig.filters.enabled || this.userConfig.filters.enabled.length === 0) {
			return true;
		}
		
		if (this.userConfig.filters.enabled.includes("*")) {
			return true;
		}
		
		return this.userConfig.filters.enabled.includes(filterName);
	}

	private registerDefaultFilters(): void {
		// Check if filters are enabled/disabled in user config
		const isFilterEnabled = (filterName: string): boolean => {
			if (!this.userConfig?.filters) return true;
			
			// First check disabled list - if explicitly disabled, return false
			if (this.userConfig.filters.disabled?.includes(filterName)) {
				return false;
			}
			
			// Then check enabled list
			if (!this.userConfig.filters.enabled || this.userConfig.filters.enabled.length === 0) {
				// No enabled list means all are enabled (unless explicitly disabled)
				return true;
			}
			
			// Check if filter is in enabled list or matches wildcard
			if (this.userConfig.filters.enabled.includes("*")) {
				// Wildcard means all are enabled (unless explicitly disabled)
				return true;
			}
			
			// Check if filter is explicitly enabled
			return this.userConfig.filters.enabled.includes(filterName);
		};

		// Filter out JSON content (anything starting with {)
		if (isFilterEnabled("filter-json-content")) {
			this.addContentFilter({
				name: "filter-json-content",
				filter: (content: string) => {
					const trimmed = content.trim();
					if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
						return ""; // Filter out entire JSON content
					}
					return content;
				},
			});
		}

		// Filter out XML-like tags (<tag>content</tag>)
		if (isFilterEnabled("filter-xml-tags")) {
			this.addContentFilter({
				name: "filter-xml-tags",
				filter: (content: string) => {
					// Remove any content that starts with <tag> and ends with </tag>
					const trimmed = content.trim();
					if (trimmed.match(/^<[^>]+>[\s\S]*<\/[^>]+>$/)) {
						return ""; // Filter out entire XML-like content
					}
					// Also remove inline XML tags
					return content.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, "");
				},
			});
		}

		// Remove code blocks (```...```)
		if (isFilterEnabled("remove-code-blocks")) {
			this.addContentFilter({
				name: "remove-code-blocks",
				filter: (content: string) => {
					return content.replace(/```[\s\S]*?```/g, "");
				},
			});
		}

		// Remove inline code (`...`)
		if (isFilterEnabled("remove-inline-code")) {
			this.addContentFilter({
				name: "remove-inline-code",
				filter: (content: string) => {
					// Just remove the backticks, keep the content
					return content.replace(/`([^`]+)`/g, "$1");
				},
			});
		}

		// Remove markdown formatting
		if (isFilterEnabled("remove-markdown")) {
			this.addContentFilter({
				name: "remove-markdown",
				filter: (content: string) => {
					return (
						content
							// Remove bold/italic markers
							.replace(/\*\*([^*]+)\*\*/g, "$1")
							.replace(/\*([^*]+)\*/g, "$1")
							.replace(/__([^_]+)__/g, "$1")
							.replace(/_([^_]+)_/g, "$1")
							// Remove headers
							.replace(/^#{1,6}\s+/gm, "")
							// Remove blockquotes
							.replace(/^>\s+/gm, "")
							// Remove horizontal rules
							.replace(/^[-*_]{3,}$/gm, "")
					);
				},
			});
		}

		// Remove tool results sections
		if (isFilterEnabled("remove-tool-results")) {
			this.addContentFilter({
				name: "remove-tool-results",
				filter: (content: string) => {
					return content.replace(/<tool_result>[\s\S]*?<\/tool_result>/g, "[tool result removed]");
				},
			});
		}

		// Remove system reminder tags
		if (isFilterEnabled("remove-system-reminders")) {
			this.addContentFilter({
				name: "remove-system-reminders",
				filter: (content: string) => {
					return content.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "");
				},
			});
		}

		// Replace file paths with simpler versions
		if (isFilterEnabled("simplify-file-paths")) {
			this.addContentFilter({
				name: "simplify-file-paths",
				filter: (content: string) => {
					// Replace absolute paths with just the filename
					return content.replace(/\/[\w\-/.]+\/([\w\-.]+)/g, "$1");
				},
			});
		}

		// Replace file paths with simpler versions
		if (isFilterEnabled("remove-file-paths-with-line-numbers")) {
			this.addContentFilter({
				name: "remove-file-paths-with-line-numbers",
				filter: (content: string) => {
					// Replace absolute paths with just the filename
					return content.replace(/\([\w\-/.]+\/([\w\-.]+):\d+(-\d+)?\)/g, "$1");
				},
			});
		}

		// Replace file paths with simpler versions
		if (isFilterEnabled("remove-relative-parent-file-paths")) {
			this.addContentFilter({
				name: "remove-relative-parent-file-paths",
				filter: (content: string) => {
					// Replace absolute paths with just the filename
					return content.replace(/[\w\-/.]+\/([\w\-.]+)/g, "$1");
				},
			});
		}

		// Remove multiple consecutive newlines
		if (isFilterEnabled("cleanup-whitespace")) {
			this.addContentFilter({
				name: "cleanup-whitespace",
				filter: (content: string) => {
					return content.replace(/\n{3,}/g, "\n\n").trim();
				},
			});
		}

		// Replace technical symbols with words
		if (isFilterEnabled("replace-symbols")) {
			this.addContentFilter({
				name: "replace-symbols",
				filter: (content: string) => {
					return content
						.replace(/===/g, " equals ")
						.replace(/==/g, " equals ")
						.replace(/!=/g, " not equals ")
						.replace(/>=/g, " greater than or equal to ")
						.replace(/<=/g, " less than or equal to ")
						.replace(/>/g, " greater than ")
						.replace(/</g, " less than ")
						.replace(/&&/g, " and ")
						.replace(/\|\|/g, " or ")
						.replace(/\+\+/g, "")
						.replace(/--/g, "");
				},
			});
		}

		// Apply custom pronunciation rules from config
		if (this.userConfig?.pronunciations) {
			this.addContentFilter({
				name: "custom-pronunciations",
				filter: (content: string) => {
					let result = content;
					for (const rule of this.userConfig!.pronunciations!) {
						if (rule.pattern instanceof RegExp) {
							result = result.replace(rule.pattern, rule.replacement);
						} else {
							// String replacement
							const regex = new RegExp(rule.pattern, rule.caseSensitive ? "g" : "gi");
							result = result.replace(regex, rule.replacement);
						}
					}
					return result;
				},
			});
		} else if (isFilterEnabled("fix-pronunciation")) {
			// Default pronunciation fixes if no custom config
			this.addContentFilter({
				name: "fix-pronunciation",
				filter: (content: string) => {
					// Replace "git" (lowercase only) with phonetic spelling
					// Use word boundaries to avoid replacing "digital", "github", etc.
					return content
						.replace(/\bgit\b/g, "ghit")
						.replace(/\bGit\b/g, "Ghit")
						.replace(/\\/g, " backslash ");
				},
			});
		}
	}

	public addContentFilter(filter: TTSContentFilter): void {
		this.contentFilters.push(filter);
	}

	public removeContentFilter(name: string): void {
		this.contentFilters = this.contentFilters.filter((f) => f.name !== name);
	}

	private extractTextFromMessage(message: Message): string {
		if (!message.content || !Array.isArray(message.content)) {
			return "";
		}

		const textParts: string[] = [];

		for (const block of message.content) {
			if (block.type === "text") {
				const textBlock = block as TextBlock;
				textParts.push(textBlock.text);
			}
			// Skip tool_use blocks, thinking blocks, etc.
		}

		return textParts.join("\n\n");
	}

	private processContent(content: string): string {
		let processed = content;

		// Apply all content filters in sequence
		for (const filter of this.contentFilters) {
			processed = filter.filter(processed);
		}

		return processed;
	}

	private async logTTSRequest(entry: TTSLogEntry): Promise<void> {
		try {
			const logLine = JSON.stringify(entry) + "\n";
			fs.appendFileSync(this.logFile, logLine);
		} catch (error) {
			console.error("Failed to write TTS log:", error);
		}
	}

	public async processAssistantMessage(message: Message, model?: string): Promise<void> {
		if (!this.config.enabled || !this.config.apiKey) {
			return;
		}

		// Filter out haiku model responses
		if (model && model.toLowerCase().includes("haiku")) {
			if (this.config.debug) {
				console.log("  TTS:   Skipping haiku model response");
			}
			return;
		}

		// Extract text content from the message
		const originalContent = this.extractTextFromMessage(message);
		if (!originalContent || originalContent.trim().length === 0) {
			return;
		}

		// Debug logging for 'node' responses
		if (this.config.debug && (originalContent.trim().toLowerCase() === "node" || originalContent.includes("node"))) {
			console.log("  TTS:   DEBUG - Found 'node' in message:");
			console.log("  TTS:   Full message object:", JSON.stringify(message, null, 2));
			console.log("  TTS:   Extracted content:", originalContent);
		}

		// Process the content through filters
		const processedContent = this.processContent(originalContent);
		if (!processedContent || processedContent.trim().length === 0) {
			return;
		}

		// Add to queue instead of directly playing
		this.audioQueue.push({
			originalContent,
			processedContent,
			timestamp: new Date().toISOString(),
		});

		// Process the queue without awaiting (background playback)
		this.processAudioQueue();
	}

	private async processAudioQueue(): Promise<void> {
		// If already playing, don't start another process
		if (this.isPlaying || this.audioQueue.length === 0) {
			return;
		}

		this.isPlaying = true;

		while (this.audioQueue.length > 0) {
			const item = this.audioQueue.shift();
			if (!item) continue;

			try {
				if (this.config.debug) {
					console.log(`  TTS:   Playing audio (queue length: ${this.audioQueue.length})`);
				}
				const response = await this.sendToElevenLabs(item.processedContent);

				// Log the completed playback
				await this.logTTSRequest({
					timestamp: item.timestamp,
					originalContent: item.originalContent,
					processedContent: item.processedContent,
					apiResponse: response,
				});
			} catch (error) {
				if (this.config.debug) {
					console.error("Failed to play audio:", error);
				}

				// Log the error
				await this.logTTSRequest({
					timestamp: item.timestamp,
					originalContent: item.originalContent,
					processedContent: item.processedContent,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		this.isPlaying = false;
	}

	private async sendToElevenLabs(text: string): Promise<any> {
		if (!this.elevenLabsClient) {
			throw new Error("ElevenLabs client not initialized");
		}

		try {
			// Generate audio stream using the new API
			const start = Date.now();
			const audioStream = await this.elevenLabsClient.textToSpeech.convert(this.config.voiceId, {
				text,
				modelId: this.config.modelId,
				outputFormat: "mp3_44100_128",
				voiceSettings: {
					stability: this.userConfig?.voice?.stability ?? 0.5,
					similarityBoost: this.userConfig?.voice?.similarityBoost ?? 0.75,
				},
			});
			const elapsedTime = Date.now() - start;

			// Play the audio stream
			await play(audioStream);

			return {
				status: "success",
				played: true,
				timestamp: new Date().toISOString(),
				elapsedTime,
			};
		} catch (error) {
			// Log the error but don't throw to avoid interrupting the flow
			if (this.config.debug) {
				console.error("Failed to generate or play audio:", error);
			}

			return {
				status: "error",
				played: false,
				error: error instanceof Error ? error.message : String(error),
				timestamp: new Date().toISOString(),
			};
		}
	}

	public isEnabled(): boolean {
		return this.config.enabled === true && !!this.config.apiKey;
	}
}

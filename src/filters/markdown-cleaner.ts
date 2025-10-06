import { ParsedMessage } from '../types/config.js';

export const markdownCleaner = (message: ParsedMessage): ParsedMessage | null => {
  const cleaned = message.content
    // Remove code blocks entirely (triple backticks)
    .replace(/```[\s\S]*?```/g, '')
    // Keep inline code content but remove backticks
    .replace(/`([^`]+)`/g, '$1')
    // Convert links to just their text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove headers but keep text
    .replace(/#{1,6}\s+/g, '')
    // Remove bold/italic markers
    .replace(/\*{1,3}([^\*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Remove strikethrough
    .replace(/~~([^~]+)~~/g, '$1')
    // Remove list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Normalize whitespace (single spaces only, no newline stripping)
    .replace(/[^\S\n]+/g, ' ')  // Replace all whitespace except newlines with single space
    .replace(/\n{3,}/g, '\n\n')  // Collapse multiple newlines to max 2
    .trim();

  // Skip empty messages
  if (!cleaned) {
    return null;
  }

  return {
    ...message,
    content: cleaned
  };
};
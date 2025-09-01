/**
 * Example configuration with custom pronunciation replacements
 */

export default {
  profiles: [
    {
      id: "claudia",
      name: "Claudia",
      enabled: true,
      watchPaths: ["~/.local/share/opencode/project/global/storage/session/message/**"],
      parser: { type: "opencode" },
      filters: [
        // Custom pronunciation filter with user-defined replacements
        {
          name: "pronunciation",
          enabled: true,
          options: {
            // Override default pronunciations
            "git": "get",           // Instead of default "ghit"
            "api": "A-P-I",         // Different spelling out
            
            // Add custom pronunciations for your domain
            "beehiiv": "bee hive",
            "anthropic": "ann throw pick",
            "claude": "clawed",
            "opencode": "open code",
            "elevenlabs": "eleven labs",
            "kokoro": "ko-ko-ro",
            
            // Project-specific terms
            "myapp": "my app",
            "authz": "auth zee",
            "oauth": "oh auth",
            "saml": "sam-el",
            
            // Company/team names
            "acme": "ack-me",
            "xyzco": "X Y Z company",
            
            // Technical terms specific to your stack
            "postgres": "post-gress",
            "redis": "red-iss",
            "nginx": "engine-x",
            "kubectl": "cube control",
            "k8s": "kubernetes",
            
            // Common mispronunciations in your codebase
            "usr": "user",
            "btn": "button",
            "ctx": "context",
            "req": "request",
            "res": "response"
          }
        },
        // Other filters will use defaults if not specified
        { name: "markdown", enabled: true },
        { name: "url", enabled: true },
        { name: "emoji", enabled: true },
        { name: "filepath", enabled: true }
      ],
      ttsService: {
        type: "kokoro",
        baseUrl: "http://localhost:8880/v1",
        voiceId: "af_bella",
        options: {
          speed: 1.0,
          responseFormat: "mp3"
        }
      }
    }
  ]
};
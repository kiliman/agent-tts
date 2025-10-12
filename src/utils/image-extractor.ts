import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AGENT_TTS_PATHS } from './xdg-paths.js'

// MIME type to extension mapping
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
}

/**
 * Generate SHA-256 hash from image buffer
 */
export function hashImageContent(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Get file extension from MIME type
 */
export function getImageExtension(mimeType?: string): string {
  if (!mimeType) return 'png' // Default to PNG (clipboard images)

  const ext = MIME_TO_EXT[mimeType.toLowerCase()]
  return ext || 'png'
}

/**
 * Save image to cache directory with hash-based deduplication
 * @param imageData Image buffer
 * @param mimeType Optional MIME type
 * @returns Relative path for database (e.g., "a3f2/a3f2b5c7...png")
 */
export async function saveImage(imageData: Buffer, mimeType?: string): Promise<string> {
  // Generate hash
  const hash = hashImageContent(imageData)
  const ext = getImageExtension(mimeType)

  // Create directory structure using first 4 chars of hash
  const dirName = hash.substring(0, 4)
  const fileName = `${hash}.${ext}`
  const relativePath = `${dirName}/${fileName}`

  // Full path on disk
  const imagesBaseDir = join(AGENT_TTS_PATHS.cache, 'images')
  const dirPath = join(imagesBaseDir, dirName)
  const filePath = join(dirPath, fileName)

  // Check if file already exists (deduplication)
  if (existsSync(filePath)) {
    console.log(`[ImageExtractor] Image already exists: ${relativePath}`)
    return relativePath
  }

  // Create directory if it doesn't exist
  await mkdir(dirPath, { recursive: true })

  // Save image
  await writeFile(filePath, imageData)
  console.log(`[ImageExtractor] Saved image: ${relativePath}`)

  return relativePath
}

/**
 * Extract images from Claude Code message content
 * @param content Message content array from Claude Code JSONL
 * @returns Array of saved image paths
 */
export async function extractImagesFromMessage(content: any[]): Promise<string[]> {
  if (!Array.isArray(content)) {
    return []
  }

  const imagePaths: string[] = []

  for (const item of content) {
    // Check if this content item is an image
    if (item.type === 'image') {
      try {
        // Extract image data
        let imageBuffer: Buffer
        let mimeType: string | undefined

        // Handle different image data formats
        if (item.source?.type === 'base64') {
          // Base64 encoded image
          const base64Data = item.source.data
          imageBuffer = Buffer.from(base64Data, 'base64')
          mimeType = item.source.media_type
        } else if (Buffer.isBuffer(item.data)) {
          // Direct buffer
          imageBuffer = item.data
          mimeType = item.mimeType || item.media_type
        } else {
          console.warn('[ImageExtractor] Unknown image format:', item)
          continue
        }

        // Save image and get relative path
        const path = await saveImage(imageBuffer, mimeType)
        imagePaths.push(path)
      } catch (error) {
        console.error('[ImageExtractor] Failed to extract image:', error)
      }
    }
  }

  return imagePaths
}

/**
 * Extract images from <vision> tags in assistant messages
 * @param text Assistant message text that may contain <vision>filepath</vision> tags
 * @returns Array of saved image paths (hash-based)
 */
export async function extractVisionImages(text: string): Promise<string[]> {
  const imagePaths: string[] = []

  // Match <vision>filepath</vision> tags - only absolute paths starting with /
  const visionRegex = /<vision>(\/[^<]+)<\/vision>/g
  const matches = text.matchAll(visionRegex)

  for (const match of matches) {
    const filePath = match[1]

    try {
      // Read the image file
      const fs = await import('node:fs/promises')
      const imageBuffer = await fs.readFile(filePath)

      // Determine mime type from file extension
      const extMatch = filePath.match(/\.([^.]+)$/)
      const ext = extMatch ? extMatch[1].toLowerCase() : 'png'
      const mimeType = Object.entries(MIME_TO_EXT).find(([, e]) => e === ext)?.[0] || 'image/png'

      // Save to cache with hash-based naming
      const path = await saveImage(imageBuffer, mimeType)
      imagePaths.push(path)

      console.log(`[ImageExtractor] Extracted vision image: ${filePath} -> ${path}`)
    } catch (error) {
      console.error(`[ImageExtractor] Failed to extract vision image ${filePath}:`, error)
    }
  }

  return imagePaths
}

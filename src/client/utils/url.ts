/**
 * Utility function to get the full URL for images and other resources
 * Handles both absolute URLs and relative paths
 */
export function getResourceUrl(path: string | undefined): string | undefined {
  if (!path) return undefined

  // If it's already an absolute URL (http:// or https://), return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`

  // In production, use relative URLs (client and server on same origin)
  if (import.meta.env.PROD) {
    return cleanPath
  }

  // In development, prepend the API base URL
  // (client runs on different port than API/images server)
  const apiPort = import.meta.env.VITE_API_PORT || '3456'
  const apiHost = import.meta.env.VITE_API_HOST || 'localhost'
  const apiProtocol = import.meta.env.VITE_API_PROTOCOL || 'http'

  return `${apiProtocol}://${apiHost}:${apiPort}${cleanPath}`
}

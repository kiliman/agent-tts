/**
 * Utility function to get the full URL for images and other resources
 * Handles both absolute URLs and relative paths
 */
export function getResourceUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  
  // If it's already an absolute URL (http:// or https://), return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Otherwise, prepend the API base URL
  // In development with HMR, client runs on 3457 but API/images are on 3456
  const apiPort = import.meta.env.VITE_API_PORT || '3456';
  const apiHost = import.meta.env.VITE_API_HOST || 'localhost';
  const apiProtocol = import.meta.env.VITE_API_PROTOCOL || 'http';
  
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${apiProtocol}://${apiHost}:${apiPort}${cleanPath}`;
}
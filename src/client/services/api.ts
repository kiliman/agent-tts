import axios from 'axios'

const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3456'

class ApiClient {
  private baseURL: string

  constructor() {
    this.baseURL = `${API_BASE}/api`
  }

  // TTS Control
  async pausePlayback() {
    const response = await axios.post(`${this.baseURL}/tts/pause`)
    return response.data
  }

  async resumePlayback() {
    const response = await axios.post(`${this.baseURL}/tts/resume`)
    return response.data
  }

  async stopPlayback() {
    const response = await axios.post(`${this.baseURL}/tts/stop`)
    return response.data
  }

  async skipCurrent() {
    const response = await axios.post(`${this.baseURL}/tts/skip`)
    return response.data
  }

  // Profiles
  async getProfiles() {
    const response = await axios.get(`${this.baseURL}/profiles`)
    return response.data
  }

  async setProfileEnabled(profileId: string, enabled: boolean) {
    const response = await axios.put(`${this.baseURL}/profiles/${profileId}`, { enabled })
    return response.data
  }

  async getProfileCwds(profileId: string) {
    const response = await axios.get(`${this.baseURL}/profiles/${profileId}/cwds`)
    return response.data
  }

  // Logs
  async getLogs(
    limit: number = 50,
    profile?: string,
    favoritesOnly: boolean = false,
    offset: number = 0,
    cwd?: string,
  ) {
    const params: any = { limit, offset }
    if (profile) params.profile = profile
    if (favoritesOnly) params.favorites = 'true'
    if (cwd) params.cwd = cwd
    const response = await axios.get(`${this.baseURL}/logs`, { params })
    return response.data
  }

  async getLatestLogsPerProfile() {
    const response = await axios.get(`${this.baseURL}/logs/latest-per-profile`)
    return response.data
  }

  async replayLog(logId: number) {
    const response = await axios.post(`${this.baseURL}/logs/${logId}/replay`)
    return response.data
  }

  async toggleFavorite(id: number) {
    const response = await axios.post(`${this.baseURL}/logs/${id}/favorite`)
    return response.data
  }

  async getFavoritesCount(profile?: string) {
    const params = profile ? { profile } : {}
    const response = await axios.get(`${this.baseURL}/favorites/count`, { params })
    return response.data
  }

  // Status
  async getStatus() {
    const response = await axios.get(`${this.baseURL}/status`)
    return response.data
  }

  // Settings
  async toggleMute() {
    const response = await axios.put(`${this.baseURL}/settings/mute`)
    return response.data
  }

  // Config
  async reloadConfig() {
    const response = await axios.post(`${this.baseURL}/config/reload`)
    return response.data
  }

  // Health
  async checkHealth() {
    const response = await axios.get(`${this.baseURL}/health`)
    return response.data
  }
}

export const apiClient = new ApiClient()

// WebSocket connection for real-time updates
export class WebSocketClient {
  private ws: WebSocket | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private listeners: Map<string, Set<Function>> = new Map()

  connect() {
    const wsURL =
      process.env.NODE_ENV === 'production'
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
        : 'ws://localhost:3456/ws'

    this.ws = new WebSocket(wsURL)

    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.emit('connected')
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.emit(data.type, data.data || data)
      } catch (error) {
        console.error('WebSocket message parse error:', error)
      }
    }

    this.ws.onclose = () => {
      console.log('WebSocket disconnected')
      this.emit('disconnected')
      this.reconnect()
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.emit('error', error)
    }
  }

  private reconnect() {
    if (this.reconnectTimeout) return

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      console.log('Attempting to reconnect WebSocket...')
      this.connect()
    }, 3000)
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }

  private emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => callback(data))
    }
  }

  send(type: string, data?: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export const wsClient = new WebSocketClient()

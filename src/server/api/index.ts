import { Express, Request, Response } from 'express';
import { AppCoordinator } from '../../services/app-coordinator.js';

export function setupApiRoutes(app: Express, coordinator: AppCoordinator) {
  // TTS Control endpoints
  app.post('/api/tts/pause', async (req: Request, res: Response) => {
    try {
      await coordinator.pausePlayback();
      res.json({ success: true, message: 'Playback paused' });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  app.post('/api/tts/resume', async (req: Request, res: Response) => {
    try {
      await coordinator.resumePlayback();
      res.json({ success: true, message: 'Playback resumed' });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  app.post('/api/tts/stop', async (req: Request, res: Response) => {
    try {
      await coordinator.stopPlayback();
      res.json({ success: true, message: 'Playback stopped' });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  app.post('/api/tts/skip', async (req: Request, res: Response) => {
    try {
      await coordinator.skipCurrent();
      res.json({ success: true, message: 'Skipped current message' });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Profile management
  app.get('/api/profiles', async (req: Request, res: Response) => {
    try {
      const profiles = await coordinator.getProfiles();
      res.json({ success: true, profiles });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  app.put('/api/profiles/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      await coordinator.setProfileEnabled(id, enabled);
      res.json({ success: true, message: `Profile ${id} ${enabled ? 'enabled' : 'disabled'}` });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Logs
  app.get('/api/logs', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const profile = req.query.profile as string | undefined;
      const logs = await coordinator.getLogsWithAvatars(limit, profile);
      res.json({ success: true, logs });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Get last message per profile for dashboard
  app.get('/api/logs/latest-per-profile', async (req: Request, res: Response) => {
    try {
      const latestLogs = await coordinator.getLatestLogsPerProfile();
      res.json({ success: true, logs: latestLogs });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  app.post('/api/logs/:id/replay', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await coordinator.replayLog(parseInt(id));
      res.json({ success: true, message: 'Replaying log entry' });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Status
  app.get('/api/status', async (req: Request, res: Response) => {
    try {
      const status = await coordinator.getStatus();
      res.json({ success: true, ...status });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Settings
  app.put('/api/settings/mute', async (req: Request, res: Response) => {
    try {
      const currentMute = await coordinator.isMuted();
      await coordinator.setMuted(!currentMute);
      res.json({ success: true, muted: !currentMute });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Config reload
  app.post('/api/config/reload', async (req: Request, res: Response) => {
    try {
      await coordinator.reloadConfig();
      res.json({ success: true, message: 'Configuration reloaded' });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ success: true, status: 'healthy' });
  });
}
import { WebSocketServer, WebSocket } from 'ws';
import { AppCoordinator } from '../services/app-coordinator.js';

export function setupWebSocket(wss: WebSocketServer, coordinator: AppCoordinator) {
  // Setup global event listeners that broadcast to all clients
  const broadcastToAll = (type: string, data: any) => {
    const message = JSON.stringify({ type, data });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Global event listeners - broadcast to all connected clients
  coordinator.on('log-added', (log) => {
    console.log('[WebSocket] Broadcasting log-added to all clients');
    broadcastToAll('log-added', log);
  });

  coordinator.on('status-changed', (status) => {
    console.log('[WebSocket] Broadcasting status-changed to all clients');
    broadcastToAll('status-changed', status);
  });

  coordinator.on('queue-updated', (queue) => {
    console.log('[WebSocket] Broadcasting queue-updated to all clients');
    broadcastToAll('queue-updated', queue);
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    // Send initial status
    coordinator.getStatus().then(status => {
      ws.send(JSON.stringify({ type: 'status', data: status }));
    });

    // Handle incoming messages
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
            
          case 'get-status':
            const status = await coordinator.getStatus();
            ws.send(JSON.stringify({ type: 'status', data: status }));
            break;
            
          case 'get-logs':
            const logs = await coordinator.getLogsWithAvatars(50);
            ws.send(JSON.stringify({ type: 'logs', data: logs }));
            break;
            
          default:
            ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', error: (error as Error).message }));
      }
    });

    // Cleanup on disconnect
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
}
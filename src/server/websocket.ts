import { WebSocketServer, WebSocket } from 'ws';
import { AppCoordinator } from '../services/app-coordinator.js';

export function setupWebSocket(wss: WebSocketServer, coordinator: AppCoordinator) {
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
            const logs = await coordinator.database.getTTSLog().getRecentLogs(50);
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

    // Setup event listeners for coordinator events
    const handleLogAdded = (log: any) => {
      ws.send(JSON.stringify({ type: 'log-added', data: log }));
    };

    const handleStatusChanged = (status: any) => {
      ws.send(JSON.stringify({ type: 'status-changed', data: status }));
    };

    const handleQueueUpdated = (queue: any) => {
      ws.send(JSON.stringify({ type: 'queue-updated', data: queue }));
    };

    coordinator.on('log-added', handleLogAdded);
    coordinator.on('status-changed', handleStatusChanged);
    coordinator.on('queue-updated', handleQueueUpdated);

    // Cleanup on disconnect
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      coordinator.off('log-added', handleLogAdded);
      coordinator.off('status-changed', handleStatusChanged);
      coordinator.off('queue-updated', handleQueueUpdated);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
}
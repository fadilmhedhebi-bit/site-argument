import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import tourRoutes from './routes/tours.js';
import statsRoutes from './routes/stats.js';
import promoRoutes from './routes/promos.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tours', tourRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/promos', promoRoutes);

// WebSocket connections by user id
const clients = new Map();

wss.on('connection', (ws, req) => {
  let userId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'auth') {
        userId = msg.userId;
        if (!clients.has(userId)) clients.set(userId, new Set());
        clients.get(userId).add(ws);
      }
      if (msg.type === 'position' && userId) {
        broadcast(msg, userId);
      }
    } catch {}
  });

  ws.on('close', () => {
    if (userId && clients.has(userId)) {
      clients.get(userId).delete(ws);
      if (clients.get(userId).size === 0) clients.delete(userId);
    }
  });
});

export function broadcast(data, excludeUserId) {
  const message = JSON.stringify(data);
  for (const [uid, sockets] of clients) {
    if (uid !== excludeUserId) {
      for (const ws of sockets) {
        if (ws.readyState === 1) ws.send(message);
      }
    }
  }
}

export function sendToUser(userId, data) {
  const sockets = clients.get(userId);
  if (sockets) {
    const message = JSON.stringify(data);
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(message);
    }
  }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Tournée Snack Express server running on port ${PORT}`);
});

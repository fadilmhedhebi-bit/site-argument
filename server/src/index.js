import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import tourRoutes from './routes/tours.js';
import statsRoutes from './routes/stats.js';
import promoRoutes from './routes/promos.js';
import ingredientRoutes from './routes/ingredients.js';
import customerRoutes from './routes/customers.js';
import { verifySocketToken } from './middleware/auth.js';
import pool from './config/db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/socket.io',
});

// ============================================================
// EXPRESS MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalide dans le corps de la requête' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// ============================================================
// API ROUTES
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tours', tourRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/customers', customerRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Route API non trouvée' });
});

// ============================================================
// STATIC FILES (production)
// ============================================================

const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ============================================================
// SOCKET.IO - GPS en temps réel + notifications
// ============================================================

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Token d\'authentification requis'));
  }
  const user = verifySocketToken(token);
  if (!user) {
    return next(new Error('Token invalide'));
  }
  socket.user = user;
  next();
});

io.on('connection', (socket) => {
  const { id: userId, businessId, role } = socket.user;

  socket.join(`business:${businessId}`);
  socket.join(`user:${userId}`);

  if (['driver', 'manager_driver'].includes(role)) {
    socket.join(`drivers:${businessId}`);
  }

  console.log(`Socket connected: ${userId} (${role})`);

  // GPS position update from driver
  socket.on('position:update', async (data) => {
    if (!['driver', 'manager_driver'].includes(role)) return;

    const { latitude, longitude, heading, speed } = data;
    if (latitude == null || longitude == null) return;

    try {
      await pool.query(
        `INSERT INTO driver_positions (driver_id, latitude, longitude, heading, speed)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, latitude, longitude, heading || null, speed || null]
      );
    } catch (err) {
      console.error('Save position error:', err);
    }

    socket.to(`business:${businessId}`).emit('position:updated', {
      driverId: userId,
      latitude,
      longitude,
      heading,
      speed,
      timestamp: new Date().toISOString(),
    });
  });

  // Request current positions of all drivers
  socket.on('positions:request', async () => {
    try {
      const result = await pool.query(
        `SELECT DISTINCT ON (dp.driver_id) dp.driver_id, dp.latitude, dp.longitude, dp.heading, dp.speed, dp.recorded_at,
                u.first_name, u.last_name
         FROM driver_positions dp
         JOIN users u ON u.id = dp.driver_id
         WHERE u.business_id = $1 AND dp.recorded_at > NOW() - INTERVAL '30 minutes'
         ORDER BY dp.driver_id, dp.recorded_at DESC`,
        [businessId]
      );
      socket.emit('positions:all', result.rows);
    } catch (err) {
      console.error('Fetch positions error:', err);
    }
  });

  // Driver status toggle (available/busy)
  socket.on('driver:status', (data) => {
    socket.to(`business:${businessId}`).emit('driver:status', {
      driverId: userId,
      status: data.status,
    });
  });

  socket.on('disconnect', () => {
    socket.to(`business:${businessId}`).emit('driver:offline', { driverId: userId });
    console.log(`Socket disconnected: ${userId}`);
  });
});

// ============================================================
// EXPORT IO GETTER FOR ROUTES
// ============================================================

let ioInstance = io;

export function getIO() {
  return ioInstance;
}

export function sendToUser(userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}

export function broadcastToBusiness(businessId, event, data) {
  io.to(`business:${businessId}`).emit(event, data);
}

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Foodly server running on port ${PORT}`);
  console.log(`Socket.IO ready on ws://localhost:${PORT}/socket.io`);
});

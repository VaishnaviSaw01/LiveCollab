import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { prisma } from './db';
import { setupWSConnection } from './sync';

const port = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json());

// Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    const room = await prisma.room.create({
      data: { name: req.body.name || 'Untitled Room' },
    });
    // Create an initial empty document
    await prisma.document.create({
      data: {
        roomId: room.id,
        state: Buffer.from([]), // Will be initialized by the first client
      }
    });
    res.json(room);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get room details
app.get('/api/rooms/:id', async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
    });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // Extract room ID from URL (e.g. /ws/rooms/:id)
  const urlParts = req.url?.split('/') || [];
  const roomId = urlParts[urlParts.length - 1];
  
  if (!roomId) {
    ws.close(1008, 'Room ID is required');
    return;
  }
  
  setupWSConnection(ws, req, roomId);
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

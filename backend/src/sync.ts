import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import Redis from 'ioredis';
import { prisma } from './db';
import { IncomingMessage } from 'http';

// Setup Redis clients
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const pubClient = new Redis(redisUrl);
const subClient = new Redis(redisUrl);

const docs: Map<string, { doc: Y.Doc; awareness: awarenessProtocol.Awareness }> = new Map();

// Helper: send message to a ws connection
const send = (ws: WebSocket, message: Uint8Array) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message, (err) => {
      if (err) console.error('Error sending message:', err);
    });
  }
};

const initDoc = async (roomId: string) => {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);

  // Load from Postgres
  const dbDoc = await prisma.document.findFirst({
    where: { roomId },
  });
  if (dbDoc && dbDoc.state.length > 0) {
    Y.applyUpdate(doc, new Uint8Array(dbDoc.state));
  }

  // Subscribe to Redis for updates from other instances
  subClient.subscribe(`doc-update:${roomId}`);
  subClient.subscribe(`awareness:${roomId}`);

  docs.set(roomId, { doc, awareness });

  doc.on('update', (update, origin) => {
    // If the origin is not 'redis', we publish it to Redis
    if (origin !== 'redis') {
      pubClient.publish(`doc-update:${roomId}`, Buffer.from(update));
    }
  });

  awareness.on('update', ({ added, updated, removed }, origin) => {
    if (origin !== 'redis') {
      const changedClients = added.concat(updated).concat(removed);
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
      pubClient.publish(`awareness:${roomId}`, Buffer.from(update));
    }
  });

  // Periodic save to DB
  const saveInterval = setInterval(async () => {
    const state = Y.encodeStateAsUpdate(doc);
    await prisma.document.updateMany({
      where: { roomId },
      data: { state: Buffer.from(state) },
    });
  }, 30000); // 30s

  doc.on('destroy', () => {
    clearInterval(saveInterval);
    subClient.unsubscribe(`doc-update:${roomId}`);
    subClient.unsubscribe(`awareness:${roomId}`);
  });

  return { doc, awareness };
};

// Redis incoming messages handler
subClient.on('messageBuffer', (channelBuffer, message) => {
  const channel = channelBuffer.toString();
  if (channel.startsWith('doc-update:')) {
    const roomId = channel.replace('doc-update:', '');
    const docData = docs.get(roomId);
    if (docData) {
      // Apply update from Redis (from another backend instance)
      Y.applyUpdate(docData.doc, new Uint8Array(message), 'redis');
    }
  } else if (channel.startsWith('awareness:')) {
    const roomId = channel.replace('awareness:', '');
    const docData = docs.get(roomId);
    if (docData) {
      awarenessProtocol.applyAwarenessUpdate(docData.awareness, new Uint8Array(message), 'redis');
    }
  }
});

// WS Message Handler
const messageHandler = (ws: WebSocket, roomId: string, message: Uint8Array) => {
  const docData = docs.get(roomId);
  if (!docData) return;
  const { doc, awareness } = docData;

  const encoder = encoding.createEncoder();
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case 0: // sync
      encoding.writeVarUint(encoder, 0);
      syncProtocol.readSyncMessage(decoder, encoder, doc, ws);
      if (encoding.length(encoder) > 1) {
        send(ws, encoding.toUint8Array(encoder));
      }
      break;
    case 1: // awareness
      awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), ws);
      break;
  }
};

export const setupWSConnection = async (ws: WebSocket, req: IncomingMessage, roomId: string) => {
  ws.binaryType = 'arraybuffer';
  
  if (!docs.has(roomId)) {
    await initDoc(roomId);
  }
  
  const docData = docs.get(roomId)!;
  
  ws.on('message', (message: ArrayBuffer) => {
    messageHandler(ws, roomId, new Uint8Array(message));
  });

  ws.on('close', async () => {
    if (docs.has(roomId)) {
      const { doc } = docs.get(roomId)!;
      // Trigger a final save on disconnect if it's the last connection? 
      // For now, let's just do a DB save.
      const state = Y.encodeStateAsUpdate(doc);
      await prisma.document.updateMany({
        where: { roomId },
        data: { state: Buffer.from(state) },
      });
    }
  });

  // Initial Sync: send Sync Step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0); // message type: sync
  syncProtocol.writeSyncStep1(encoder, docData.doc);
  send(ws, encoding.toUint8Array(encoder));

  // Send current awareness state
  const awarenessStates = docData.awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, 1); // message type: awareness
    const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(docData.awareness, Array.from(awarenessStates.keys()));
    encoding.writeVarUint8Array(awarenessEncoder, awarenessUpdate);
    send(ws, encoding.toUint8Array(awarenessEncoder));
  }
};

# LiveCollab

LiveCollab is a full-fledged, production-quality real-time collaborative code editor. It features conflict-free simultaneous editing across multiple clients using CRDTs (Conflict-free Replicated Data Types) without relying on centralized locking.

## Features
- **Real-time Collaboration**: Sub-100ms sync latency with cursor positions, selections, and presence indicators.
- **CRDT Engine**: Powered by Yjs (YATA algorithm) for deterministic, locking-free conflict resolution.
- **Horizontal Scalability**: Redis Pub/Sub awareness protocol allowing the WebSocket layer to scale across multiple backend instances.
- **Persistent Sessions**: Periodic and disconnect-triggered snapshotting of the Yjs document state to PostgreSQL for full crash recovery.

## Architecture

![Architecture](https://via.placeholder.com/800x400.png?text=LiveCollab+Architecture)
*(See `docs/ARCHITECTURE.md` and `docs/CRDT.md` for in-depth details).*

## Setup Instructions

### Prerequisites
- Docker & Docker Compose
- Node.js 20+

### Local Development (Docker Compose)
The easiest way to run the entire stack (Postgres, Redis, Backend, Frontend) is via Docker Compose:

```bash
# 1. Start the infrastructure and applications
docker compose up --build

# 2. Access the frontend
open http://localhost:5173
```

### Manual Development Setup
If you want to run the Node.js processes manually for debugging:
```bash
# 1. Start Postgres & Redis
docker compose up postgres redis -d

# 2. Setup Backend
cd backend
npm install
npx prisma db push
npm run dev

# 3. Setup Frontend
cd frontend
npm install
npm run dev
```

## Design Decisions
- **CRDTs over OT**: Operational Transformation requires a central server to sequence operations, creating a bottleneck. CRDTs ensure mathematical convergence regardless of the order in which operations are received, simplifying architecture and making offline/reconnects trivial.
- **Redis for Presence**: While Yjs awareness can live entirely in memory on one WebSocket server, LiveCollab is designed for production. Using Redis Pub/Sub ensures presence state (cursors, online users) is shared globally even if clients are connected to different backend instances behind a load balancer.
- **Periodic Snapshotting vs Append-only Log**: Yjs documents can grow infinitely if all operations are stored as an event log in the database. By periodically persisting a compressed binary snapshot (`Y.encodeStateAsUpdate`), we ensure fast recovery times and constant-bound database storage per document size.
- **Monaco over CodeMirror**: Monaco is the editor that powers VS Code. It provides unparalleled out-of-the-box support for TypeScript semantics, IntelliSense, and multi-cursor decorations out of the box, offering a premium IDE experience.

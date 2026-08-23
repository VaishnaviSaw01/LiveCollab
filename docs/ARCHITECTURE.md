# LiveCollab Architecture

## System Components
1. **Frontend**: React + TypeScript + Monaco Editor. Connects via `y-websocket`.
2. **Backend**: Node.js + Express + `ws`. Custom Yjs sync layer managing connections.
3. **Redis**: Pub/Sub broker to synchronize Yjs document state and presence (awareness) across multiple horizontal backend instances.
4. **PostgreSQL**: Persistent storage for room metadata and periodic/disconnect snapshots of the Yjs document state.

---

## Data Flows

### A. User typing a character
1. The user types a character in the Monaco Editor.
2. The `y-monaco` binding intercepts the change and applies it as a local operation to the in-memory `Y.Doc`.
3. The local `Y.Doc` fires an `update` event, which the `y-websocket` client encodes and sends to the backend via WebSocket.
4. The backend receives the binary update, applies it to its own in-memory `Y.Doc` for that room, and immediately publishes it to Redis (`doc-update:<roomId>`).
5. Other backend instances subscribed to the Redis channel receive the update and apply it to their in-memory docs.
6. The backend broadcasts the update over WebSocket to all other connected clients in the room.
7. The receiving clients' `y-websocket` applies the update to their `Y.Doc`, and `y-monaco` reflects the character in their UI.

### B. User joining an existing room
1. The user navigates to `/room/:roomId`. The frontend initializes a new `Y.Doc` and connects to the WebSocket endpoint.
2. The backend accepts the WebSocket connection. If the room is not already loaded in memory, it queries PostgreSQL for the latest snapshot (`Y.applyUpdate(doc, dbDoc.state)`).
3. The backend subscribes to Redis channels for this room.
4. The backend sends a "Sync Step 1" message to the client, providing its current state vector.
5. The client replies with "Sync Step 2", requesting any missing operations.
6. The backend sends the full state or missing updates. The client is now in sync.
7. The client broadcasts its awareness state (name, color, cursor position).

### C. Server crash and recovery
1. If a backend instance crashes, all connected WebSocket clients are disconnected.
2. The `y-websocket` client has automatic reconnection logic and will attempt to reconnect to the load balancer (Nginx Ingress).
3. The load balancer routes the clients to healthy backend instances.
4. The healthy instance, recognizing the room, fetches the latest snapshot from PostgreSQL.
5. Note: Any operations that were in-flight during the crash and not yet saved to PostgreSQL or synced to other clients might be lost from the server's perspective. However, because CRDTs are decentralized, the *reconnecting clients still have their local operations*. When they reconnect, the standard Sync Step 1/2 protocol ensures their local operations are merged back into the shared state. No data is lost as long as at least one client had the data!

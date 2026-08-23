# Conflict-free Replicated Data Types (CRDTs) & Yjs

LiveCollab uses **CRDTs** (specifically the **Yjs** library) instead of Operational Transformation (OT) to handle simultaneous collaborative editing.

## Why CRDTs over OT?
- **No Central Source of Truth**: OT requires a central server to sequence operations, resulting in a single point of failure and bottleneck. CRDTs are decentralized; peers can merge changes in any order and mathematically guarantee they will converge to the exact same state.
- **Simpler to Reason About**: OT has complex edge cases for transforming operations against each other. CRDTs handle this through deterministic insertion and tombstoning algorithms.

## How Yjs Works (YATA Algorithm)
Yjs is based on a variant of the **YATA** (Yet Another Transformation Approach) algorithm. Here is how it guarantees convergence without locking:

### 1. The Document Model
A text document in Yjs is modeled as a doubly-linked list of items (characters or blocks). Each item has a unique identifier composed of a `(client_id, clock)` pair.

### 2. Insertion Rules
When a user types a character, a new item is created. It explicitly references its left (predecessor) and right (successor) neighbors.
If two users insert characters at the exact same position simultaneously (a conflict), the YATA algorithm resolves the conflict deterministically using the following rules:
- No two items can cross each other.
- The item from the client with the **lower client ID** is placed to the left.
Because these rules are deterministic, all clients independently applying the operations will arrange the conflicting insertions in the exact same order.

### 3. Deletion (Tombstones)
When text is deleted, it is not immediately removed from memory. Instead, the item is marked as "deleted" (a tombstone). This ensures that concurrent insertions that referenced the deleted item as a neighbor still have a valid reference point to resolve their position.

### 4. Garbage Collection
Keeping tombstones forever would bloat memory. Yjs implements a garbage collection process that removes tombstones when it is mathematically guaranteed that all active peers have synchronized past that point, converting the linked list into a more compact tree-like representation.

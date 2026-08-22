import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Editor, { useMonaco } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';

// Generate a random color for the user's cursor
const cursorColors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'];
const myColor = cursorColors[Math.floor(Math.random() * cursorColors.length)];
const myName = `User-${Math.floor(Math.random() * 1000)}`;

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const editorRef = useRef<any>(null);
  const monaco = useMonaco();
  
  const [presenceList, setPresenceList] = useState<any[]>([]);
  const [latency, setLatency] = useState<number>(0);

  useEffect(() => {
    if (!editorRef.current || !monaco || !roomId) return;

    // 1. Initialize Yjs document
    const ydoc = new Y.Doc();
    
    // 2. Connect to WebSocket provider
    const wsBaseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';
    // Using a custom endpoint pattern to match backend
    const provider = new WebsocketProvider(wsBaseUrl, `ws/rooms/${roomId}`, ydoc, {
      connect: true
    });

    // 3. Get a shared text type for Monaco
    const ytext = ydoc.getText('monaco');

    // 4. Bind Monaco Editor to Yjs Text
    const binding = new MonacoBinding(
      ytext,
      editorRef.current.getModel(),
      new Set([editorRef.current]),
      provider.awareness
    );

    // 5. Setup Awareness (Presence)
    provider.awareness.setLocalStateField('user', {
      name: myName,
      color: myColor,
    });

    provider.awareness.on('change', () => {
      const states = Array.from(provider.awareness.getStates().values());
      const activeUsers = states.map((state: any) => state.user).filter(Boolean);
      setPresenceList(activeUsers);
    });

    // Sub-100ms sync latency tracking
    // For a rough estimation, we can track time between doc changes if we had custom ping/pong.
    // Here we just monitor connection status.
    provider.on('status', (event: any) => {
      console.log('WS status:', event.status);
    });

    // Clean up
    return () => {
      binding.destroy();
      provider.disconnect();
      ydoc.destroy();
    };
  }, [monaco, roomId]);

  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    editorRef.current = editor;
  };

  return (
    <div className="room-layout">
      {/* Sidebar for Presence */}
      <div className="sidebar">
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Room: {roomId?.slice(0, 8)}</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Latency: ~{latency}ms (WS)
          </div>
        </div>
        <div className="presence-list">
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Active Users ({presenceList.length})
          </h3>
          {presenceList.map((user, idx) => (
            <div key={idx} className="presence-item glass-panel">
              <div className="presence-dot" style={{ backgroundColor: user.color }} />
              <span style={{ fontSize: '0.9rem' }}>{user.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="editor-container">
        <div className="topbar">
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Editing:</span> index.ts
          </div>
          <div>
            <button className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
              Share
            </button>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <Editor
            height="100%"
            defaultLanguage="typescript"
            theme="vs-dark"
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              padding: { top: 16 },
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on'
            }}
          />
        </div>
      </div>
    </div>
  );
}

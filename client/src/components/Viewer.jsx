import React from 'react';
import { VncScreen } from 'react-vnc';

function Viewer({ instance, onBack }) {
  // Construct WebSocket URL for noVNC
  // Handle secure connection if the page is loaded over https
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const hostname = window.location.hostname;
  const url = `${protocol}://${hostname}:${instance.wsPort}`;

  return (
    <div className="viewer-container full-screen">
      <div className="floating-controls">
        <button onClick={onBack} className="disconnect-btn">
          ← Back to Menu
        </button>
      </div>
      
      <VncScreen
        url={url}
        scaleViewport
        background="#1a1a2e"
        style={{
          width: '100vw',
          height: '100vh',
        }}
        ref={ref => {
           // Optional: handle ref
        }}
      />
    </div>
  );
}

export default Viewer;

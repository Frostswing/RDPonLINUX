import React from 'react';
import { VncScreen } from 'react-vnc';

function Viewer({ instance, onBack }) {
  // Construct WebSocket URL for noVNC
  // Handle secure connection if the page is loaded over https
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const hostname = window.location.hostname;
  const url = `${protocol}://${hostname}:${instance.wsPort}`;

  React.useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetch(`/api/instances/${instance.id}/resize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            width: window.innerWidth,
            height: window.innerHeight
          })
        }).catch(err => console.error('Failed to resize:', err));
      }, 500); // Debounce for 500ms
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [instance.id]);

  return (
    <div className="viewer-container full-screen">
      <div className="floating-controls" style={{
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 1000,
        padding: '10px'
      }}>
        <button onClick={onBack} className="disconnect-btn" style={{
          backgroundColor: '#ff4b4b',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '0 0 0 8px', // Rounded bottom-left corner
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}>
          Back to Menu
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

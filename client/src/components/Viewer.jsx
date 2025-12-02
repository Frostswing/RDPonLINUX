import React from 'react';
import { VncScreen } from 'react-vnc';

function Viewer({ instance, onBack }) {
  // Construct WebSocket URL for noVNC
  // Handle secure connection if the page is loaded over https
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const hostname = window.location.hostname;
  const url = `${protocol}://${hostname}:${instance.wsPort}`;

  // State for button scale and settings visibility
  const [buttonScale, setButtonScale] = React.useState(() => {
    const saved = localStorage.getItem(`btn_scale_${instance.id}`);
    const parsed = parseFloat(saved);
    return (saved && !isNaN(parsed)) ? parsed : 1;
  });
  const [showSettings, setShowSettings] = React.useState(false);

  const handleScaleChange = (e) => {
    const newScale = parseFloat(e.target.value);
    setButtonScale(newScale);
    localStorage.setItem(`btn_scale_${instance.id}`, newScale);
  };

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

  const handleKillSession = async () => {
    if (confirm('Are you sure you want to kill this session? All unsaved work will be lost.')) {
      try {
        await fetch(`/api/instances/${instance.id}`, { method: 'DELETE' });
        onBack();
      } catch (err) {
        console.error('Failed to kill session:', err);
        alert('Failed to kill session');
      }
    }
  };

  return (
    <div className="viewer-container full-screen">
      <div className="floating-controls" style={{
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 9999, // Ensure it's above everything
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '5px',
        pointerEvents: 'none' // Allow clicks to pass through the container area
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          transform: `scale(${buttonScale})`,
          transformOrigin: 'top right',
          transition: 'transform 0.1s ease-out',
          pointerEvents: 'auto' // Re-enable clicks for the buttons
        }}>
           {showSettings && (
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: '5px 10px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(4px)'
            }}>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={buttonScale}
                onChange={handleScaleChange}
                style={{ width: '100px', cursor: 'pointer' }}
              />
            </div>
          )}
          <button 
            onClick={() => setShowSettings(!showSettings)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)', // High contrast white
              color: '#333', // Dark icon
              border: '1px solid #ccc',
              borderRadius: '4px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
            title="Resize Button"
          >
            ⚙️
          </button>
          <div style={{ display: 'flex', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', borderRadius: '0 0 0 8px' }}>
            <button onClick={onBack} className="disconnect-btn" style={{
              backgroundColor: '#ff4b4b',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '0 0 0 8px', // Rounded bottom-left corner
              cursor: 'pointer',
              fontWeight: 'bold',
              borderRight: '1px solid rgba(0,0,0,0.1)'
            }} title="Back to Menu (Keep Session Alive)">
              Back
            </button>
            <button onClick={handleKillSession} style={{
              backgroundColor: '#d32f2f', // Slightly darker red
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              borderRadius: '0'
            }} title="Kill Session">
              ✕
            </button>
          </div>
        </div>
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

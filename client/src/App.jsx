import React, { useState, useEffect } from 'react';
import axios from 'axios';
import InstanceList from './components/InstanceList';
import Viewer from './components/Viewer';
import LandingPage from './components/LandingPage';
import './App.css';

function App() {
  const [view, setView] = useState('loading'); // 'loading', 'landing', 'list', 'viewer'
  const [currentInstance, setCurrentInstance] = useState(null);
  const [lastSession, setLastSession] = useState(null);
  const [error, setError] = useState(null);

  // Heartbeat to keep session "active" in localStorage
  useEffect(() => {
    if (view === 'viewer' && currentInstance) {
      const interval = setInterval(() => {
        const activeSessions = JSON.parse(localStorage.getItem('antigravity_active_sessions') || '{}');
        activeSessions[currentInstance.id] = Date.now();
        localStorage.setItem('antigravity_active_sessions', JSON.stringify(activeSessions));
      }, 1000); // Update every second

      return () => clearInterval(interval);
    }
  }, [view, currentInstance]);

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Get all instances from server
        const res = await axios.get('/api/instances');
        let instances = res.data;

        // If no instances, create one
        if (instances.length === 0) {
           const createRes = await axios.post('/api/instances', {
            width: window.innerWidth,
            height: window.innerHeight
          });
          instances = [createRes.data];
        }

        // 2. Get session history and active sessions
        const history = JSON.parse(localStorage.getItem('antigravity_session_history') || '{}');
        const activeSessions = JSON.parse(localStorage.getItem('antigravity_active_sessions') || '{}');
        const now = Date.now();

        // Filter out stale active sessions (older than 5 seconds)
        Object.keys(activeSessions).forEach(id => {
          if (now - activeSessions[id] > 5000) {
            delete activeSessions[id];
          }
        });
        localStorage.setItem('antigravity_active_sessions', JSON.stringify(activeSessions));

        // 3. Sort instances by last accessed time (descending)
        // If not in history, use createdAt (newest first) or just append
        instances.sort((a, b) => {
          const timeA = history[a.id] || 0;
          const timeB = history[b.id] || 0;
          if (timeA !== timeB) return timeB - timeA; // Most recently used first
          // If never used, maybe sort by creation time?
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        // 4. Find the first instance that is NOT active
        const targetInstance = instances.find(inst => !activeSessions[inst.id]);

        if (targetInstance) {
          // Found a free session, connect to it
          handleConnect(targetInstance);
        } else {
          // All sessions are active?
          // Fallback: Connect to the first one (most recently used) even if active?
          // Or maybe the one with the oldest heartbeat?
          // For now, let's connect to the first one in the sorted list.
          if (instances.length > 0) {
             handleConnect(instances[0]);
          } else {
             // Should not happen as we created one if empty
             setView('landing');
          }
        }

      } catch (err) {
        console.error("Initialization failed", err);
        setView('landing');
      }
    };
    init();
  }, []);

  const handleConnect = (instance) => {
    setCurrentInstance(instance);
    
    // Update history
    const history = JSON.parse(localStorage.getItem('antigravity_session_history') || '{}');
    history[instance.id] = Date.now();
    localStorage.setItem('antigravity_session_history', JSON.stringify(history));

    // Update last session for "Resume" button (though we auto-connect now)
    const sessionData = {
      id: instance.id,
      date: new Date().toISOString()
    };
    localStorage.setItem('antigravity_last_session', JSON.stringify(sessionData));
    setLastSession(sessionData);

    setView('viewer');
    setError(null);
  };

  const handleResume = async () => {
     // With auto-connect, this might be less used, but still good to have
    if (!lastSession) return;
    
    try {
      const res = await axios.get('/api/instances');
      const instance = res.data.find(i => i.id === lastSession.id);
      
      if (instance) {
        handleConnect(instance);
      } else {
        setError('Last session no longer exists.');
        localStorage.removeItem('antigravity_last_session');
        setLastSession(null);
        setTimeout(() => setError(null), 3000);
        setView('list');
      }
    } catch (err) {
      console.error("Failed to resume session", err);
      setError('Failed to resume session. Please try again.');
      setView('list');
    }
  };

  const handleManage = () => {
    setView('list');
  };

  const handleBack = () => {
    setCurrentInstance(null);
    setView('landing');
  };

  return (
    <div className="app-container">
      <header>
        <h1>Antigravity RDP</h1>
      </header>
      <main>
        {error && <div className="error-toast">{error}</div>}
        
        {view === 'landing' && (
          <LandingPage 
            onResume={handleResume} 
            onManage={handleManage}
            lastSessionDate={lastSession?.date}
          />
        )}
        {view === 'list' && (
          <InstanceList onConnect={handleConnect} />
        )}
        {view === 'viewer' && currentInstance && (
          <Viewer instance={currentInstance} onBack={handleBack} />
        )}
        {view === 'loading' && (
            <div className="loading-screen">Connecting...</div>
        )}
      </main>
    </div>
  );
}

export default App;

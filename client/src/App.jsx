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

  useEffect(() => {
    const init = async () => {
      const savedSession = localStorage.getItem('antigravity_last_session');
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          // Validate with server
          try {
            const res = await axios.get('/api/instances');
            const exists = res.data.find(i => i.id === parsed.id);
            if (exists) {
              setLastSession(parsed);
              setView('landing');
            } else {
              // Session invalid, clear it
              localStorage.removeItem('antigravity_last_session');
              checkInstancesAndAutoCreate();
            }
          } catch (err) {
            // Server error, maybe offline? Fallback to list or keep landing but it might fail
            console.error("Failed to validate session", err);
            // If we can't reach server, we probably can't connect anyway.
            // Let's just show list/landing and let user try.
            // But to be safe against "always seeing resume", let's clear if we can't verify?
            // No, if server is down, we want to show something.
            // Let's assume if we can't verify, we don't show resume.
             localStorage.removeItem('antigravity_last_session');
             checkInstancesAndAutoCreate();
          }
        } catch (e) {
          localStorage.removeItem('antigravity_last_session');
          checkInstancesAndAutoCreate();
        }
      } else {
        checkInstancesAndAutoCreate();
      }
    };
    init();
  }, []);

  const checkInstancesAndAutoCreate = async () => {
    try {
      const res = await axios.get('/api/instances');
      // If we have instances, show list. If not, show list (empty state).
      // We don't auto-create anymore, user must explicitly create.
      // But wait, if we have a valid session, we would have handled it in init().
      // So here we just decide between landing (if we want to show it initially) or list.
      // The user flow seems to be: Landing -> (Resume or Management).
      // If we don't have a session, we should probably show Landing Page?
      // But Landing Page only has "Resume" and "Go to Management".
      // If "Resume" is not possible (no session), then Landing Page is just a big "Go to Management" button?
      // Maybe we should just go to 'list' if no session?
      // Or show Landing with disabled Resume?
      // Let's go to 'landing' but ensure Resume is disabled/hidden if no session.
      // Actually, my LandingPage component hides the Resume button if no lastSessionDate is passed.
      // But `lastSession` state is null here.
      // So showing 'landing' is fine.
      setView('landing');
    } catch (err) {
      console.error("Failed to check instances", err);
      setView('landing'); // Default to landing on error too
    }
  };

  const handleConnect = (instance) => {
    setCurrentInstance(instance);
    // Save session
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
    if (!lastSession) return;
    
    try {
      const res = await axios.get('/api/instances');
      const instance = res.data.find(i => i.id === lastSession.id);
      
      if (instance) {
        handleConnect(instance);
      } else {
        // Instance no longer exists
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
      </main>
    </div>
  );
}

export default App;

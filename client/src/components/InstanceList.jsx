import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './InstanceList.css';

function InstanceList({ onConnect }) {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const fetchInstances = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/instances');
      setInstances(res.data);
    } catch (err) {
      console.error("Failed to fetch instances", err);
    } finally {
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 5000);
    return () => clearInterval(interval);
  }, []);

  const launchInstance = async () => {
    setLoading(true);
    try {
      await axios.post('http://localhost:3000/api/instances');
      fetchInstances();
    } catch (err) {
      alert("Failed to launch instance");
    } finally {
      setLoading(false);
    }
  };

  const terminateInstance = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to terminate this instance?")) return;
    try {
      await axios.delete(`http://localhost:3000/api/instances/${id}`);
      fetchInstances();
    } catch (err) {
      alert("Failed to terminate instance");
    }
  };

  if (initialLoad) {
    return <div className="instance-list-container">Loading...</div>;
  }

  return (
    <div className="instance-list-container">
      <div className="list-header">
        <h2>Active Instances</h2>
        <button onClick={launchInstance} disabled={loading} className="launch-btn">
          <span className="btn-icon">+</span>
          {loading ? 'Launching...' : 'New Instance'}
        </button>
      </div>
      
      <div className="instances-grid">
        {instances.map(inst => (
          <div key={inst.id} className="instance-card">
            <div className="card-header">
              <div className="instance-icon">🖥️</div>
              <span className="status-badge">Running</span>
            </div>
            
            <div className="instance-details">
              <h3>Instance {inst.display}</h3>
              <div className="instance-meta">
                <span>🕒</span>
                Created: {new Date(inst.createdAt).toLocaleTimeString()}
              </div>
            </div>

            <div className="card-actions">
              <button onClick={() => onConnect(inst)} className="connect-btn">
                Connect
              </button>
              <button onClick={(e) => terminateInstance(inst.id, e)} className="terminate-btn" title="Terminate">
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {instances.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">🌌</span>
          <p>No active instances found.</p>
          <p>Launch a new one to get started.</p>
        </div>
      )}
    </div>
  );
}

export default InstanceList;

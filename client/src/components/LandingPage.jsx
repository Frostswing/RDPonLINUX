import React from 'react';
import './LandingPage.css';

const LandingPage = ({ onResume, onManage, lastSessionDate }) => {
  return (
    <div className="landing-container">
      <div className="landing-card">
        <h2>Welcome Back</h2>
        <p className="landing-subtitle">Antigravity Remote Desktop</p>
        
        <div className="landing-actions">
          {lastSessionDate && (
            <button className="btn-primary resume-btn" onClick={onResume}>
              <span className="btn-icon">↺</span>
              <div className="btn-text">
                <span className="btn-title">Resume Last Session</span>
                <span className="btn-meta">{new Date(lastSessionDate).toLocaleString()}</span>
              </div>
            </button>
          )}
          
          {lastSessionDate && (
            <div className="divider">
              <span>OR</span>
            </div>
          )}

          <button className="btn-secondary manage-btn" onClick={onManage}>
            <span className="btn-icon">☰</span>
            <span className="btn-title">Go to Management</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;

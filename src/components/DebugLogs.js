// src/components/DebugLogs.js
// Simple debug logs viewer and downloader

import React, { useState, useEffect } from 'react';
import { logger } from '../utils/fileLogger';

const DebugLogs = () => {
  const [logs, setLogs] = useState('No logs yet...');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const updateLogs = () => {
      setLogs(logger.getLogs());
    };

    updateLogs();

    // Refresh logs every 1 second
    const interval = setInterval(updateLogs, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClearLogs = () => {
    if (window.confirm('Clear all logs?')) {
      logger.clearLogs();
      setLogs('Logs cleared...');
    }
  };

  const handleDownload = () => {
    logger.downloadNow();
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      margin: '20px 0',
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={handleClearLogs} style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#ff6b6b', color: 'white', border: 'none', borderRadius: '4px' }}>
          🗑️ Clear Logs
        </button>
        <button onClick={handleDownload} style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#4ecdc4', color: 'white', border: 'none', borderRadius: '4px' }}>
          ⬇️ Download Logs
        </button>
        <span style={{ fontSize: '11px', color: '#666' }}>
          {logger.logs.length} log entries
        </span>
      </div>
      <div style={{
        backgroundColor: '#1e1e1e',
        color: '#00ff00',
        padding: '15px',
        borderRadius: '4px',
        maxHeight: '500px',
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        border: '1px solid #00ff00',
        lineHeight: '1.4'
      }}>
        {logs}
      </div>
    </div>
  );
};

export default DebugLogs;

// src/App.js
// Main application with tabbed interface

import React, { useState } from 'react';
import DebugLogs from './components/DebugLogs';
import StockMLAnalysisTab from './components/StockMLAnalysisTab';
import SenatorTransactionSearch from './components/SenatorTransactionSearch';
import RepresentativeTransactionSearch from './components/RepresentativeTransactionSearch';
import PaperTradingBotPanel from './components/PaperTradingBotPanel';

import './styles.css';
import './styles/SenatorTransactionSearch.css';
import './styles/RepresentativeTransactionSearch.css';
import './styles/PaperTradingBotPanel.css';
import './styles/MlJobQueuePanel.css';

function App() {
  const [activeMainTab, setActiveMainTab] = useState('analysis');

  return (
    <div className="app">
      {/* Debug Logs Panel */}
      <DebugLogs />

      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">
          <span className="app-icon">📈</span>
          StockAI Analytics
        </h1>
        <p className="app-subtitle">
          AI-Powered Stock Market Analysis & Real-Time Prediction Platform
        </p>
      </header>

      {/* Main Tab Navigation */}
      <div className="main-tab-navigation">
        <button
          className={activeMainTab === 'analysis' ? 'main-tab active' : 'main-tab'}
          onClick={() => setActiveMainTab('analysis')}
        >
          <span className="tab-icon">📊</span>
          Stock & ML Analysis
        </button>
        <button
          className={activeMainTab === 'senator' ? 'main-tab active' : 'main-tab'}
          onClick={() => setActiveMainTab('senator')}
        >
          <span className="tab-icon">🏛️</span>
          Senator Lookups
        </button>
        <button
          className={activeMainTab === 'representative' ? 'main-tab active' : 'main-tab'}
          onClick={() => setActiveMainTab('representative')}
        >
          <span className="tab-icon">🏛️</span>
          Representative Lookups
        </button>
        <button
          className={activeMainTab === 'bot' ? 'main-tab active' : 'main-tab'}
          onClick={() => setActiveMainTab('bot')}
        >
          <span className="tab-icon">🤖</span>
          Paper Trading Bot
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="main-tab-content">
        {activeMainTab === 'analysis' && <StockMLAnalysisTab />}
        {activeMainTab === 'senator' && <SenatorTransactionSearch />}
        {activeMainTab === 'representative' && <RepresentativeTransactionSearch />}
        {activeMainTab === 'bot' && <PaperTradingBotPanel />}
      </div>

      {/* Footer */}
      <footer className="app-footer">
        <p>Built with React, AI/ML Models & Financial APIs</p>
        <p className="disclaimer-footer">
          ⚠️ For educational purposes only. Not financial advice.
        </p>
      </footer>
    </div>
  );
}

export default App;

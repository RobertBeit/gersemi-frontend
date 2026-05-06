// src/App.js
// Main application with modern DeFi/trading platform styling

import React, { useState } from 'react';
import StockForm from './components/StockForm';
import StockChart from './components/StockChart';
import StockTable from './components/StockTable';
import StockPrediction from './components/StockPrediction'; 
import BottomPeakDetector from './components/BottomPeakDetector';
import RandomForestPrediction from './components/RandomForestPrediction';
import LongTermRandomForestPrediction from './components/LongTermRandomForestPrediction';
import { fetchStockDataFromBackend } from './services/stockDataService';
import EnsemblePrediction from './components/EnsemblePrediction';
import LongTermEnsemblePrediction from './components/LongTermEnsemblePrediction';
import LongTermLSTMPrediction from './components/LongTermLSTMPrediction';
import LongTermNaiveBayesPrediction from './components/LongTermNaiveBayesPrediction';
import LinearRegressionTester from './components/LinearRegressionTester';
import InstitutionalRegressionTester from './components/InstitutionalRegressionTester';
import XGBoostStockAnalyzer from './components/XGBoostStockAnalyzer';
import DebugLogs from './components/DebugLogs';
import SenatorTransactionSearch from './components/SenatorTransactionSearch';
import PaperTradingBotPanel from './components/PaperTradingBotPanel';
import MlJobQueuePanel from './components/MlJobQueuePanel';


import './styles.css';
import './styles/SenatorTransactionSearch.css';
import './styles/PaperTradingBotPanel.css';
import './styles/MlJobQueuePanel.css';

function App() {
  const [stockData, setStockData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [predictionFromDate, setPredictionFromDate] = useState('');
  const [activeTab, setActiveTab] = useState('chart');
  
  const handleFormSubmit = async ({ symbol, startDate, endDate }) => {
    setIsLoading(true);
    setError('');
    
    try {
      const data = await fetchStockDataFromBackend(symbol, startDate, endDate);
      setStockData(data);
      setCurrentStock(symbol.toUpperCase()); // Ensure consistent formatting
      setPredictionFromDate(startDate);
    } catch (err) {
      setError(`Error: ${err.message || 'Failed to fetch stock data'}`);
      setStockData([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

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

      <StockForm onSubmit={handleFormSubmit} isLoading={isLoading} />

      <PaperTradingBotPanel />

      <MlJobQueuePanel />

      <SenatorTransactionSearch />

      {isLoading && (
        <div className="loading glass-card">
          <div className="loading-spinner"></div>
          <p>Fetching market data...</p>
          <div className="progress-container">
            <div className="progress-bar" style={{ width: "60%" }}></div>
          </div>
          <p className="progress-text">Analyzing market trends...</p>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {stockData.length > 0 && (
        <div className="results">
          <h2>
            <span className="stock-symbol">{currentStock}</span> Analysis
            Dashboard
          </h2>

          <div className="tab-navigation">
            <button
              className={activeTab === "chart" ? "active" : ""}
              onClick={() => handleTabChange("chart")}
            >
              📊 Price Chart
            </button>
            <button
              className={activeTab === "prediction" ? "active" : ""}
              onClick={() => handleTabChange("prediction")}
            >
              🤖 Real-Time AI Prediction
            </button>
            <button
              className={activeTab === "bottomsPeaks" ? "active" : ""}
              onClick={() => handleTabChange("bottomsPeaks")}
            >
              🎯 Bottoms & Peaks
            </button>

            <button
              className={activeTab === "randomForest" ? "active" : ""}
              onClick={() => handleTabChange("randomForest")}
            >
              🌲 Random Forest AI
            </button>
            <button
              className={activeTab === "longTermRF" ? "active" : ""}
              onClick={() => handleTabChange("longTermRF")}
            >
              📅 Long-Term RF
            </button>
            <button
              className={activeTab === "table" ? "active" : ""}
              onClick={() => handleTabChange("table")}
            >
              📋 Data Table
            </button>
            <button
              className={activeTab === "ensemble" ? "active" : ""}
              onClick={() => handleTabChange("ensemble")}
            >
              🎯 Ensemble AI
            </button>
            <button
              className={activeTab === "longTermEnsemble" ? "active" : ""}
              onClick={() => handleTabChange("longTermEnsemble")}
            >
              📈 Long-Term Ensemble
            </button>
            <button
              className={activeTab === "longTermLSTM" ? "active" : ""}
              onClick={() => handleTabChange("longTermLSTM")}
            >
              🧠 Long-Term LSTM Debug
            </button>
              <button
                className={activeTab === "linearRegression" ? "active" : ""}
                onClick={() => handleTabChange("linearRegression")}
              >
                📈 Linear Regression
              </button>
               <button
                className={activeTab === "xgBoost" ? "active" : ""}
                onClick={() => handleTabChange("xgBoost")}
              >
                📈 XGBoost
              </button>
            
            {/* <button
              className={activeTab === "longTermNB" ? "active" : ""}
              onClick={() => handleTabChange("longTermNB")}
            >
              🎯 Long-Term NB Debug
            </button> */}
          </div>

          <div className="tab-content">
            {activeTab === "chart" && <StockChart data={stockData} />}

            {activeTab === "prediction" && (
              <StockPrediction
                stockData={stockData}
                symbol={currentStock}
                fromDate={predictionFromDate}
              />
            )}

            {activeTab === "bottomsPeaks" && (
              <BottomPeakDetector
                stockData={stockData}
                fromDate={predictionFromDate}
              />
            )}
            {activeTab === "randomForest" && (
              <RandomForestPrediction
                stockData={stockData}
                symbol={currentStock}
                fromDate={predictionFromDate}
              />
            )}
            {activeTab === "longTermRF" && (
              <LongTermRandomForestPrediction
                stockData={stockData}
                symbol={currentStock}
                fromDate={predictionFromDate}
              />
            )}
            {activeTab === "ensemble" && (
              <EnsemblePrediction
                stockData={stockData}
                symbol={currentStock}
                fromDate={predictionFromDate}
              />
            )}
            {activeTab === "longTermEnsemble" && (
              <LongTermEnsemblePrediction
                stockData={stockData}
                symbol={currentStock}
                fromDate={predictionFromDate}
              />
            )}

            {activeTab === "longTermLSTM" && (
              <LongTermLSTMPrediction
                stockData={stockData}
                symbol={currentStock}
                fromDate={predictionFromDate}
              />
            )}
            {activeTab === "linearRegression" && (
              <InstitutionalRegressionTester
                stockData={stockData}
                symbol={currentStock}
                fromDate={predictionFromDate}
              />
            )}
            {activeTab === "xgBoost" && (
              <XGBoostStockAnalyzer
                stockData={stockData}
                symbol={currentStock}
                fromDate={predictionFromDate}
              />
            )}
            {/* {activeTab === "longTermNB" && (
              <LongTermNaiveBayesPrediction
                stockData={stockData}
                symbol={currentStock}
                fromDate={predictionFromDate}
              />
            )} */}

            {activeTab === "table" && <StockTable data={stockData} />}
          </div>
        </div>
      )}

      {/* Real-time Status Indicator */}
      {stockData.length > 0 && (
        <div className="real-time-status">
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span className="status-text">
              Real-time predictions active for {currentStock}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <p>Built with React, AI/ML Models & Financial Modeling Prep API</p>
        <p className="disclaimer-footer">
          ⚠️ For educational purposes only. Not financial advice.
        </p>
      </footer>
    </div>
  );
}

export default App;
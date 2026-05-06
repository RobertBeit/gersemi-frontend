// src/components/RandomForestPrediction.js
// Random Forest Stock Prediction Component with Real-Time Updates

import React, { useState, useEffect, useRef } from 'react';
import { 
  trainRandomForest, 
  prepareLatestRandomForestFeatures,
  RandomForestClassifier 
} from '../services/backendPredictionJobs';
import { 
  getCurrentPriceAndVolume, 
  isMarketOpen,
  createRealTimeDataHook 
} from '../services/api';

const RandomForestPrediction = ({ stockData, symbol, fromDate }) => {
  // Model and training state
  const [model, setModel] = useState(null);
  const [modelMetrics, setModelMetrics] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [modelTrained, setModelTrained] = useState(false);
  
  // Prediction state
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [confidence, setConfidence] = useState(0);
  const [lastPredictionTime, setLastPredictionTime] = useState(null);
  
  // Real-time data state
  const [realTimeData, setRealTimeData] = useState(null);
  const [isMarketCurrentlyOpen, setIsMarketCurrentlyOpen] = useState(false);
  const [autoPredict, setAutoPredict] = useState(false);
  
  // Component state
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Model parameters
  const [modelParams, setModelParams] = useState({
    nTrees: 50,
    maxDepth: 10,
    lookbackDays: 5,
    testSplit: 0.2
  });
  
  // Refs for real-time updates
  const realTimeDataRef = useRef(null);
  const predictionIntervalRef = useRef(null);

  // Initialize real-time data manager
  useEffect(() => {
    if (symbol) {
      const { manager, startUpdates, subscribe, isMarketOpen: checkMarketOpen } = createRealTimeDataHook(symbol);
      realTimeDataRef.current = { manager, startUpdates };
      
      // Check if market is open
      setIsMarketCurrentlyOpen(checkMarketOpen());
      
      // Subscribe to real-time updates
      const unsubscribe = subscribe((data) => {
        setRealTimeData(data);
        
        // Auto-predict if enabled and model is trained
        if (autoPredict && modelTrained && model) {
          handleRealTimePrediction(data);
        }
      });
      
      return () => {
        unsubscribe();
        if (realTimeDataRef.current) {
          realTimeDataRef.current.manager.stopRealTimeUpdates();
        }
        if (predictionIntervalRef.current) {
          clearInterval(predictionIntervalRef.current);
        }
      };
    }
  }, [symbol, autoPredict, modelTrained, model]);

  // Train Random Forest model
  const handleTrainModel = async () => {
    if (!stockData || stockData.length < modelParams.lookbackDays + 10) {
      setError('Insufficient data for training. Need at least 15 days of stock data.');
      return;
    }

    setIsTraining(true);
    setError('');
    setTrainingProgress(0);

    try {
      // Simulate training progress
      const progressInterval = setInterval(() => {
        setTrainingProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      console.log('Training Random Forest model...');
      const result = await trainRandomForest(
        stockData, 
        modelParams.lookbackDays, 
        modelParams.nTrees, 
        modelParams.testSplit
      );

      clearInterval(progressInterval);
      setTrainingProgress(100);

      setModel(result.model);
      setModelMetrics(result.metrics);
      setModelTrained(true);
      
      console.log('Model trained successfully:', result.metrics);

      // Auto-predict current state
      if (stockData.length >= modelParams.lookbackDays) {
        await handleCurrentPrediction(result.model);
      }

    } catch (err) {
      console.error('Training error:', err);
      setError(`Training failed: ${err.message}`);
    } finally {
      setIsTraining(false);
      setTimeout(() => setTrainingProgress(0), 2000);
    }
  };

  // Make prediction with current data
  const handleCurrentPrediction = async (trainedModel = null) => {
    const modelToUse = trainedModel || model;
    
    if (!modelToUse || !stockData || stockData.length < modelParams.lookbackDays) {
      setError('Model not trained or insufficient data for prediction');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Prepare features from latest stock data
      const features = prepareLatestRandomForestFeatures(stockData, modelParams.lookbackDays);
      
      // Get prediction probabilities
      const probabilities = await modelToUse.predictProba([features]);
      const prediction = probabilities[0][1] > probabilities[0][0] ? 1 : 0;
      const confidenceScore = Math.max(probabilities[0][0], probabilities[0][1]);

      const predictionResult = {
        prediction: prediction === 1 ? 'UP' : 'DOWN',
        confidence: confidenceScore,
        probability_up: probabilities[0][1],
        probability_down: probabilities[0][0],
        timestamp: new Date(),
        currentPrice: realTimeData?.currentPrice || stockData[stockData.length - 1].close,
        features: features.length
      };

      setCurrentPrediction(predictionResult);
      setConfidence(confidenceScore);
      setLastPredictionTime(new Date());

      // Add to prediction history
      setPredictionHistory(prev => [
        predictionResult,
        ...prev.slice(0, 9) // Keep last 10 predictions
      ]);

    } catch (err) {
      console.error('Prediction error:', err);
      setError(`Prediction failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle real-time prediction updates
  const handleRealTimePrediction = async (data) => {
    if (!model || !data.currentPrice) return;

    try {
      // Create synthetic current data point for feature calculation
      const latestData = [...stockData];
      const lastDataPoint = latestData[latestData.length - 1];
      
      // Add current real-time data as latest point
      const currentDataPoint = {
        ...lastDataPoint,
        close: data.currentPrice,
        volume: data.currentVolume || lastDataPoint.volume,
        date: new Date().toISOString().split('T')[0]
      };
      
      latestData.push(currentDataPoint);
      
      // Prepare features with real-time data
      const features = prepareLatestRandomForestFeatures(latestData, modelParams.lookbackDays);
      
      // Get prediction
      const probabilities = await model.predictProba([features]);
      const prediction = probabilities[0][1] > probabilities[0][0] ? 1 : 0;
      const confidenceScore = Math.max(probabilities[0][0], probabilities[0][1]);

      const predictionResult = {
        prediction: prediction === 1 ? 'UP' : 'DOWN',
        confidence: confidenceScore,
        probability_up: probabilities[0][1],
        probability_down: probabilities[0][0],
        timestamp: new Date(),
        currentPrice: data.currentPrice,
        features: features.length,
        isRealTime: true
      };

      setCurrentPrediction(predictionResult);
      setConfidence(confidenceScore);
      setLastPredictionTime(new Date());

    } catch (err) {
      console.error('Real-time prediction error:', err);
    }
  };

  // Start/stop real-time updates
  const toggleRealTimeUpdates = () => {
    if (autoPredict) {
      // Stop updates
      setAutoPredict(false);
      if (realTimeDataRef.current) {
        realTimeDataRef.current.manager.stopRealTimeUpdates();
      }
    } else {
      // Start updates
      if (!modelTrained) {
        setError('Please train the model first before enabling real-time predictions');
        return;
      }
      
      setAutoPredict(true);
      if (realTimeDataRef.current) {
        realTimeDataRef.current.startUpdates(1); // Update every minute
      }
    }
  };

  // Format time ago
  const timeAgo = (date) => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="random-forest-prediction">
      {/* Header */}
      <div className="prediction-header glass-card">
        <h3>🌲 Random Forest AI Prediction</h3>
        <p>Advanced ensemble learning for stock market prediction</p>
        
        {/* Model Status */}
        <div className="model-status">
          <div className={`status-indicator ${modelTrained ? 'trained' : 'untrained'}`}>
            <span className="status-dot"></span>
            {modelTrained ? `Model Trained (${modelParams.nTrees} trees)` : 'Model Not Trained'}
          </div>
          
          {isMarketCurrentlyOpen && (
            <div className="market-status">
              <span className="market-open-dot"></span>
              Market Open
            </div>
          )}
        </div>
      </div>

      {/* Training Section */}
      <div className="training-section glass-card">
        <h4>🎯 Model Training</h4>
        
        {/* Model Parameters */}
        <div className={`model-params ${showAdvanced ? 'expanded' : ''}`}>
          <button 
            className="toggle-advanced"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Parameters
          </button>
          
          {showAdvanced && (
            <div className="params-grid">
              <div className="param-group">
                <label>Number of Trees:</label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={modelParams.nTrees}
                  onChange={(e) => setModelParams(prev => ({
                    ...prev,
                    nTrees: parseInt(e.target.value)
                  }))}
                  disabled={isTraining}
                />
              </div>
              
              <div className="param-group">
                <label>Max Depth:</label>
                <input
                  type="number"
                  min="3"
                  max="20"
                  value={modelParams.maxDepth}
                  onChange={(e) => setModelParams(prev => ({
                    ...prev,
                    maxDepth: parseInt(e.target.value)
                  }))}
                  disabled={isTraining}
                />
              </div>
              
              <div className="param-group">
                <label>Lookback Days:</label>
                <input
                  type="number"
                  min="3"
                  max="15"
                  value={modelParams.lookbackDays}
                  onChange={(e) => setModelParams(prev => ({
                    ...prev,
                    lookbackDays: parseInt(e.target.value)
                  }))}
                  disabled={isTraining}
                />
              </div>
              
              <div className="param-group">
                <label>Test Split:</label>
                <input
                  type="number"
                  min="0.1"
                  max="0.5"
                  step="0.05"
                  value={modelParams.testSplit}
                  onChange={(e) => setModelParams(prev => ({
                    ...prev,
                    testSplit: parseFloat(e.target.value)
                  }))}
                  disabled={isTraining}
                />
              </div>
            </div>
          )}
        </div>

        <button 
          className={`train-button ${isTraining ? 'training' : ''}`}
          onClick={handleTrainModel}
          disabled={isTraining || !stockData || stockData.length < 15}
        >
          {isTraining ? (
            <>
              <div className="spinner"></div>
              Training... {trainingProgress}%
            </>
          ) : (
            '🚀 Train Random Forest Model'
          )}
        </button>

        {isTraining && (
          <div className="training-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${trainingProgress}%` }}
              ></div>
            </div>
            <p>Building decision trees and calculating feature importance...</p>
          </div>
        )}

        {/* Model Metrics */}
        {modelMetrics && (
          <div className="model-metrics">
            <h5>📊 Model Performance</h5>
            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-label">Accuracy:</span>
                <span className="metric-value">{(modelMetrics.accuracy * 100).toFixed(1)}%</span>
              </div>
              <div className="metric">
                <span className="metric-label">Precision:</span>
                <span className="metric-value">{(modelMetrics.precision * 100).toFixed(1)}%</span>
              </div>
              <div className="metric">
                <span className="metric-label">Recall:</span>
                <span className="metric-value">{(modelMetrics.recall * 100).toFixed(1)}%</span>
              </div>
              <div className="metric">
                <span className="metric-label">F1 Score:</span>
                <span className="metric-value">{(modelMetrics.f1 * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prediction Section */}
      {modelTrained && (
        <div className="prediction-section glass-card">
          <div className="prediction-header-controls">
            <h4>🔮 Current Prediction</h4>
            
            <div className="controls">
              <button 
                className="predict-button"
                onClick={() => handleCurrentPrediction()}
                disabled={isLoading}
              >
                {isLoading ? 'Predicting...' : '🎯 Predict Now'}
              </button>
              
              <button 
                className={`real-time-toggle ${autoPredict ? 'active' : ''}`}
                onClick={toggleRealTimeUpdates}
                disabled={!isMarketCurrentlyOpen}
              >
                {autoPredict ? '⏹️ Stop' : '▶️ Start'} Real-Time
              </button>
            </div>
          </div>

          {/* Current Prediction Display */}
          {currentPrediction && (
            <div className="current-prediction">
              <div className={`prediction-result ${currentPrediction.prediction.toLowerCase()}`}>
                <div className="prediction-main">
                  <span className="prediction-direction">
                    {currentPrediction.prediction === 'UP' ? '📈' : '📉'} 
                    {currentPrediction.prediction}
                  </span>
                  <span className="prediction-confidence">
                    {(currentPrediction.confidence * 100).toFixed(1)}% confidence
                  </span>
                </div>
                
                <div className="prediction-details">
                  <div className="detail">
                    <span>Current Price:</span>
                    <span>${currentPrediction.currentPrice?.toFixed(2) || 'N/A'}</span>
                  </div>
                  <div className="detail">
                    <span>Probability UP:</span>
                    <span>{(currentPrediction.probability_up * 100).toFixed(1)}%</span>
                  </div>
                  <div className="detail">
                    <span>Probability DOWN:</span>
                    <span>{(currentPrediction.probability_down * 100).toFixed(1)}%</span>
                  </div>
                  <div className="detail">
                    <span>Last Updated:</span>
                    <span>{timeAgo(lastPredictionTime)}</span>
                  </div>
                </div>
              </div>

              {/* Confidence Bar */}
              <div className="confidence-bar">
                <div className="confidence-label">Confidence Level</div>
                <div className="confidence-meter">
                  <div 
                    className={`confidence-fill ${currentPrediction.prediction.toLowerCase()}`}
                    style={{ width: `${confidence * 100}%` }}
                  ></div>
                </div>
                <div className="confidence-text">{(confidence * 100).toFixed(1)}%</div>
              </div>
            </div>
          )}

          {/* Real-time Data Display */}
          {realTimeData && autoPredict && (
            <div className="real-time-data">
              <h5>📡 Live Market Data</h5>
              <div className="real-time-grid">
                <div className="real-time-item">
                  <span>Current Price:</span>
                  <span>${realTimeData.currentPrice?.toFixed(2)}</span>
                </div>
                <div className="real-time-item">
                  <span>Volume:</span>
                  <span>{realTimeData.currentVolume?.toLocaleString()}</span>
                </div>
                <div className="real-time-item">
                  <span>Last Update:</span>
                  <span>{timeAgo(realTimeData.timestamp)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Prediction History */}
      {predictionHistory.length > 0 && (
        <div className="prediction-history glass-card">
          <h4>📈 Prediction History</h4>
          <div className="history-list">
            {predictionHistory.map((pred, index) => (
              <div key={index} className={`history-item ${pred.prediction.toLowerCase()}`}>
                <div className="history-prediction">
                  <span className="history-direction">
                    {pred.prediction === 'UP' ? '📈' : '📉'} {pred.prediction}
                  </span>
                  <span className="history-confidence">
                    {(pred.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="history-details">
                  <span>${pred.currentPrice?.toFixed(2)}</span>
                  <span>{timeAgo(pred.timestamp)}</span>
                  {pred.isRealTime && <span className="real-time-badge">LIVE</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* Info Panel */}
      <div className="info-panel glass-card">
        <h5>ℹ️ About Random Forest Prediction</h5>
        <ul>
          <li>Uses ensemble of {modelParams.nTrees} decision trees for robust predictions</li>
          <li>Analyzes {modelParams.lookbackDays} days of price momentum, volatility, and volume patterns</li>
          <li>Predicts next-day price direction (UP/DOWN) with confidence score</li>
          <li>Real-time updates during market hours for live prediction</li>
          <li>Higher accuracy than single decision trees through bootstrap aggregation</li>
        </ul>
        
        <div className="disclaimer">
          <strong>⚠️ Disclaimer:</strong> This is for educational purposes only. 
          Not financial advice. Past performance doesn't guarantee future results.
        </div>
      </div>
    </div>
  );
};

export default RandomForestPrediction;
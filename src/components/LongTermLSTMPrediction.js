// src/components/LongTermLSTMPrediction.js
// Standalone Long-Term LSTM Prediction Component for Debugging

import React, { useState, useEffect } from 'react';
import { 
  trainLongTermLSTM, 
  predictLongTermWithConfidence,
  normalizeNewLongTermFeatures,
  evaluateLongTermLSTM
} from '../services/backendPredictionJobs';
import { extractTechnicalFeatures } from '../services/technicalIndicators';

const LongTermLSTMPrediction = ({ stockData, symbol, fromDate }) => {
  // Model state
  const [model, setModel] = useState(null);
  const [modelData, setModelData] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [modelTrained, setModelTrained] = useState(false);
  
  // Results state
  const [trainingResults, setTrainingResults] = useState(null);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  
  // Component state
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(true);
  
  // Model parameters
  const [modelParams, setModelParams] = useState({
    sequenceLength: 20,
    targetDaysAhead: 5,
    epochs: 20,
    batchSize: 64
  });

  // Train LSTM model
  const handleTrainModel = async () => {
    const requiredDataPoints = modelParams.sequenceLength + modelParams.targetDaysAhead + 252;
    
    if (!stockData || stockData.length < requiredDataPoints) {
      setError(`Insufficient data for LSTM training. Need at least ${requiredDataPoints} days of stock data.`);
      return;
    }

    setIsTraining(true);
    setError('');
    setTrainingProgress(0);

    try {
      console.log('🧠 Starting Long-Term LSTM Training...');
      
      // Add progress tracking
      const progressCallback = (epoch, logs) => {
        const progress = Math.floor(((epoch + 1) / modelParams.epochs) * 100);
        setTrainingProgress(progress);
      };

      const result = await trainLongTermLSTM(
        stockData,
        modelParams.sequenceLength,
        modelParams.targetDaysAhead,
        modelParams.epochs,
        modelParams.batchSize
      );

      setModel(result.model);
      setModelData({
        normParams: result.normParams,
        sequenceLength: result.sequenceLength,
        targetDaysAhead: result.targetDaysAhead,
        inputDim: result.inputDim
      });
      setTrainingResults(result);
      setModelTrained(true);

      // Add debug information
      const formattedData = {
        close: stockData.map(d => d.close),
        high: stockData.map(d => d.high),
        low: stockData.map(d => d.low),
        volume: stockData.map(d => d.volume),
        dates: stockData.map(d => d.date)
      };
      
      const technicalFeatures = extractTechnicalFeatures(formattedData);
      
      setDebugInfo({
        totalStockData: stockData.length,
        technicalFeatures: technicalFeatures.length,
        priceRange: {
          min: Math.min(...stockData.map(d => d.close)),
          max: Math.max(...stockData.map(d => d.close)),
          current: stockData[stockData.length - 1].close
        },
        normParams: result.normParams,
        finalLoss: result.history.loss[result.history.loss.length - 1],
        finalValLoss: result.history.val_loss[result.history.val_loss.length - 1],
        finalMAE: result.history.mae[result.history.mae.length - 1],
        finalValMAE: result.history.val_mae[result.history.val_mae.length - 1]
      });

      console.log('✅ LSTM training completed:', result);

      // Auto-predict current state
      await handleMakePrediction(result.model, modelData || {
        normParams: result.normParams,
        sequenceLength: result.sequenceLength,
        targetDaysAhead: result.targetDaysAhead
      });

    } catch (err) {
      console.error('❌ LSTM training failed:', err);
      setError(`LSTM training failed: ${err.message}`);
    } finally {
      setIsTraining(false);
      setTrainingProgress(0);
    }
  };

  // Make LSTM prediction
  const handleMakePrediction = async (trainedModel = null, trainedModelData = null) => {
    const modelToUse = trainedModel || model;
    const modelDataToUse = trainedModelData || modelData;
    
    if (!modelToUse || !modelDataToUse) {
      setError('LSTM model not trained yet');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('🔮 Making LSTM prediction...');
      
      const formattedData = {
        close: stockData.map(d => d.close),
        high: stockData.map(d => d.high),
        low: stockData.map(d => d.low),
        volume: stockData.map(d => d.volume),
        dates: stockData.map(d => d.date)
      };
      
      const technicalFeatures = extractTechnicalFeatures(formattedData);
      
      const predictions = await predictLongTermWithConfidence(
        modelToUse,
        technicalFeatures,
        modelDataToUse.normParams,
        modelDataToUse.sequenceLength,
        modelDataToUse.targetDaysAhead,
        10 // MC samples
      );

      if (predictions.length > 0) {
        const prediction = predictions[0];
        
        const enhancedPrediction = {
          ...prediction,
          symbol: symbol,
          predictionId: Date.now(),
          rawPrediction: prediction.predictedPrice,
          logPrediction: Math.log(prediction.predictedPrice),
          currentLogPrice: Math.log(prediction.currentPrice)
        };

        setCurrentPrediction(enhancedPrediction);
        console.log('📊 LSTM prediction result:', enhancedPrediction);
      }

    } catch (err) {
      console.error('❌ LSTM prediction failed:', err);
      setError(`LSTM prediction failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="long-term-lstm-prediction">
      {/* Header */}
      <div className="prediction-header glass-card">
        <h3>🧠 Long-Term LSTM Debug</h3>
        <p>Standalone LSTM model for debugging price prediction issues</p>
        
        <div className="model-status">
          <div className={`status-indicator ${modelTrained ? 'trained' : 'untrained'}`}>
            <span className="status-dot"></span>
            {modelTrained ? 
              `LSTM Trained (${modelParams.sequenceLength} seq, ${modelParams.targetDaysAhead} days ahead)` : 
              'LSTM Not Trained'
            }
          </div>
        </div>
      </div>

      {/* Debug Information */}
      {debugInfo && (
        <div className="debug-info glass-card">
          <div className="debug-header">
            <h4>🔍 Debug Information</h4>
            <button 
              className="toggle-debug"
              onClick={() => setShowDebugInfo(!showDebugInfo)}
            >
              {showDebugInfo ? 'Hide' : 'Show'} Debug Details
            </button>
          </div>
          
          {showDebugInfo && (
            <div className="debug-details">
              <div className="debug-section">
                <h5>Data Information</h5>
                <div className="debug-grid">
                  <div className="debug-item">
                    <span>Total Stock Data:</span>
                    <span>{debugInfo.totalStockData} days</span>
                  </div>
                  <div className="debug-item">
                    <span>Technical Features:</span>
                    <span>{debugInfo.technicalFeatures} samples</span>
                  </div>
                  <div className="debug-item">
                    <span>Price Range:</span>
                    <span>{formatCurrency(debugInfo.priceRange.min)} - {formatCurrency(debugInfo.priceRange.max)}</span>
                  </div>
                  <div className="debug-item">
                    <span>Current Price:</span>
                    <span>{formatCurrency(debugInfo.priceRange.current)}</span>
                  </div>
                </div>
              </div>

              <div className="debug-section">
                <h5>Training Metrics</h5>
                <div className="debug-grid">
                  <div className="debug-item">
                    <span>Final Loss:</span>
                    <span>{debugInfo.finalLoss?.toFixed(6) || 'N/A'}</span>
                  </div>
                  <div className="debug-item">
                    <span>Final Val Loss:</span>
                    <span>{debugInfo.finalValLoss?.toFixed(6) || 'N/A'}</span>
                  </div>
                  <div className="debug-item">
                    <span>Final MAE:</span>
                    <span>{debugInfo.finalMAE?.toFixed(6) || 'N/A'}</span>
                  </div>
                  <div className="debug-item">
                    <span>Final Val MAE:</span>
                    <span>{debugInfo.finalValMAE?.toFixed(6) || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="debug-section">
                <h5>Normalization Parameters</h5>
                <div className="norm-params">
                  {debugInfo.normParams && Object.entries(debugInfo.normParams).slice(0, 5).map(([key, params]) => (
                    <div key={key} className="norm-param">
                      <span className="param-name">{key}:</span>
                      <span className="param-values">
                        min: {params.min?.toFixed(4)}, max: {params.max?.toFixed(4)}, 
                        mean: {params.mean?.toFixed(4)}, std: {params.std?.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Training Section */}
      <div className="training-section glass-card">
        <h4>🚀 LSTM Training</h4>
        
        <div className="model-params">
          <div className="param-grid">
            <div className="param-group">
              <label>Sequence Length:</label>
              <input
                type="number"
                min="10"
                max="60"
                value={modelParams.sequenceLength}
                onChange={(e) => setModelParams(prev => ({
                  ...prev,
                  sequenceLength: parseInt(e.target.value)
                }))}
                disabled={isTraining}
              />
            </div>
            
            <div className="param-group">
              <label>Target Days Ahead:</label>
              <input
                type="number"
                min="1"
                max="30"
                value={modelParams.targetDaysAhead}
                onChange={(e) => setModelParams(prev => ({
                  ...prev,
                  targetDaysAhead: parseInt(e.target.value)
                }))}
                disabled={isTraining}
              />
            </div>
            
            <div className="param-group">
              <label>Epochs:</label>
              <input
                type="number"
                min="5"
                max="50"
                value={modelParams.epochs}
                onChange={(e) => setModelParams(prev => ({
                  ...prev,
                  epochs: parseInt(e.target.value)
                }))}
                disabled={isTraining}
              />
            </div>
            
            <div className="param-group">
              <label>Batch Size:</label>
              <input
                type="number"
                min="16"
                max="128"
                step="16"
                value={modelParams.batchSize}
                onChange={(e) => setModelParams(prev => ({
                  ...prev,
                  batchSize: parseInt(e.target.value)
                }))}
                disabled={isTraining}
              />
            </div>
          </div>
        </div>

        <button 
          className={`train-button ${isTraining ? 'training' : ''}`}
          onClick={handleTrainModel}
          disabled={isTraining || !stockData || stockData.length < 300}
        >
          {isTraining ? (
            <>
              <div className="spinner"></div>
              Training... {trainingProgress}%
            </>
          ) : (
            '🧠 Train LSTM Model'
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
            <p>Training LSTM neural network...</p>
          </div>
        )}
      </div>

      {/* Prediction Section */}
      {modelTrained && (
        <div className="prediction-section glass-card">
          <div className="prediction-header-controls">
            <h4>🔮 LSTM Price Prediction</h4>
            
            <button 
              className="predict-button"
              onClick={() => handleMakePrediction()}
              disabled={isLoading}
            >
              {isLoading ? 'Predicting...' : '🎯 Make Prediction'}
            </button>
          </div>

          {/* Current Prediction Display */}
          {currentPrediction && (
            <div className="lstm-prediction-display">
              <div className="prediction-main">
                <div className="price-info">
                  <div className="current-price">
                    <span className="label">Current Price:</span>
                    <span className="value">{formatCurrency(currentPrediction.currentPrice)}</span>
                  </div>
                  
                  <div className="predicted-price">
                    <span className="label">Predicted Price ({currentPrediction.daysAhead} days):</span>
                    <span className={`value ${currentPrediction.predictedReturn >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(currentPrediction.predictedPrice)}
                    </span>
                  </div>
                  
                  <div className="expected-return">
                    <span className="label">Expected Return:</span>
                    <span className={`value ${currentPrediction.predictedReturn >= 0 ? 'positive' : 'negative'}`}>
                      {formatPercent(currentPrediction.predictedReturn)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Confidence Information */}
              <div className="confidence-section">
                <h5>📊 Prediction Confidence</h5>
                <div className="confidence-details">
                  <div className="confidence-item">
                    <span>Model Confidence:</span>
                    <span>{(currentPrediction.confidence * 100).toFixed(1)}%</span>
                  </div>
                  
                  <div className="confidence-item">
                    <span>Price Range (95%):</span>
                    <span>
                      {formatCurrency(currentPrediction.confidenceInterval[0])} - 
                      {formatCurrency(currentPrediction.confidenceInterval[1])}
                    </span>
                  </div>
                  
                  <div className="confidence-item">
                    <span>Standard Deviation:</span>
                    <span>{formatCurrency(currentPrediction.stdDev)}</span>
                  </div>
                  
                  <div className="confidence-item">
                    <span>MC Samples:</span>
                    <span>{currentPrediction.mcSamples}</span>
                  </div>
                </div>
              </div>

              {/* Raw Debug Data */}
              <div className="prediction-debug">
                <h5>🔧 Raw Prediction Data</h5>
                <div className="debug-values">
                  <div className="debug-value">
                    <span>Log Current Price:</span>
                    <span>{currentPrediction.currentLogPrice?.toFixed(6)}</span>
                  </div>
                  <div className="debug-value">
                    <span>Log Predicted Price:</span>
                    <span>{currentPrediction.logPrediction?.toFixed(6)}</span>
                  </div>
                  <div className="debug-value">
                    <span>Raw Prediction:</span>
                    <span>{currentPrediction.rawPrediction?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Training Results */}
      {trainingResults && (
        <div className="training-results glass-card">
          <h4>📈 Training History</h4>
          <div className="training-metrics">
            <div className="metric-item">
              <span>Final Training Loss:</span>
              <span>{trainingResults.history.loss[trainingResults.history.loss.length - 1]?.toFixed(6)}</span>
            </div>
            <div className="metric-item">
              <span>Final Validation Loss:</span>
              <span>{trainingResults.history.val_loss[trainingResults.history.val_loss.length - 1]?.toFixed(6)}</span>
            </div>
            <div className="metric-item">
              <span>Final Training MAE:</span>
              <span>{trainingResults.history.mae[trainingResults.history.mae.length - 1]?.toFixed(6)}</span>
            </div>
            <div className="metric-item">
              <span>Final Validation MAE:</span>
              <span>{trainingResults.history.val_mae[trainingResults.history.val_mae.length - 1]?.toFixed(6)}</span>
            </div>
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
        <h5>ℹ️ LSTM Debug Information</h5>
        <ul>
          <li>This component trains LSTM in isolation for debugging</li>
          <li>Watch the training metrics - loss should decrease over epochs</li>
          <li>Check if predictions are reasonable compared to current price</li>
          <li>Log normalization is used for price data stability</li>
          <li>Monte Carlo dropout provides uncertainty estimation</li>
        </ul>
        
        <div className="disclaimer">
          <strong>🔧 Debug Mode:</strong> Use this component to identify LSTM training issues 
          and validate model behavior before using in ensemble.
        </div>
      </div>
    </div>
  );
};

export default LongTermLSTMPrediction;
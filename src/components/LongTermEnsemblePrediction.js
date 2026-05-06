// Fixed Long-Term Ensemble Component - Proper metrics for RF + LSTM
// src/components/LongTermEnsemblePrediction.js

import React, { useState, useEffect } from 'react';
import { 
  trainLongTermEnsembleModel, 
  predictWithLongTermEnsemble,
  createLongTermEnsemblePredictor 
} from '../services/backendPredictionJobs';

const LongTermEnsemblePrediction = ({ stockData, symbol, fromDate }) => {
  // Ensemble state
  const [ensemble, setEnsemble] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingMessage, setTrainingMessage] = useState('');
  const [ensembleTrained, setEnsembleTrained] = useState(false);
  
  // Results state
  const [trainingResults, setTrainingResults] = useState(null);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  
  // Component state
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showIndividualResults, setShowIndividualResults] = useState(false);
  const [showModelBreakdown, setShowModelBreakdown] = useState(false);
  
  // Enhanced configuration
  const [ensembleConfig, setEnsembleConfig] = useState({
    lookbackDays: 30,
    targetDaysAhead: 5,
    randomForestWeight: 0.4, // Start with LSTM-favored weighting
    lstmWeight: 0.6,
    minConfidenceThreshold: 0.6,
    rfTrees: 100,
    lstmSequenceLength: 40,
    lstmEpochs: 50
  });

  // Predefined timeframe options
  const timeframeOptions = [
    { label: '5 Days (1 Week)', days: 5, description: 'Short-term swing trading' },
    { label: '10 Days (2 Weeks)', days: 10, description: 'Medium-term positioning' },
    { label: '22 Days (1 Month)', days: 22, description: 'Monthly investment strategy' },
    { label: '45 Days (2 Months)', days: 45, description: 'Quarterly planning' },
    { label: '65 Days (3 Months)', days: 65, description: 'Long-term investment' }
  ];

  // Train the enhanced ensemble
  const handleTrainEnsemble = async () => {
    const requiredDataPoints = Math.max(ensembleConfig.lookbackDays + ensembleConfig.targetDaysAhead + 252, 400);
    
    if (!stockData || stockData.length < requiredDataPoints) {
      setError(`Insufficient data for ensemble training. Need at least ${requiredDataPoints} days of stock data.`);
      return;
    }

    setIsTraining(true);
    setError('');
    setTrainingProgress(0);
    setTrainingMessage('Initializing enhanced RF(Classification) + LSTM(Regression) ensemble...');

    try {
      const progressCallback = (progress, message) => {
        setTrainingProgress(progress);
        setTrainingMessage(message);
      };

      console.log('🎯 Starting Enhanced Long-Term Ensemble Training...');
      const result = await trainLongTermEnsembleModel(stockData, ensembleConfig, progressCallback);

      setEnsemble(result.ensemble);
      setTrainingResults(result.trainingResult);
      setEnsembleTrained(true);
      
      console.log('✅ Enhanced ensemble training completed:', result.trainingResult);

      // Auto-predict current state
      if (result.ensemble.trained) {
        await handleMakePrediction(result.ensemble);
      }

    } catch (err) {
      console.error('❌ Enhanced ensemble training failed:', err);
      setError(`Ensemble training failed: ${err.message}`);
    } finally {
      setIsTraining(false);
      setTimeout(() => {
        setTrainingProgress(0);
        setTrainingMessage('');
      }, 3000);
    }
  };

  // Make ensemble prediction
  const handleMakePrediction = async (trainedEnsemble = null) => {
    const ensembleToUse = trainedEnsemble || ensemble;
    
    if (!ensembleToUse || !ensembleToUse.trained) {
      setError('Enhanced ensemble not trained yet');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('🔮 Making enhanced ensemble prediction...');
      const prediction = await predictWithLongTermEnsemble(ensembleToUse, stockData);
      
      console.log('📊 Enhanced ensemble prediction result:', prediction);

      const ensembleStatus = await ensembleToUse.getEnsembleStatus();
      const enhancedPrediction = {
        ...prediction,
        symbol: symbol,
        predictionId: Date.now(),
        ensembleStatus
      };

      setCurrentPrediction(enhancedPrediction);

      // Add to prediction history
      setPredictionHistory(prev => [
        enhancedPrediction,
        ...prev.slice(0, 9) // Keep last 10 predictions
      ]);

    } catch (err) {
      console.error('❌ Enhanced ensemble prediction failed:', err);
      setError(`Prediction failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Update prediction timeframe
  const handleTimeframeChange = async (newDays) => {
    if (newDays === ensembleConfig.targetDaysAhead) return;
    
    setEnsembleConfig(prev => ({
      ...prev,
      targetDaysAhead: newDays
    }));

    if (ensemble && ensemble.trained) {
      ensemble.updatePredictionHorizon(newDays);
      setEnsembleTrained(false);
      setCurrentPrediction(null);
      
      setError(`Prediction horizon changed to ${newDays} days. Please retrain for accurate predictions.`);
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
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Time ago helper
  const timeAgo = (date) => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Enhanced model status evaluation
  const getModelStatusColor = (modelResults) => {
    if (!modelResults || modelResults.error) return 'red';
    
    if (modelResults.modelType === 'classifier') {
      // Random Forest classifier - use accuracy
      const accuracy = modelResults.accuracy || 0;
      if (accuracy > 0.6) return 'green';
      if (accuracy > 0.4) return 'orange';
      return 'red';
    } else if (modelResults.modelType === 'regressor') {
      // LSTM regressor - use MAE (lower is better)
      const mae = modelResults.mae || 1;
      if (mae < 0.05) return 'green';
      if (mae < 0.1) return 'orange';
      return 'red';
    }
    
    return 'gray';
  };

  // Enhanced model performance display
  const getModelPerformanceText = (modelResults, modelName) => {
    if (!modelResults || modelResults.error) return 'Failed';
    
    if (modelName === 'randomForest') {
      const accuracy = (modelResults.accuracy * 100).toFixed(1);
      const f1 = modelResults.f1Score ? (modelResults.f1Score * 100).toFixed(1) : 'N/A';
      return `Accuracy: ${accuracy}%, F1: ${f1}%`;
    } else if (modelName === 'lstm') {
      const mae = modelResults.mae ? modelResults.mae.toFixed(4) : 'N/A';
      const accuracy = modelResults.accuracy ? (modelResults.accuracy * 100).toFixed(1) : 'N/A';
      return `MAE: ${mae}, Score: ${accuracy}%`;
    }
    
    return 'Unknown';
  };

  return (
    <div className="long-term-ensemble-prediction">
      {/* Enhanced Header */}
      <div className="prediction-header glass-card">
        <h3>🎯 Enhanced Long-Term Ensemble</h3>
        <p>RF Classification + LSTM Regression fusion for robust price forecasting</p>
        
        {/* Enhanced Status */}
        <div className="ensemble-status">
          <div className={`status-indicator ${ensembleTrained ? 'trained' : 'untrained'}`}>
            <span className="status-dot"></span>
            {ensembleTrained ? 
              `Enhanced Ensemble Trained (${trainingResults?.totalModels || 0}/2 models, ${ensembleConfig.targetDaysAhead} days ahead)` : 
              'Enhanced Ensemble Not Trained'
            }
          </div>
          
          {trainingResults && (
            <div className="ensemble-summary">
              <span>Avg Performance: {(trainingResults.ensembleMetrics.averageAccuracy * 100).toFixed(1)}%</span>
              <span>Models: RF(Class) + LSTM(Reg)</span>
              <span>Horizon: {trainingResults.predictionHorizon} days</span>
              <span>Weights: RF({(trainingResults.optimalWeights.randomForest * 100).toFixed(0)}%) 
                LSTM({(trainingResults.optimalWeights.lstm * 100).toFixed(0)}%)</span>
            </div>
          )}
        </div>
      </div>

      {/* Timeframe Selection */}
      <div className="timeframe-section glass-card">
        <h4>📅 Prediction Timeframe</h4>
        <div className="timeframe-options">
          {timeframeOptions.map((option) => (
            <button
              key={option.days}
              className={`timeframe-option ${ensembleConfig.targetDaysAhead === option.days ? 'active' : ''}`}
              onClick={() => handleTimeframeChange(option.days)}
              disabled={isTraining}
            >
              <div className="timeframe-label">{option.label}</div>
              <div className="timeframe-description">{option.description}</div>
            </button>
          ))}
        </div>
        
        <div className="custom-timeframe">
          <label>Custom timeframe (days):</label>
          <input
            type="number"
            min="1"
            max="90"
            value={ensembleConfig.targetDaysAhead}
            onChange={(e) => handleTimeframeChange(parseInt(e.target.value))}
            disabled={isTraining}
          />
        </div>
      </div>

      {/* Enhanced Training Section */}
      <div className="training-section glass-card">
        <h4>🚀 Enhanced Ensemble Training</h4>
        
        {/* Configuration */}
        <div className={`ensemble-config ${showAdvanced ? 'expanded' : ''}`}>
          <button 
            className="toggle-advanced"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Configuration
          </button>
          
          {showAdvanced && (
            <div className="config-sections">
              {/* Enhanced Model Weights */}
              <div className="config-section">
                <h5>Model Weights (RF Classifier + LSTM Regressor)</h5>
                <div className="weight-controls">
                  <div className="weight-control">
                    <label>RF Classifier: {(ensembleConfig.randomForestWeight * 100).toFixed(0)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={ensembleConfig.randomForestWeight}
                      onChange={(e) => {
                        const rfWeight = parseFloat(e.target.value);
                        setEnsembleConfig(prev => ({
                          ...prev,
                          randomForestWeight: rfWeight,
                          lstmWeight: 1 - rfWeight
                        }));
                      }}
                      disabled={isTraining}
                    />
                    <span className="weight-hint">Categories → Returns</span>
                  </div>
                  
                  <div className="weight-control">
                    <label>LSTM Regressor: {(ensembleConfig.lstmWeight * 100).toFixed(0)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={ensembleConfig.lstmWeight}
                      onChange={(e) => {
                        const lstmWeight = parseFloat(e.target.value);
                        setEnsembleConfig(prev => ({
                          ...prev,
                          lstmWeight: lstmWeight,
                          randomForestWeight: 1 - lstmWeight
                        }));
                      }}
                      disabled={isTraining}
                    />
                    <span className="weight-hint">Direct Returns</span>
                  </div>
                </div>
                
                <div className="weight-balance">
                  <span>Total: {((ensembleConfig.randomForestWeight + ensembleConfig.lstmWeight) * 100).toFixed(0)}%</span>
                  <button 
                    onClick={() => setEnsembleConfig(prev => ({
                      ...prev,
                      randomForestWeight: 0.4,
                      lstmWeight: 0.6
                    }))}
                    className="normalize-weights"
                  >
                    Reset to 40/60 (LSTM-favored)
                  </button>
                </div>
              </div>

              {/* Enhanced Model Parameters */}
              <div className="config-section">
                <h5>Model Parameters</h5>
                <div className="param-controls">
                  <div className="param-control">
                    <label>Lookback Days:</label>
                    <input
                      type="number"
                      min="20"
                      max="60"
                      value={ensembleConfig.lookbackDays}
                      onChange={(e) => setEnsembleConfig(prev => ({
                        ...prev,
                        lookbackDays: parseInt(e.target.value)
                      }))}
                      disabled={isTraining}
                    />
                  </div>
                  
                  <div className="param-control">
                    <label>RF Trees:</label>
                    <input
                      type="number"
                      min="50"
                      max="200"
                      value={ensembleConfig.rfTrees}
                      onChange={(e) => setEnsembleConfig(prev => ({
                        ...prev,
                        rfTrees: parseInt(e.target.value)
                      }))}
                      disabled={isTraining}
                    />
                  </div>
                  
                  <div className="param-control">
                    <label>LSTM Sequence:</label>
                    <input
                      type="number"
                      min="20"
                      max="60"
                      value={ensembleConfig.lstmSequenceLength}
                      onChange={(e) => setEnsembleConfig(prev => ({
                        ...prev,
                        lstmSequenceLength: parseInt(e.target.value)
                      }))}
                      disabled={isTraining}
                    />
                  </div>
                  
                  <div className="param-control">
                    <label>LSTM Epochs:</label>
                    <input
                      type="number"
                      min="30"
                      max="100"
                      value={ensembleConfig.lstmEpochs}
                      onChange={(e) => setEnsembleConfig(prev => ({
                        ...prev,
                        lstmEpochs: parseInt(e.target.value)
                      }))}
                      disabled={isTraining}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <button 
          className={`train-button ${isTraining ? 'training' : ''}`}
          onClick={handleTrainEnsemble}
          disabled={isTraining || !stockData || stockData.length < 400}
        >
          {isTraining ? (
            <>
              <div className="spinner"></div>
              Training Enhanced Ensemble... {trainingProgress}%
            </>
          ) : (
            '🚀 Train Enhanced RF + LSTM Ensemble'
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
            <p className="progress-message">{trainingMessage}</p>
          </div>
        )}

        {/* Enhanced Individual Model Results */}
        {trainingResults && (
          <div className="model-results">
            <div className="results-header">
              <h5>📊 Enhanced Model Performance</h5>
              <button 
                className="toggle-results"
                onClick={() => setShowIndividualResults(!showIndividualResults)}
              >
                {showIndividualResults ? 'Hide' : 'Show'} Details
              </button>
            </div>

            <div className="model-summary">
              <div className="model-status">
                <span className="model-name">RF Classifier</span>
                <span className="model-type">(5 Categories)</span>
                <span 
                  className={`status-dot ${getModelStatusColor(trainingResults.individualResults.randomForest)}`}
                ></span>
                <span className="accuracy">
                  {getModelPerformanceText(trainingResults.individualResults.randomForest, 'randomForest')}
                </span>
              </div>
              
              <div className="model-status">
                <span className="model-name">LSTM Regressor</span>
                <span className="model-type">(Log Returns)</span>
                <span 
                  className={`status-dot ${getModelStatusColor(trainingResults.individualResults.lstm)}`}
                ></span>
                <span className="accuracy">
                  {getModelPerformanceText(trainingResults.individualResults.lstm, 'lstm')}
                </span>
              </div>
            </div>

            {/* Enhanced Detailed Results */}
            {showIndividualResults && (
              <div className="detailed-results">
                {/* Random Forest Classifier Results */}
                <div className="model-detail">
                  <h6>🌲 Random Forest Classifier</h6>
                  {trainingResults.individualResults.randomForest?.error ? (
                    <div className="error-result">
                      <span className="error-icon">❌</span>
                      <span className="error-message">{trainingResults.individualResults.randomForest.error}</span>
                    </div>
                  ) : (
                    <div className="success-result">
                      <span className="success-icon">✅</span>
                      <div className="metrics">
                        <div className="metric-row">
                          <span className="metric-label">Accuracy:</span>
                          <span className="metric-value">{(trainingResults.individualResults.randomForest.accuracy * 100).toFixed(1)}%</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">F1 Score:</span>
                          <span className="metric-value">{(trainingResults.individualResults.randomForest.f1Score * 100).toFixed(1)}%</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Precision:</span>
                          <span className="metric-value">{(trainingResults.individualResults.randomForest.precision * 100).toFixed(1)}%</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Recall:</span>
                          <span className="metric-value">{(trainingResults.individualResults.randomForest.recall * 100).toFixed(1)}%</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Selected Features:</span>
                          <span className="metric-value">{trainingResults.individualResults.randomForest.numFeatures || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* LSTM Regressor Results */}
                <div className="model-detail">
                  <h6>🧠 LSTM Regressor</h6>
                  {trainingResults.individualResults.lstm?.error ? (
                    <div className="error-result">
                      <span className="error-icon">❌</span>
                      <span className="error-message">{trainingResults.individualResults.lstm.error}</span>
                    </div>
                  ) : (
                    <div className="success-result">
                      <span className="success-icon">✅</span>
                      <div className="metrics">
                        <div className="metric-row">
                          <span className="metric-label">Validation MAE:</span>
                          <span className="metric-value">{trainingResults.individualResults.lstm.mae?.toFixed(4) || 'N/A'}</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Training Loss:</span>
                          <span className="metric-value">{trainingResults.individualResults.lstm.mse?.toFixed(4) || 'N/A'}</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Accuracy Score:</span>
                          <span className="metric-value">{(trainingResults.individualResults.lstm.accuracy * 100).toFixed(1)}%</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Sequence Length:</span>
                          <span className="metric-value">{trainingResults.individualResults.lstm.sequenceLength || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Prediction Section */}
      {ensembleTrained && (
        <div className="prediction-section glass-card">
          <div className="prediction-header-controls">
            <h4>🔮 Enhanced Price Forecast</h4>
            
            <button 
              className="predict-button"
              onClick={() => handleMakePrediction()}
              disabled={isLoading}
            >
              {isLoading ? 'Predicting...' : '🎯 Generate Enhanced Forecast'}
            </button>
          </div>

          {/* Enhanced Prediction Display */}
          {currentPrediction && (
            <div className="long-term-prediction-display">
              <div className="prediction-main">
                <div className="price-forecast">
                  <div className="current-price">
                    <span className="label">Current Price:</span>
                    <span className="value">{formatCurrency(currentPrediction.currentPrice)}</span>
                  </div>
                  
                  <div className="predicted-price">
                    <span className="label">Predicted Price ({currentPrediction.targetDate}):</span>
                    <span className={`value ${currentPrediction.expectedReturn >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(currentPrediction.predictedPrice)}
                    </span>
                  </div>
                  
                  <div className="price-change">
                    <span className="label">Expected Change:</span>
                    <span className={`value ${currentPrediction.expectedReturn >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(currentPrediction.priceChange)} ({formatPercent(currentPrediction.expectedReturn)})
                    </span>
                  </div>
                  
                  <div className="direction-indicator">
                    <span className={`direction ${currentPrediction.direction.toLowerCase()}`}>
                      {currentPrediction.direction === 'UP' ? '📈' : currentPrediction.direction === 'DOWN' ? '📉' : '➡️'} 
                      {currentPrediction.direction}
                    </span>
                    <span className="timeframe">{currentPrediction.daysAhead} days ahead</span>
                  </div>
                </div>
              </div>

              {/* Enhanced Confidence Section */}
              <div className="confidence-section">
                <h5>📊 Enhanced Prediction Confidence</h5>
                
                <div className="confidence-details">
                  <div className="confidence-item">
                    <span>Ensemble Confidence:</span>
                    <span>{(currentPrediction.confidence * 100).toFixed(1)}%</span>
                  </div>
                  
                  <div className="confidence-item">
                    <span>Model Consensus:</span>
                    <span className={`consensus ${currentPrediction.agreementLevel.toLowerCase()}`}>
                      {currentPrediction.agreementLevel} ({(currentPrediction.consensus * 100).toFixed(1)}%)
                    </span>
                  </div>
                  
                  <div className="confidence-item">
                    <span>Price Range (95%):</span>
                    <span>
                      {formatCurrency(currentPrediction.priceRange[0])} - {formatCurrency(currentPrediction.priceRange[1])}
                    </span>
                  </div>
                  
                  <div className="confidence-item">
                    <span>Standard Deviation:</span>
                    <span>{formatCurrency(currentPrediction.standardDeviation)}</span>
                  </div>
                </div>

                <div className="confidence-bar">
                  <div className="confidence-label">Enhanced Ensemble Certainty</div>
                  <div className="confidence-meter">
                    <div 
                      className="confidence-fill"
                      style={{ width: `${currentPrediction.confidence * 100}%` }}
                    ></div>
                  </div>
                  <div className="confidence-text">{(currentPrediction.confidence * 100).toFixed(1)}%</div>
                </div>
              </div>

              {/* Enhanced Model Breakdown */}
              <div className="model-breakdown">
                <div className="breakdown-header">
                  <h5>🤖 Enhanced Model Predictions</h5>
                  <button 
                    className="toggle-breakdown"
                    onClick={() => setShowModelBreakdown(!showModelBreakdown)}
                  >
                    {showModelBreakdown ? 'Hide' : 'Show'} Details
                  </button>
                </div>
                
                {showModelBreakdown && (
                  <div className="model-predictions">
                    <div className="model-pred enhanced">
                      <span className="model">🌲 RF Classifier:</span>
                      <span className="type">{currentPrediction.individualPredictions.randomForest.type}</span>
                      <span className="return">{currentPrediction.individualPredictions.randomForest.return}</span>
                      <span className="price">{currentPrediction.individualPredictions.randomForest.price}</span>
                      <span className="conf">{currentPrediction.individualPredictions.randomForest.confidence}</span>
                    </div>
                    
                    <div className="model-pred enhanced">
                      <span className="model">🧠 LSTM Regressor:</span>
                      <span className="type">{currentPrediction.individualPredictions.lstm.type}</span>
                      <span className="return">{currentPrediction.individualPredictions.lstm.return}</span>
                      <span className="price">{currentPrediction.individualPredictions.lstm.price}</span>
                      <span className="conf">{currentPrediction.individualPredictions.lstm.confidence}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Voting Summary */}
              <div className="voting-summary">
                <h5>🗳️ Enhanced Model Consensus</h5>
                <div className="votes">
                  <div className="vote-counts">
                    <span className="up-votes">
                      📈 UP: {currentPrediction.votingBreakdown.upVotes}
                    </span>
                    <span className="down-votes">
                      📉 DOWN: {currentPrediction.votingBreakdown.downVotes}
                    </span>
                    <span className="flat-votes">
                      ➡️ FLAT: {currentPrediction.votingBreakdown.flatVotes}
                    </span>
                    {currentPrediction.votingBreakdown.abstains > 0 && (
                      <span className="abstains">
                        ❓ Failed: {currentPrediction.votingBreakdown.abstains}
                      </span>
                    )}
                  </div>
                  
                  <div className="model-weights">
                    <span>Dynamic Weights: RF({(currentPrediction.modelWeights.randomForest * 100).toFixed(0)}%) 
                    LSTM({(currentPrediction.modelWeights.lstm * 100).toFixed(0)}%)</span>
                  </div>
                </div>
              </div>

              {/* Enhanced Prediction Meta */}
              <div className="prediction-meta">
                <div className="meta-item">
                  <span>Valid Models:</span>
                  <span>{currentPrediction.validModels}/{currentPrediction.totalModels}</span>
                </div>
                <div className="meta-item">
                  <span>Model Types:</span>
                  <span>Classification + Regression</span>
                </div>
                <div className="meta-item">
                  <span>Prediction Made:</span>
                  <span>{timeAgo(currentPrediction.timestamp)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Prediction History */}
      {predictionHistory.length > 0 && (
        <div className="prediction-history glass-card">
          <h4>📈 Enhanced Prediction History</h4>
          <div className="history-list">
            {predictionHistory.map((pred, index) => (
              <div key={pred.predictionId || index} className={`history-item ${pred.direction.toLowerCase()}`}>
                <div className="history-prediction">
                  <span className="history-direction">
                    {pred.direction === 'UP' ? '📈' : pred.direction === 'DOWN' ? '📉' : '➡️'} {pred.direction}
                  </span>
                  <span className="history-price">
                    {formatCurrency(pred.predictedPrice)}
                  </span>
                  <span className="history-return">
                    {formatPercent(pred.expectedReturn)}
                  </span>
                </div>
                <div className="history-details">
                  <span>Target: {pred.targetDate}</span>
                  <span>Confidence: {(pred.confidence * 100).toFixed(1)}%</span>
                  <span>Models: {pred.validModels}/2</span>
                  <span>{timeAgo(pred.timestamp)}</span>
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

      {/* Enhanced Info Panel */}
      <div className="info-panel glass-card">
        <h5>ℹ️ About Enhanced RF + LSTM Ensemble</h5>
        <ul>
          <li><strong>Random Forest Classifier:</strong> Predicts 5 movement categories, converted to returns</li>
          <li><strong>LSTM Regressor:</strong> Directly predicts log-returns for price movements</li>
          <li><strong>Feature Selection:</strong> RF uses enhanced feature importance and correlation filtering</li>
          <li><strong>Dynamic Weighting:</strong> Models weighted based on their individual performance</li>
          <li><strong>Uncertainty Estimation:</strong> Combines classification confidence with regression uncertainty</li>
          <li><strong>Consensus Analysis:</strong> Analyzes agreement between different prediction approaches</li>
        </ul>
        
        <div className="disclaimer">
          <strong>⚠️ Enhanced Disclaimer:</strong> This ensemble combines classification and regression approaches 
          for robust predictions. Use confidence intervals and consider market conditions. Not financial advice.
        </div>
      </div>
    </div>
  );
};

export default LongTermEnsemblePrediction;
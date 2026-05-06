// src/components/EnsemblePrediction.js
// Multi-Model Ensemble Prediction Component

import React, { useState, useEffect } from 'react';
import { 
  trainEnsembleModel, 
  predictWithEnsemble,
  createEnsemblePredictor 
} from '../services/backendPredictionJobs';

const EnsemblePrediction = ({ stockData, symbol, fromDate }) => {
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
  
  // Configuration state
  const [ensembleConfig, setEnsembleConfig] = useState({
    naiveBayesWeight: 0.3,
    randomForestWeight: 0.4,
    lstmWeight: 0.3,
    minConfidenceThreshold: 0.6,
    consensusThreshold: 0.7,
    naiveBayes: { lookbackDays: 5 },
    randomForest: { lookbackDays: 5, nTrees: 50, testSplit: 0.2 },
    lstm: { sequenceLength: 10, epochs: 50, batchSize: 32 }
  });

  // Train the ensemble
  const handleTrainEnsemble = async () => {
    if (!stockData || stockData.length < 100) {
      setError('Insufficient data for ensemble training. Need at least 100 days of stock data.');
      return;
    }

    setIsTraining(true);
    setError('');
    setTrainingProgress(0);
    setTrainingMessage('Initializing ensemble training...');

    try {
      const progressCallback = (progress, message) => {
        setTrainingProgress(progress);
        setTrainingMessage(message);
      };

      console.log('🎯 Starting Ensemble Training...');
      const result = await trainEnsembleModel(stockData, ensembleConfig, progressCallback);

      setEnsemble(result.ensemble);
      setTrainingResults(result.trainingResult);
      setEnsembleTrained(true);
      
      console.log('✅ Ensemble training completed:', result.trainingResult);

      // Auto-predict current state
      if (result.ensemble.trained) {
        await handleMakePrediction(result.ensemble);
      }

    } catch (err) {
      console.error('❌ Ensemble training failed:', err);
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
      setError('Ensemble not trained yet');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('🔮 Making ensemble prediction...');
      const prediction = await predictWithEnsemble(ensembleToUse, stockData);
      
      console.log('📊 Ensemble prediction result:', prediction);

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
      console.error('❌ Ensemble prediction failed:', err);
      setError(`Prediction failed: ${err.message}`);
    } finally {
      setIsLoading(false);
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

  // Get model status color
  const getModelStatusColor = (modelResults) => {
    if (!modelResults) return 'red';
    if (modelResults.error) return 'red';
    const accuracy = modelResults.accuracy || modelResults.metrics?.accuracy || 0;
    if (accuracy > 0.7) return 'green';
    if (accuracy > 0.5) return 'orange';
    return 'red';
  };

  return (
    <div className="ensemble-prediction">
      {/* Header */}
      <div className="prediction-header glass-card">
        <h3>🎯 Ensemble AI Prediction</h3>
        <p>Combining Naive Bayes, Random Forest & LSTM for superior accuracy</p>
        
        {/* Ensemble Status */}
        <div className="ensemble-status">
          <div className={`status-indicator ${ensembleTrained ? 'trained' : 'untrained'}`}>
            <span className="status-dot"></span>
            {ensembleTrained ? 
              `Ensemble Trained (${trainingResults?.totalModels || 0}/3 models)` : 
              'Ensemble Not Trained'
            }
          </div>
          
          {trainingResults && (
            <div className="ensemble-summary">
              <span>Avg Accuracy: {(trainingResults.ensembleMetrics.averageAccuracy * 100).toFixed(1)}%</span>
              <span>Models: {trainingResults.ensembleMetrics.trainedModels}/3</span>
            </div>
          )}
        </div>
      </div>

      {/* Training Section */}
      <div className="training-section glass-card">
        <h4>🚀 Ensemble Training</h4>
        
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
              {/* Model Weights */}
              <div className="config-section">
                <h5>Model Weights</h5>
                <div className="weight-controls">
                  <div className="weight-control">
                    <label>Naive Bayes: {(ensembleConfig.naiveBayesWeight * 100).toFixed(0)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={ensembleConfig.naiveBayesWeight}
                      onChange={(e) => setEnsembleConfig(prev => ({
                        ...prev,
                        naiveBayesWeight: parseFloat(e.target.value)
                      }))}
                      disabled={isTraining}
                    />
                  </div>
                  
                  <div className="weight-control">
                    <label>Random Forest: {(ensembleConfig.randomForestWeight * 100).toFixed(0)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={ensembleConfig.randomForestWeight}
                      onChange={(e) => setEnsembleConfig(prev => ({
                        ...prev,
                        randomForestWeight: parseFloat(e.target.value)
                      }))}
                      disabled={isTraining}
                    />
                  </div>
                  
                  <div className="weight-control">
                    <label>LSTM: {(ensembleConfig.lstmWeight * 100).toFixed(0)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={ensembleConfig.lstmWeight}
                      onChange={(e) => setEnsembleConfig(prev => ({
                        ...prev,
                        lstmWeight: parseFloat(e.target.value)
                      }))}
                      disabled={isTraining}
                    />
                  </div>
                </div>
              </div>

              {/* Thresholds */}
              <div className="config-section">
                <h5>Decision Thresholds</h5>
                <div className="threshold-controls">
                  <div className="threshold-control">
                    <label>Min Confidence: {(ensembleConfig.minConfidenceThreshold * 100).toFixed(0)}%</label>
                    <input
                      type="range"
                      min="0.5"
                      max="0.9"
                      step="0.05"
                      value={ensembleConfig.minConfidenceThreshold}
                      onChange={(e) => setEnsembleConfig(prev => ({
                        ...prev,
                        minConfidenceThreshold: parseFloat(e.target.value)
                      }))}
                      disabled={isTraining}
                    />
                  </div>
                  
                  <div className="threshold-control">
                    <label>Consensus: {(ensembleConfig.consensusThreshold * 100).toFixed(0)}%</label>
                    <input
                      type="range"
                      min="0.5"
                      max="1.0"
                      step="0.05"
                      value={ensembleConfig.consensusThreshold}
                      onChange={(e) => setEnsembleConfig(prev => ({
                        ...prev,
                        consensusThreshold: parseFloat(e.target.value)
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
          disabled={isTraining || !stockData || stockData.length < 100}
        >
          {isTraining ? (
            <>
              <div className="spinner"></div>
              Training... {trainingProgress}%
            </>
          ) : (
            '🚀 Train Ensemble Models'
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

        {/* Individual Model Results */}
        {trainingResults && (
          <div className="model-results">
            <div className="results-header">
              <h5>📊 Individual Model Performance</h5>
              <button 
                className="toggle-results"
                onClick={() => setShowIndividualResults(!showIndividualResults)}
              >
                {showIndividualResults ? 'Hide' : 'Show'} Details
              </button>
            </div>

            <div className="model-summary">
              <div className="model-status">
                <span className="model-name">Naive Bayes</span>
                <span 
                  className={`status-dot ${getModelStatusColor(trainingResults.individualResults.naiveBayes)}`}
                ></span>
                <span className="accuracy">
                  {trainingResults.individualResults.naiveBayes?.error ? 
                    'Failed' : 
                    `${(trainingResults.individualResults.naiveBayes?.accuracy * 100 || 0).toFixed(1)}%`
                  }
                </span>
              </div>
              
              <div className="model-status">
                <span className="model-name">Random Forest</span>
                <span 
                  className={`status-dot ${getModelStatusColor(trainingResults.individualResults.randomForest)}`}
                ></span>
                <span className="accuracy">
                  {trainingResults.individualResults.randomForest?.error ? 
                    'Failed' : 
                    `${(trainingResults.individualResults.randomForest?.metrics?.accuracy * 100 || 0).toFixed(1)}%`
                  }
                </span>
              </div>
              
              <div className="model-status">
                <span className="model-name">LSTM</span>
                <span 
                  className={`status-dot ${getModelStatusColor(trainingResults.individualResults.lstm)}`}
                ></span>
                <span className="accuracy">
                  {trainingResults.individualResults.lstm?.error ? 
                    'Failed' : 
                    `${(trainingResults.individualResults.lstm?.accuracy * 100 || 0).toFixed(1)}%`
                  }
                </span>
              </div>
            </div>

            {/* Detailed Results */}
            {showIndividualResults && (
              <div className="detailed-results">
                {Object.entries(trainingResults.individualResults).map(([modelName, result]) => (
                  <div key={modelName} className="model-detail">
                    <h6>{modelName.charAt(0).toUpperCase() + modelName.slice(1)}</h6>
                    {result.error ? (
                      <div className="error-result">
                        <span className="error-icon">❌</span>
                        <span className="error-message">{result.error}</span>
                      </div>
                    ) : (
                      <div className="success-result">
                        <span className="success-icon">✅</span>
                        <div className="metrics">
                          {result.accuracy !== undefined && (
                            <span>Accuracy: {(result.accuracy * 100).toFixed(1)}%</span>
                          )}
                          {result.metrics && (
                            <>
                              <span>Precision: {(result.metrics.precision * 100).toFixed(1)}%</span>
                              <span>Recall: {(result.metrics.recall * 100).toFixed(1)}%</span>
                              <span>F1: {(result.metrics.f1 * 100).toFixed(1)}%</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prediction Section */}
      {ensembleTrained && (
        <div className="prediction-section glass-card">
          <div className="prediction-header-controls">
            <h4>🔮 Ensemble Prediction</h4>
            
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
            <div className="ensemble-prediction-display">
              <div className="prediction-main">
                <div className={`prediction-result ${currentPrediction.prediction.toLowerCase()}`}>
                  <span className="prediction-direction">
                    {currentPrediction.prediction === 'UP' ? '📈' : '📉'} 
                    {currentPrediction.prediction}
                  </span>
                  <span className="prediction-confidence">
                    {(currentPrediction.confidence * 100).toFixed(1)}% confidence
                  </span>
                </div>
                
                <div className="consensus-info">
                  <div className="consensus-level">
                    <span className="label">Agreement Level:</span>
                    <span className={`level ${currentPrediction.agreementLevel.toLowerCase()}`}>
                      {currentPrediction.agreementLevel}
                    </span>
                  </div>
                  
                  <div className="consensus-score">
                    <span className="label">Consensus:</span>
                    <span className="score">{(currentPrediction.consensus * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Voting Breakdown */}
              <div className="voting-breakdown">
                <h5>🗳️ Model Voting</h5>
                <div className="votes">
                  <div className="vote-counts">
                    <span className="up-votes">
                      📈 UP: {currentPrediction.votingBreakdown.upVotes}
                    </span>
                    <span className="down-votes">
                      📉 DOWN: {currentPrediction.votingBreakdown.downVotes}
                    </span>
                    {currentPrediction.votingBreakdown.abstains > 0 && (
                      <span className="abstains">
                        ❓ Failed: {currentPrediction.votingBreakdown.abstains}
                      </span>
                    )}
                  </div>
                  
                  <div className="model-weights">
                    <span>Weights: NB({(currentPrediction.modelWeights.naiveBayes * 100).toFixed(0)}%) 
                    RF({(currentPrediction.modelWeights.randomForest * 100).toFixed(0)}%) 
                    LSTM({(currentPrediction.modelWeights.lstm * 100).toFixed(0)}%)</span>
                  </div>
                </div>
              </div>

              {/* Individual Model Predictions */}
              <div className="individual-predictions">
                <h5>🤖 Individual Model Predictions</h5>
                <div className="model-predictions">
                  <div className="model-pred">
                    <span className="model">Naive Bayes:</span>
                    <span className={`pred ${currentPrediction.individualPredictions.naiveBayes === 1 ? 'up' : currentPrediction.individualPredictions.naiveBayes === 0 ? 'down' : 'failed'}`}>
                      {currentPrediction.individualPredictions.naiveBayes === 1 ? 'UP' : 
                       currentPrediction.individualPredictions.naiveBayes === 0 ? 'DOWN' : 'FAILED'}
                    </span>
                    <span className="conf">
                      {currentPrediction.individualConfidences.naiveBayes ? 
                        `${(currentPrediction.individualConfidences.naiveBayes * 100).toFixed(1)}%` : 
                        'N/A'
                      }
                    </span>
                  </div>
                  
                  <div className="model-pred">
                    <span className="model">Random Forest:</span>
                    <span className={`pred ${currentPrediction.individualPredictions.randomForest === 1 ? 'up' : currentPrediction.individualPredictions.randomForest === 0 ? 'down' : 'failed'}`}>
                      {currentPrediction.individualPredictions.randomForest === 1 ? 'UP' : 
                       currentPrediction.individualPredictions.randomForest === 0 ? 'DOWN' : 'FAILED'}
                    </span>
                    <span className="conf">
                      {currentPrediction.individualConfidences.randomForest ? 
                        `${(currentPrediction.individualConfidences.randomForest * 100).toFixed(1)}%` : 
                        'N/A'
                      }
                    </span>
                  </div>
                  
                  <div className="model-pred">
                    <span className="model">LSTM:</span>
                    <span className={`pred ${currentPrediction.individualPredictions.lstm === 1 ? 'up' : currentPrediction.individualPredictions.lstm === 0 ? 'down' : 'failed'}`}>
                      {currentPrediction.individualPredictions.lstm === 1 ? 'UP' : 
                       currentPrediction.individualPredictions.lstm === 0 ? 'DOWN' : 'FAILED'}
                    </span>
                    <span className="conf">
                      {currentPrediction.individualConfidences.lstm ? 
                        `${(currentPrediction.individualConfidences.lstm * 100).toFixed(1)}%` : 
                        'N/A'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Prediction Details */}
              <div className="prediction-details">
                <div className="detail">
                  <span>Current Price:</span>
                  <span>${currentPrediction.currentPrice?.toFixed(2) || 'N/A'}</span>
                </div>
                <div className="detail">
                  <span>Weighted Score:</span>
                  <span>{currentPrediction.weightedScore?.toFixed(3) || 'N/A'}</span>
                </div>
                <div className="detail">
                  <span>Valid Models:</span>
                  <span>{currentPrediction.validModels}/{currentPrediction.totalModels}</span>
                </div>
                <div className="detail">
                  <span>Timestamp:</span>
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
          <h4>📈 Ensemble Prediction History</h4>
          <div className="history-list">
            {predictionHistory.map((pred, index) => (
              <div key={pred.predictionId || index} className={`history-item ${pred.prediction.toLowerCase()}`}>
                <div className="history-prediction">
                  <span className="history-direction">
                    {pred.prediction === 'UP' ? '📈' : '📉'} {pred.prediction}
                  </span>
                  <span className="history-confidence">
                    {(pred.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="history-details">
                  <span>Consensus: {(pred.consensus * 100).toFixed(1)}%</span>
                  <span>Models: {pred.validModels}/3</span>
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

      {/* Info Panel */}
      <div className="info-panel glass-card">
        <h5>ℹ️ About Ensemble Prediction</h5>
        <ul>
          <li>Combines predictions from Naive Bayes, Random Forest, and LSTM models</li>
          <li>Uses weighted voting based on individual model performance</li>
          <li>Provides consensus analysis and agreement levels</li>
          <li>Automatically adjusts weights based on training accuracy</li>
          <li>Higher consensus = more reliable predictions</li>
        </ul>
        
        <div className="disclaimer">
          <strong>⚠️ Disclaimer:</strong> Ensemble methods improve accuracy but don't guarantee results. 
          Always combine with fundamental analysis. Not financial advice.
        </div>
      </div>
    </div>
  );
};

export default EnsemblePrediction;
// src/components/LongTermRandomForestPrediction.js
// Updated Long-Term Random Forest Price Prediction Component for 5-Class Classification

import React, { useState, useEffect } from 'react';
import { 
  trainLongTermRandomForest, 
  prepareLatestLongTermFeatures,
  LongTermRandomForestClassifier 
} from '../services/backendPredictionJobs';

const LongTermRandomForestPrediction = ({ stockData, symbol, fromDate }) => {
  // Model and training state
  const [model, setModel] = useState(null);
  const [modelMetrics, setModelMetrics] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [modelTrained, setModelTrained] = useState(false);
  
  // Prediction state
  const [prediction, setPrediction] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  
  // Component state
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFeatureImportance, setShowFeatureImportance] = useState(false);
  const [showClassBreakdown, setShowClassBreakdown] = useState(false);
  
  // Model parameters
  const [modelParams, setModelParams] = useState({
    nTrees: 100,
    lookbackDays: 30,
    targetDaysAhead: 22,
    testSplit: 0.2
  });

  // Get current price on component mount
  useEffect(() => {
    if (stockData && stockData.length > 0) {
      setCurrentPrice(stockData[stockData.length - 1].close);
    }
  }, [stockData]);

  // Train Long-Term Random Forest model
  const handleTrainModel = async () => {
    if (!stockData || stockData.length < modelParams.lookbackDays + modelParams.targetDaysAhead + 252) {
      setError(`Insufficient data for training. Need at least ${modelParams.lookbackDays + modelParams.targetDaysAhead + 252} days of stock data.`);
      return;
    }

    setIsTraining(true);
    setError('');
    setTrainingProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setTrainingProgress(prev => Math.min(prev + 8, 90));
      }, 300);

      console.log('Training Long-Term Random Forest model (5-class)...');
      const result = await trainLongTermRandomForest(
        stockData, 
        modelParams.lookbackDays,
        modelParams.targetDaysAhead,
        modelParams.nTrees, 
        modelParams.testSplit
      );

      clearInterval(progressInterval);
      setTrainingProgress(100);

      setModel(result.model);
      setModelMetrics(result.metrics);
      setModelTrained(true);
      
      console.log('Long-term 5-class model trained successfully:', result.metrics);

      // Auto-predict current state
      if (stockData.length >= modelParams.lookbackDays + 252) {
        await handleMakePrediction(result.model);
      }

    } catch (err) {
      console.error('Training error:', err);
      setError(`Training failed: ${err.message}`);
    } finally {
      setIsTraining(false);
      setTimeout(() => setTrainingProgress(0), 2000);
    }
  };

  // Make long-term price prediction with 5-class system
  const handleMakePrediction = async (trainedModel = null) => {
    const modelToUse = trainedModel || model;
    
    if (!modelToUse || !stockData || stockData.length < modelParams.lookbackDays + 252) {
      setError('Model not trained or insufficient data for prediction');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Get current price safely
      const latestStockData = stockData[stockData.length - 1];
      const currentStockPrice = latestStockData?.close;
      
      if (!currentStockPrice || !isFinite(currentStockPrice)) {
        throw new Error('Invalid current stock price');
      }
      
      console.log(`Current stock price: $${currentStockPrice.toFixed(2)}`);
      
      const features = prepareLatestLongTermFeatures(stockData, modelParams.lookbackDays);
      
      // Get 5-class prediction with confidence
      let classificationResult;
      try {
        const result = await modelToUse.predictWithConfidence([features]);
        classificationResult = result[0];
      } catch (predError) {
        console.error('Prediction error:', predError);
        throw new Error('Model prediction failed - may need retraining');
      }

      const classProbs = classificationResult.probabilities || [0.2, 0.2, 0.2, 0.2, 0.2];
      const predictedClass = classificationResult.prediction || 2;
      const confidence = classificationResult.confidence || 0.2;

      console.log('=== 5-CLASS CLASSIFICATION DEBUG ===');
      console.log('Raw class probabilities:', classProbs);
      console.log(`Predicted class: ${predictedClass}`);
      console.log(`Big Down (0): ${(classProbs[0] * 100).toFixed(1)}%`);
      console.log(`Small Down (1): ${(classProbs[1] * 100).toFixed(1)}%`);
      console.log(`Flat (2): ${(classProbs[2] * 100).toFixed(1)}%`);
      console.log(`Small Up (3): ${(classProbs[3] * 100).toFixed(1)}%`);
      console.log(`Big Up (4): ${(classProbs[4] * 100).toFixed(1)}%`);
      console.log(`Confidence: ${(confidence * 100).toFixed(1)}%`);

      // Convert class prediction to expected return and description
      let expectedReturn = 0;
      let predictedClassName = 'Unknown';
      let direction = 'FLAT';
      
      switch(predictedClass) {
        case 0: // Big Down
          expectedReturn = -0.025; // -2.5%
          predictedClassName = 'Big Down';
          direction = 'DOWN';
          break;
        case 1: // Small Down  
          expectedReturn = -0.008; // -0.8%
          predictedClassName = 'Small Down';
          direction = 'DOWN';
          break;
        case 2: // Flat
          expectedReturn = 0; // 0%
          predictedClassName = 'Flat';
          direction = 'FLAT';
          break;
        case 3: // Small Up
          expectedReturn = 0.008; // +0.8%
          predictedClassName = 'Small Up';
          direction = 'UP';
          break;
        case 4: // Big Up
          expectedReturn = 0.025; // +2.5%
          predictedClassName = 'Big Up';
          direction = 'UP';
          break;
        default:
          expectedReturn = 0;
          predictedClassName = 'Unknown';
          direction = 'FLAT';
      }
      
      const predictedPrice = currentStockPrice * (1 + expectedReturn);
      
      // Create confidence interval based on class probabilities
      const confidenceSpread = Math.max((1 - confidence) * 0.03, 0.005); // 0.5% to 3% spread
      const lowerBound = currentStockPrice * (1 + expectedReturn - confidenceSpread);
      const upperBound = currentStockPrice * (1 + expectedReturn + confidenceSpread);

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + modelParams.targetDaysAhead);

      const predictionResult = {
        predictedPrice: Number(predictedPrice) || currentStockPrice,
        confidence: Number(confidence) || 0,
        confidenceInterval: [
          Number(lowerBound) || currentStockPrice * 0.97,
          Number(upperBound) || currentStockPrice * 1.03
        ],
        agreementScore: Number(confidence) || 0,
        currentPrice: Number(currentStockPrice),
        targetDate: targetDate.toLocaleDateString(),
        daysAhead: modelParams.targetDaysAhead,
        timestamp: new Date(),
        expectedReturn: Number(expectedReturn * 100) || 0, // Convert to percentage
        priceChange: Number(predictedPrice - currentStockPrice) || 0,
        predictedClass: predictedClassName,
        predictedClassIndex: predictedClass,
        direction: direction,
        classificationProbs: {
          bigDown: Number(classProbs[0] * 100).toFixed(1),
          smallDown: Number(classProbs[1] * 100).toFixed(1),
          flat: Number(classProbs[2] * 100).toFixed(1),
          smallUp: Number(classProbs[3] * 100).toFixed(1),
          bigUp: Number(classProbs[4] * 100).toFixed(1)
        }
      };

      console.log('=== PREDICTION RESULT ===');
      console.log(`Predicted Class: ${predictedClassName} (${predictedClass})`);
      console.log(`Direction: ${direction}`);
      console.log(`Confidence: ${(confidence * 100).toFixed(1)}%`);
      console.log(`Expected Return: ${(expectedReturn * 100).toFixed(2)}%`);
      console.log(`Current Price: $${currentStockPrice.toFixed(2)}`);
      console.log(`Predicted Price: $${predictedPrice.toFixed(2)}`);

      setPrediction(predictionResult);

      // Add to prediction history
      setPredictionHistory(prev => [
        predictionResult,
        ...prev.slice(0, 4)
      ]);

    } catch (err) {
      console.error('Prediction error:', err);
      setError(`Prediction failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Get class color for display
  const getClassColor = (classIndex) => {
    switch(classIndex) {
      case 0: return '#ff4444'; // Big Down - Red
      case 1: return '#ff8888'; // Small Down - Light Red
      case 2: return '#888888'; // Flat - Gray
      case 3: return '#88ff88'; // Small Up - Light Green
      case 4: return '#44ff44'; // Big Up - Green
      default: return '#888888';
    }
  };

  return (
    <div className="long-term-rf-prediction">
      {/* Header */}
      <div className="prediction-header glass-card">
        <h3>📅 Long-Term Random Forest Prediction</h3>
        <p>Monthly price forecasting using 5-class classification ensemble</p>
        
        <div className="model-status">
          <div className={`status-indicator ${modelTrained ? 'trained' : 'untrained'}`}>
            <span className="status-dot"></span>
            {modelTrained ? `5-Class Model Trained (${modelParams.nTrees} trees, ${modelParams.targetDaysAhead} days ahead)` : 'Model Not Trained'}
          </div>
        </div>
      </div>

      {/* Training Section */}
      <div className="training-section glass-card">
        <h4>🎯 5-Class Model Training</h4>
        
        {/* Model Parameters */}
        <div className={`model-params ${showAdvanced ? 'expanded' : ''}`}>
          <button 
            className="toggle-advanced"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide' : 'Show'} Parameters
          </button>
          
          {showAdvanced && (
            <div className="params-grid">
              <div className="param-group">
                <label>Number of Trees:</label>
                <input
                  type="number"
                  min="50"
                  max="300"
                  value={modelParams.nTrees}
                  onChange={(e) => setModelParams(prev => ({
                    ...prev,
                    nTrees: parseInt(e.target.value)
                  }))}
                  disabled={isTraining}
                />
              </div>
              
              <div className="param-group">
                <label>Lookback Days:</label>
                <input
                  type="number"
                  min="20"
                  max="60"
                  value={modelParams.lookbackDays}
                  onChange={(e) => setModelParams(prev => ({
                    ...prev,
                    lookbackDays: parseInt(e.target.value)
                  }))}
                  disabled={isTraining}
                />
              </div>
              
              <div className="param-group">
                <label>Target Days Ahead:</label>
                <input
                  type="number"
                  min="15"
                  max="45"
                  value={modelParams.targetDaysAhead}
                  onChange={(e) => setModelParams(prev => ({
                    ...prev,
                    targetDaysAhead: parseInt(e.target.value)
                  }))}
                  disabled={isTraining}
                />
              </div>
              
              <div className="param-group">
                <label>Test Split:</label>
                <input
                  type="number"
                  min="0.1"
                  max="0.3"
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
          disabled={isTraining || !stockData || stockData.length < 300}
        >
          {isTraining ? (
            <>
              <div className="spinner"></div>
              Training... {trainingProgress}%
            </>
          ) : (
            '🚀 Train 5-Class Model'
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
            <p>Building classification trees for {modelParams.targetDaysAhead}-day price movement prediction...</p>
          </div>
        )}

        {/* Model Metrics - Updated for 5-class */}
        {modelMetrics && (
          <div className="model-metrics">
            <h5>📊 5-Class Model Performance</h5>
            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-label">Accuracy:</span>
                <span className="metric-value">{((modelMetrics.accuracy || 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="metric">
                <span className="metric-label">Precision:</span>
                <span className="metric-value">{((modelMetrics.precision || 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="metric">
                <span className="metric-label">Recall:</span>
                <span className="metric-value">{((modelMetrics.recall || 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="metric">
                <span className="metric-label">F1 Score:</span>
                <span className="metric-value">{((modelMetrics.f1 || 0) * 100).toFixed(1)}%</span>
              </div>
            </div>
            
            {/* Class distribution info */}
            <div className="class-info">
              <h6>📈 Movement Categories</h6>
              <div className="class-legend">
                <div className="class-item" style={{color: '#ff4444'}}>Big Down (&lt;-2%)</div>
                <div className="class-item" style={{color: '#ff8888'}}>Small Down (-0.5% to -2%)</div>
                <div className="class-item" style={{color: '#888888'}}>Flat (-0.5% to +0.5%)</div>
                <div className="class-item" style={{color: '#88ff88'}}>Small Up (+0.5% to +2%)</div>
                <div className="class-item" style={{color: '#44ff44'}}>Big Up (&gt;+2%)</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prediction Section */}
      {modelTrained && (
        <div className="prediction-section glass-card">
          <div className="prediction-header-controls">
            <h4>🔮 Price Movement Forecast</h4>
            
            <button 
              className="predict-button"
              onClick={() => handleMakePrediction()}
              disabled={isLoading}
            >
              {isLoading ? 'Predicting...' : '📈 Predict Movement'}
            </button>
          </div>

          {/* Current Prediction Display */}
          {prediction && (
            <div className="price-prediction-display">
              <div className="prediction-main">
                <div className="current-price">
                  <span className="label">Current Price:</span>
                  <span className="value">{formatCurrency(prediction.currentPrice)}</span>
                </div>
                
                <div className="predicted-class">
                  <span className="label">Predicted Movement:</span>
                  <span 
                    className="value prediction-class" 
                    style={{color: getClassColor(prediction.predictedClassIndex)}}
                  >
                    {prediction.direction === 'UP' ? '📈' : prediction.direction === 'DOWN' ? '📉' : '➡️'} {prediction.predictedClass}
                  </span>
                </div>
                
                <div className="predicted-price">
                  <span className="label">Predicted Price ({prediction.targetDate}):</span>
                  <span className={`value ${prediction.expectedReturn >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(prediction.predictedPrice)}
                  </span>
                </div>
                
                <div className="price-change">
                  <span className="label">Expected Change:</span>
                  <span className={`value ${prediction.expectedReturn >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(prediction.priceChange)} ({formatPercent(prediction.expectedReturn)})
                  </span>
                </div>
              </div>

              {/* Class Probabilities Breakdown */}
              <div className="class-breakdown">
                <div className="class-header">
                  <h5>📊 Class Probabilities</h5>
                  <button 
                    className="toggle-classes"
                    onClick={() => setShowClassBreakdown(!showClassBreakdown)}
                  >
                    {showClassBreakdown ? 'Hide' : 'Show'} Details
                  </button>
                </div>
                
                {showClassBreakdown && (
                  <div className="class-probabilities">
                    <div className="prob-item">
                      <span className="prob-label" style={{color: '#ff4444'}}>Big Down:</span>
                      <div className="prob-bar">
                        <div 
                          className="prob-fill" 
                          style={{width: `${prediction.classificationProbs.bigDown}%`, backgroundColor: '#ff4444'}}
                        ></div>
                      </div>
                      <span className="prob-value">{prediction.classificationProbs.bigDown}%</span>
                    </div>
                    
                    <div className="prob-item">
                      <span className="prob-label" style={{color: '#ff8888'}}>Small Down:</span>
                      <div className="prob-bar">
                        <div 
                          className="prob-fill" 
                          style={{width: `${prediction.classificationProbs.smallDown}%`, backgroundColor: '#ff8888'}}
                        ></div>
                      </div>
                      <span className="prob-value">{prediction.classificationProbs.smallDown}%</span>
                    </div>
                    
                    <div className="prob-item">
                      <span className="prob-label" style={{color: '#888888'}}>Flat:</span>
                      <div className="prob-bar">
                        <div 
                          className="prob-fill" 
                          style={{width: `${prediction.classificationProbs.flat}%`, backgroundColor: '#888888'}}
                        ></div>
                      </div>
                      <span className="prob-value">{prediction.classificationProbs.flat}%</span>
                    </div>
                    
                    <div className="prob-item">
                      <span className="prob-label" style={{color: '#88ff88'}}>Small Up:</span>
                      <div className="prob-bar">
                        <div 
                          className="prob-fill" 
                          style={{width: `${prediction.classificationProbs.smallUp}%`, backgroundColor: '#88ff88'}}
                        ></div>
                      </div>
                      <span className="prob-value">{prediction.classificationProbs.smallUp}%</span>
                    </div>
                    
                    <div className="prob-item">
                      <span className="prob-label" style={{color: '#44ff44'}}>Big Up:</span>
                      <div className="prob-bar">
                        <div 
                          className="prob-fill" 
                          style={{width: `${prediction.classificationProbs.bigUp}%`, backgroundColor: '#44ff44'}}
                        ></div>
                      </div>
                      <span className="prob-value">{prediction.classificationProbs.bigUp}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confidence Information */}
              <div className="confidence-section">
                <h5>📊 Prediction Confidence</h5>
                
                <div className="confidence-details">
                  <div className="confidence-item">
                    <span>Model Confidence:</span>
                    <span>{(prediction.confidence * 100).toFixed(1)}%</span>
                  </div>
                  
                  <div className="confidence-item">
                    <span>Price Range (95%):</span>
                    <span>
                      {formatCurrency(prediction.confidenceInterval[0])} - {formatCurrency(prediction.confidenceInterval[1])}
                    </span>
                  </div>
                  
                  <div className="confidence-item">
                    <span>Prediction Category:</span>
                    <span style={{color: getClassColor(prediction.predictedClassIndex)}}>
                      {prediction.predictedClass}
                    </span>
                  </div>
                </div>

                {/* Visual confidence indicator */}
                <div className="confidence-bar">
                  <div className="confidence-label">Model Certainty</div>
                  <div className="confidence-meter">
                    <div 
                      className="confidence-fill"
                      style={{ width: `${prediction.confidence * 100}%` }}
                    ></div>
                  </div>
                  <div className="confidence-text">{(prediction.confidence * 100).toFixed(1)}%</div>
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
              <div key={index} className="history-item">
                <div className="history-main">
                  <span className="history-target">{pred.targetDate}</span>
                  <span 
                    className="history-class"
                    style={{color: getClassColor(pred.predictedClassIndex)}}
                  >
                    {pred.direction === 'UP' ? '📈' : pred.direction === 'DOWN' ? '📉' : '➡️'} {pred.predictedClass}
                  </span>
                  <span className={`history-price ${pred.expectedReturn >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(pred.predictedPrice)}
                  </span>
                  <span className={`history-change ${pred.expectedReturn >= 0 ? 'positive' : 'negative'}`}>
                    {formatPercent(pred.expectedReturn)}
                  </span>
                </div>
                <div className="history-confidence">
                  Confidence: {(pred.confidence * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Importance */}
      {modelMetrics && (
        <div className="feature-importance glass-card">
          <div className="feature-header">
            <h4>🎯 Feature Importance</h4>
            <button 
              className="toggle-features"
              onClick={() => setShowFeatureImportance(!showFeatureImportance)}
            >
              {showFeatureImportance ? 'Hide' : 'Show'} Details
            </button>
          </div>
          
          {showFeatureImportance && modelMetrics.featureImportanceDetails && (
            <div className="feature-list">
              {modelMetrics.featureImportanceDetails.slice(0, 10).map((feature, index) => (
                <div key={index} className="feature-item">
                  <span className="feature-name">{feature.feature}</span>
                  <div className="feature-bar">
                    <div 
                      className="feature-fill"
                      style={{ width: `${(feature.importance * 100)}%` }}
                    ></div>
                  </div>
                  <span className="feature-value">{(feature.importance * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
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
        <h5>ℹ️ About 5-Class Price Movement Prediction</h5>
        <ul>
          <li>Predicts price movement category {modelParams.targetDaysAhead} trading days ahead</li>
          <li>Uses {modelParams.lookbackDays}-day lookback with comprehensive technical analysis</li>
          <li>5-class system: Big Down, Small Down, Flat, Small Up, Big Up</li>
          <li>Shows probability distribution across all movement categories</li>
          <li>Model confidence indicates certainty of the predicted class</li>
          <li>Best for understanding directional bias and position sizing</li>
        </ul>
        
        <div className="disclaimer">
          <strong>⚠️ Disclaimer:</strong> Classification predictions show likely movement categories. 
          Use probability distributions and confidence levels for decision making. Not financial advice.
        </div>
      </div>
    </div>
  );
};

export default LongTermRandomForestPrediction;
import React, { useState, useEffect, useRef } from 'react';
import { getCurrentPriceAndVolume } from '../services/api';
import { 
  trainAndEvaluate, 
  prepareLatestForPrediction, 
  discretizePredictionSample,
  getMarketTimeInfo,
  trainIntradayModels,
} from '../services/backendPredictionJobs';

const StockPrediction = ({ stockData, symbol, fromDate }) => {
  // Model states
  const [modelInfo, setModelInfo] = useState(null);
  const [predictionEngine, setPredictionEngine] = useState(null);
  const [trainingResults, setTrainingResults] = useState(null);
  
  // Prediction states
  const [nextDayPrediction, setNextDayPrediction] = useState(null);
  const [intradayPredictions, setIntradayPredictions] = useState(null);
  const [tradingSignals, setTradingSignals] = useState([]);
  
  // Data and UI states
  const [currentData, setCurrentData] = useState(null);
  const [marketInfo, setMarketInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [predictionMode, setPredictionMode] = useState('auto'); // 'auto', 'nextday', 'intraday'
  
  const updateIntervalRef = useRef(null);
  
  // Train both models when data changes
  useEffect(() => {
    if (!stockData || stockData.length === 0) {
      setError('No stock data available for prediction');
      return;
    }

    let cancelled = false;

    const trainModels = async () => {
      setIsLoading(true);
      setError('');

      try {
        console.log('Training prediction models...');

        // Filter data from the specified date, if provided
        let filteredData = stockData;
        if (fromDate) {
          filteredData = stockData.filter(item => item.date >= fromDate);
        }

        // Ensure we have enough data
        if (filteredData.length < 10) {
          throw new Error(`Insufficient data for training. Need at least 10 days but got ${filteredData.length}.`);
        }

        // Validate data structure
        const samplePoint = filteredData[0];
        if (!samplePoint || typeof samplePoint.close !== 'number') {
          throw new Error('Invalid data structure. Stock data must include OHLC values as numbers.');
        }

        // Train traditional model for next-day predictions
        const traditionalResult = await trainAndEvaluate(filteredData, 5, 5, 0.2);
        if (!cancelled) {
          setModelInfo(traditionalResult);
        }

        // Train enhanced models for intraday predictions
        const { engine, results, isReady } = await trainIntradayModels(filteredData, ['1H', '2H', 'EOD']);
        if (!cancelled && isReady) {
          setPredictionEngine(engine);
          setTrainingResults(results);
        }

        console.log('Models trained successfully');

        // Make initial next-day prediction
        await makeNextDayPrediction(filteredData, traditionalResult);
      } catch (err) {
        console.error('Error training models:', err);
        if (!cancelled) {
          setError(`Training failed: ${err.message}`);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    trainModels();

    return () => {
      cancelled = true;
    };
  }, [stockData, fromDate]);
  
  // Make next-day prediction (works anytime)
  const makeNextDayPrediction = async (data, model) => {
    try {
      const latestFeatures = await prepareLatestForPrediction(data, 5);
      const discretizedSingle = await discretizePredictionSample(latestFeatures, model.metadata);
      const discretizedFeatures = [discretizedSingle];
      const rawProbabilities = await model.model.predictProba(discretizedFeatures);
      const probabilities = rawProbabilities[0];
      
      setNextDayPrediction({
        prediction: probabilities[1] > probabilities[0] ? 'UP' : 'DOWN',
        upProbability: probabilities[1],
        downProbability: probabilities[0],
        confidence: Math.max(probabilities[0], probabilities[1]),
        type: 'next-day',
        description: 'Next trading day direction prediction'
      });
    } catch (err) {
      console.error('Error making next-day prediction:', err);
    }
  };
  
  // Update real-time data and intraday predictions (market hours only)
  useEffect(() => {
    if (!predictionEngine || !symbol) return;
    
    const updateIntradayPredictions = async () => {
      try {
        // Get market time info
        const marketData = await getMarketTimeInfo();
        setMarketInfo(marketData);
        
        if (marketData.isMarketHours) {
          // Get current price and volume from API
          const realTimeData = await getCurrentPriceAndVolume(symbol);
          setCurrentData(realTimeData);
          
          if (realTimeData) {
            // Update intraday predictions using the engine
            const result = await predictionEngine.updatePredictions(
              stockData, 
              realTimeData.currentPrice, 
              realTimeData.currentVolume
            );
            
            if (result.predictions) {
              setIntradayPredictions(result.predictions);
              
              // Get trading signals
              const signals = await predictionEngine.getTradingSignals();
              setTradingSignals(signals);
              
              setLastUpdate(new Date());
            }
          }
        } else {
          // Market closed - clear intraday data but keep next-day prediction
          setCurrentData(null);
          setIntradayPredictions(null);
          setTradingSignals([]);
        }
        
      } catch (err) {
        console.error('Error updating intraday predictions:', err);
      }
    };
    
    // Initial update
    updateIntradayPredictions();
    
    // Set up periodic updates every 2 minutes
    updateIntervalRef.current = setInterval(updateIntradayPredictions, 2 * 60 * 1000);
    
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [predictionEngine, stockData, symbol]);
  
  // Determine what to show based on market status and user preference
  const getDisplayMode = () => {
    if (predictionMode === 'nextday') return 'nextday';
    if (predictionMode === 'intraday') return 'intraday';
    
    // Auto mode
    if (marketInfo?.isMarketHours && intradayPredictions) return 'both';
    return 'nextday';
  };
  
  const formatTime = (date) => {
    return date ? date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    }) : 'Never';
  };
  
  const formatCurrency = (value) => {
    if (value == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  const formatNumber = (value) => {
    if (value == null) return 'N/A';
    return new Intl.NumberFormat('en-US').format(value);
  };
  
  if (isLoading) {
    return (
      <div className="stock-prediction">
        <h3>🤖 AI Prediction Engine</h3>
        <div className="loading">Training prediction models...</div>
      </div>
    );
  }
  
  if (error && !modelInfo) {
    return (
      <div className="stock-prediction">
        <h3>🤖 AI Prediction Engine</h3>
        <div className="error">{error}</div>
      </div>
    );
  }
  
  if (!modelInfo) {
    return <div className="no-data">No prediction available</div>;
  }
  
  const displayMode = getDisplayMode();
  
  return (
    <div className="stock-prediction">
      <div className="prediction-header">
        <h3>🤖 AI Prediction Engine ({symbol})</h3>
        
        {/* Mode Selection */}
        <div className="mode-selector">
          <button 
            className={predictionMode === 'auto' ? 'active' : ''}
            onClick={() => setPredictionMode('auto')}
          >
            🔄 Auto
          </button>
          <button 
            className={predictionMode === 'nextday' ? 'active' : ''}
            onClick={() => setPredictionMode('nextday')}
          >
            📅 Next Day
          </button>
          <button 
            className={predictionMode === 'intraday' ? 'active' : ''}
            onClick={() => setPredictionMode('intraday')}
            disabled={!marketInfo?.isMarketHours}
          >
            ⚡ Real-Time
          </button>
        </div>
        
        {/* Status Bar */}
        <div className="status-bar">
          <span className={`market-status ${marketInfo?.isMarketHours ? 'open' : 'closed'}`}>
            {marketInfo?.isMarketHours ? '🟢 Market Open' : '🔴 Market Closed'}
          </span>
          {marketInfo?.isMarketHours && (
            <span className="time-info">
              {marketInfo.timeOfDay} • {marketInfo.minutesFromOpen} min from open
            </span>
          )}
          {lastUpdate && (
            <span className="last-update">
              Last update: {formatTime(lastUpdate)}
            </span>
          )}
        </div>
      </div>
      
      {error && (
        <div className="warning-message">⚠️ {error}</div>
      )}
      
      {/* Current Price Display (market hours only) */}
      {currentData && displayMode !== 'nextday' && (
        <div className="current-data">
          <h4>📊 Current Market Data:</h4>
          <div className="data-grid">
            <div className="data-item">
              <span className="label">Price:</span>
              <span className="value">{formatCurrency(currentData.currentPrice)}</span>
            </div>
            <div className="data-item">
              <span className="label">Volume:</span>
              <span className="value">{formatNumber(currentData.currentVolume)}</span>
            </div>
            <div className="data-item">
              <span className="label">Data Time:</span>
              <span className="value">{formatTime(currentData.timestamp)}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Next Day Prediction (always available) */}
      {nextDayPrediction && (displayMode === 'nextday' || displayMode === 'both') && (
        <div className="next-day-prediction">
          <h4>📈 Next Trading Day Prediction:</h4>
          <div className={`prediction-result ${nextDayPrediction.prediction.toLowerCase()}`}>
            <span className="direction">
              {nextDayPrediction.prediction === 'UP' ? '⬆️' : '⬇️'} {nextDayPrediction.prediction}
            </span>
            <span className="confidence">
              {Math.round(nextDayPrediction.confidence * 100)}% confidence
            </span>
          </div>
          
          <div className="probability-breakdown">
            <div className="prob-item">
              <span className="label">Up:</span>
              <div className="prob-bar">
                <div 
                  className="bar positive" 
                  style={{ width: `${nextDayPrediction.upProbability * 100}%` }}
                ></div>
                <span className="value">{Math.round(nextDayPrediction.upProbability * 100)}%</span>
              </div>
            </div>
            <div className="prob-item">
              <span className="label">Down:</span>
              <div className="prob-bar">
                <div 
                  className="bar negative" 
                  style={{ width: `${nextDayPrediction.downProbability * 100}%` }}
                ></div>
                <span className="value">{Math.round(nextDayPrediction.downProbability * 100)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Trading Signals (market hours only) */}
      {tradingSignals.length > 0 && displayMode !== 'nextday' && (
        <div className="trading-signals">
          <h4>📈 Real-Time Trading Signals</h4>
          {tradingSignals.map((signal, index) => (
            <div key={index} className={`signal ${signal.type.toLowerCase()}`}>
              <span className="signal-type">
                {signal.type === 'BUY' ? '📈 BUY' : '📉 SELL'}
              </span>
              <span className="signal-strength">
                Strength: {Math.round(signal.strength * 100)}%
              </span>
              <span className="signal-reason">{signal.reason}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Intraday Predictions Grid (market hours only) */}
      {intradayPredictions && displayMode !== 'nextday' && (
        <div className="intraday-predictions">
          <h4>⚡ Intraday Predictions</h4>
          <div className="predictions-grid">
            {Object.entries(intradayPredictions).map(([horizon, pred]) => (
              <div key={horizon} className="prediction-card">
                <h5>
                  {horizon === '1H' ? '📅 Next Hour' : 
                   horizon === '2H' ? '📅 Next 2 Hours' : 
                   '📅 End of Day'}
                </h5>
                
                {pred.error ? (
                  <div className="prediction-error">❌ {pred.error}</div>
                ) : (
                  <>
                    <div className={`prediction-result ${pred.prediction.toLowerCase()}`}>
                      <span className="direction">
                        {pred.prediction === 'UP' ? '⬆️' : '⬇️'} {pred.prediction}
                      </span>
                      <span className="confidence">
                        {Math.round(pred.confidence * 100)}%
                      </span>
                    </div>
                    
                    <div className="probability-breakdown">
                      <div className="prob-item">
                        <span className="label">Up:</span>
                        <div className="prob-bar">
                          <div 
                            className="bar positive" 
                            style={{ width: `${pred.upProbability * 100}%` }}
                          ></div>
                          <span className="value">{Math.round(pred.upProbability * 100)}%</span>
                        </div>
                      </div>
                      <div className="prob-item">
                        <span className="label">Down:</span>
                        <div className="prob-bar">
                          <div 
                            className="bar negative" 
                            style={{ width: `${pred.downProbability * 100}%` }}
                          ></div>
                          <span className="value">{Math.round(pred.downProbability * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Model Performance */}
      <div className="model-performance">
        <h4>🎯 Model Performance:</h4>
        <div className="performance-section">
          <div className="traditional-model">
            <h5>Next-Day Model:</h5>
            <div className="metrics-grid">
              <div className="metric">
                <span className="label">Accuracy:</span>
                <span className="value">{(modelInfo.metrics.accuracy * 100).toFixed(1)}%</span>
              </div>
              {modelInfo.metrics.precision !== undefined && (
                <>
                  <div className="metric">
                    <span className="label">Precision:</span>
                    <span className="value">{(modelInfo.metrics.precision * 100).toFixed(1)}%</span>
                  </div>
                  <div className="metric">
                    <span className="label">F1 Score:</span>
                    <span className="value">{(modelInfo.metrics.f1 * 100).toFixed(1)}%</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {trainingResults && (
            <div className="intraday-models">
              <h5>Intraday Models:</h5>
              <div className="performance-grid">
                {Object.entries(trainingResults).map(([horizon, result]) => (
                  <div key={horizon} className="performance-item">
                    <span className="horizon">{horizon}:</span>
                    {result.error ? (
                      <span className="error">❌ {result.error}</span>
                    ) : (
                      <span className="accuracy">
                        {Math.round(result.metrics.accuracy * 100)}% accuracy
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="methodology">
        <h4>🧠 How It Works:</h4>
        <div className="methodology-modes">
          <div className="mode-description">
            <strong>Next-Day Mode:</strong> Uses historical patterns to predict tomorrow's direction. 
            Available 24/7 for planning and analysis.
          </div>
          {marketInfo?.isMarketHours && (
            <div className="mode-description">
              <strong>Real-Time Mode:</strong> Combines historical patterns with live market data 
              for intraday predictions and trading signals.
            </div>
          )}
        </div>
      </div>
      
      <div className="disclaimer">
        <p><strong>⚠️ Disclaimer:</strong> These predictions are for educational purposes only and 
        should not be considered as financial advice. Use proper risk management and never risk 
        more than you can afford to lose.</p>
      </div>
    </div>
  );
};

export default StockPrediction;
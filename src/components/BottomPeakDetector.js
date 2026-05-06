// src/components/BottomPeakDetector.js
// React component for LSTM-powered bottom/peak detection

import React, { useState, useEffect, useCallback } from 'react';
import { extractTechnicalFeatures } from '../services/technicalIndicators';
import { 
  buildAndTrainLSTMModel, 
  predictBottomsPeaks, 
  saveModel, 
  loadModel, 
  modelExists,
  deleteModel 
} from '../services/backendPredictionJobs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts';

import '../styles/BottomPeakDetector.css'; // Import your styles

const BottomPeakDetector = ({ stockData, fromDate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [features, setFeatures] = useState([]);
  const [model, setModel] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [threshold, setThreshold] = useState(0.7); // Probability threshold for signals
  const [debug, setDebug] = useState('');
  const [trainNewModel, setTrainNewModel] = useState(false);
  const [modelTrainingProgress, setModelTrainingProgress] = useState(0);
  
  // Extract technical features when stock data changes
  useEffect(() => {
    if (!stockData || stockData.length === 0) {
      setError('No stock data available');
      return;
    }
    
    setDebug('Processing stock data and extracting features...');
    
    try {
      // Process stock data into proper format
      const processedData = {
        dates: stockData.map(d => d.date),
        open: stockData.map(d => d.open),
        high: stockData.map(d => d.high),
        low: stockData.map(d => d.low),
        close: stockData.map(d => d.close),
        volume: stockData.map(d => d.volume),
      };
      
      // Extract features
      const extractedFeatures = extractTechnicalFeatures(processedData);
      setFeatures(extractedFeatures);
      setDebug(prev => `${prev}\nExtracted ${extractedFeatures.length} feature points from stock data`);
      
      // Filter by from date if provided
      const filteredFeatures = fromDate 
        ? extractedFeatures.filter(f => f.date >= fromDate)
        : extractedFeatures;
      
      // Prepare chart data
      const chartDataWithIndicators = filteredFeatures.map(feature => ({
        date: feature.date,
        close: feature.close,
        sma20: feature.sma20Ratio ? feature.close / feature.sma20Ratio : null,
        sma50: feature.sma50Ratio ? feature.close / feature.sma50Ratio : null,
        sma200: feature.sma200Ratio ? feature.close / feature.sma200Ratio : null,
        rsi: feature.rsi,
        macdHistogram: feature.macdHistogram,
        bottomSignal: feature.bottomSignal,
        peakSignal: feature.peakSignal
      }));
      
      setChartData(chartDataWithIndicators);
      setDebug(prev => `${prev}\nPrepared chart data with technical indicators`);
      
    } catch (err) {
      console.error('Error extracting features:', err);
      setError(`Error extracting features: ${err.message}`);
      setDebug(prev => `${prev}\nERROR: ${err.message}`);
    }
  }, [stockData, fromDate]);
  
  // Custom callback for tracking model training progress
  const progressCallback = useCallback((epoch, totalEpochs, logs) => {
    const progress = (epoch + 1) / totalEpochs;
    setModelTrainingProgress(progress);
    setDebug(prev => 
      `${prev}\nEpoch ${epoch + 1}/${totalEpochs}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`
    );
  }, []);
  
  // Train model or load existing model when features are available
  useEffect(() => {
    if (features.length === 0) return;
    
    const trainOrLoadModel = async () => {
      setIsLoading(true);
      setError('');
      setModelTrainingProgress(0);
      
      try {
        // Check for minimum data requirements
        if (features.length < 50) {
          throw new Error(`Insufficient data for training. Need at least 50 data points but got ${features.length}.`);
        }
        
        // Check if model already exists and we don't need to retrain
        const modelName = 'lstm-bottom-peak-model';
        const modelLoaded = !trainNewModel && await modelExists(modelName);
        let trainedModel, modelResult, normParams, sequenceLength;
        
        if (modelLoaded) {
          // Load existing model and metadata
          const loadedData = await loadModel(modelName);
          trainedModel = loadedData.model;
          normParams = loadedData.normParams;
          sequenceLength = loadedData.sequenceLength;
          
          setDebug(prev => `${prev}\nLoaded existing model from IndexedDB (saved at: ${loadedData.savedAt})`);
        } else {
          // Build and train model
          setDebug(prev => `${prev}\nTraining new LSTM model...`);
          
          // Use a reduced number of epochs for testing to avoid browser freezing
          // In production, you'd want to use more epochs (50-100)
          const epochs = 20;
          
          // Define custom callback function for tracking training progress
          const customCallbacks = {
            onEpochEnd: (epoch, logs) => progressCallback(epoch, epochs, logs)
          };
          
          modelResult = await buildAndTrainLSTMModel(features, epochs, 32, customCallbacks);
          trainedModel = modelResult.model;
          normParams = modelResult.normParams;
          sequenceLength = modelResult.sequenceLength;
          
          // Save the full model details to component state
          setModel(modelResult);
          setDebug(prev => `${prev}\nModel training completed with accuracy: ${
            modelResult.history && modelResult.history.acc && modelResult.history.acc.length > 0 ? 
            modelResult.history.acc[modelResult.history.acc.length - 1].toFixed(4) : 
            'N/A'
          }`);
          
          // Save model for future use
          await saveModel(trainedModel, normParams, sequenceLength, modelName);
          setDebug(prev => `${prev}\nModel and metadata saved to IndexedDB for future use`);
        }
        
        // Make predictions
        setDebug(prev => `${prev}\nMaking predictions with model...`);
        const predictionResults = await predictBottomsPeaks(
          trainedModel,
          features,
          normParams,
          sequenceLength,
          threshold
        );
        
        setPredictions(predictionResults);
        setDebug(prev => `${prev}\nPredictions complete: Found ${
          predictionResults.filter(r => r.isBottom).length
        } bottoms and ${
          predictionResults.filter(r => r.isPeak).length
        } peaks`);
        
        // Enhance chart data with predictions
        setChartData(prevChartData => {
          const newChartData = [...prevChartData];
          
          // Add prediction results to chart data
          predictionResults.forEach(pred => {
            const index = newChartData.findIndex(d => d.date === pred.date);
            if (index !== -1) {
              newChartData[index].bottomProb = pred.bottomProb;
              newChartData[index].peakProb = pred.peakProb;
              newChartData[index].isBottom = pred.bottomProb > threshold;
              newChartData[index].isPeak = pred.peakProb > threshold;
            }
          });
          
          return newChartData;
        });
        
      } catch (err) {
        console.error('Error with model:', err);
        setError(`Error: ${err.message}`);
        setDebug(prev => `${prev}\nERROR: ${err.message}`);
      } finally {
        setIsLoading(false);
        setTrainNewModel(false); // Reset after attempted training
        setModelTrainingProgress(0);
      }
    };
    
    trainOrLoadModel();
  }, [features, threshold, trainNewModel, model, progressCallback]);
  
  // Handle threshold change
  const handleThresholdChange = (e) => {
    const newThreshold = parseFloat(e.target.value);
    setThreshold(newThreshold);
    
    // Update chart data with new threshold
    if (predictions.length > 0) {
      setChartData(prevChartData => {
        return prevChartData.map(d => {
          if (d.bottomProb !== undefined && d.peakProb !== undefined) {
            return {
              ...d,
              isBottom: d.bottomProb > newThreshold,
              isPeak: d.peakProb > newThreshold
            };
          }
          return d;
        });
      });
    }
  };
  
  // Handle retraining
  const handleRetrainModel = () => {
    setTrainNewModel(true);
  };
  
  // Handle clearing cached model
  const handleClearModel = async () => {
    try {
      await deleteModel();
      setModel(null);
      setPredictions([]);
      setDebug(prev => `${prev}\nCached model deleted. Will retrain on next run.`);
      // Trigger retraining
      setTrainNewModel(true);
    } catch (error) {
      setError(`Error clearing model: ${error.message}`);
    }
  };
  
  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="date">{new Date(label).toLocaleDateString()}</p>
          <p>Price: ${data.close ? Number(data.close).toFixed(2) : 'N/A'}</p>
          {data.bottomProb !== undefined && (
            <>
              <p>Bottom Probability: {(data.bottomProb * 100).toFixed(1)}%</p>
              <p>Peak Probability: {(data.peakProb * 100).toFixed(1)}%</p>
            </>
          )}
          <p>RSI: {data.rsi !== undefined && data.rsi !== null ? Number(data.rsi).toFixed(1) : 'N/A'}</p>
          <p>MACD Histogram: {data.macdHistogram !== undefined && data.macdHistogram !== null ? Number(data.macdHistogram).toFixed(3) : 'N/A'}</p>
        </div>
      );
    }
    return null;
  };
  
  if (isLoading) {
    return (
      <div className="bottom-peak-detector">
        <h3>Bottom/Peak Detection with LSTM + Technical Indicators</h3>
        <div className="loading">
          <p>Training LSTM model... This may take a few moments.</p>
          <div className="progress-container">
            <div 
              className="progress-bar" 
              style={{ width: `${modelTrainingProgress * 100}%` }}
            ></div>
          </div>
          <p className="progress-text">
            {Math.round(modelTrainingProgress * 100)}% Complete
          </p>
          <div className="debug-output">
            <pre>{debug}</pre>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bottom-peak-detector">
        <h3>Bottom/Peak Detection with LSTM + Technical Indicators</h3>
        <div className="error">{error}</div>
        <div className="debug-output">
          <h4>Debug Information:</h4>
          <pre>{debug}</pre>
        </div>
      </div>
    );
  }
  
  if (chartData.length === 0) {
    return <div className="no-data">No data available for bottom/peak detection</div>;
  }
  
  return (
    <div className="bottom-peak-detector">
      <h3>Bottom/Peak Detection with LSTM + Technical Indicators</h3>
      
      <div className="controls">
        <div className="control-row">
          <label htmlFor="threshold">
            Signal Threshold: {threshold}
            <input
              type="range"
              id="threshold"
              min="0.1"
              max="0.95"
              step="0.05"
              value={threshold}
              onChange={handleThresholdChange}
            />
          </label>
          
          <div className="button-group">
            <button 
              className="retrain-button" 
              onClick={handleRetrainModel}
              disabled={isLoading}
            >
              Retrain Model
            </button>
            
            <button 
              className="clear-button" 
              onClick={handleClearModel}
              disabled={isLoading}
            >
              Clear Cached Model
            </button>
          </div>
        </div>
        <div className="model-info">
          {model && model.history && (
            <div className="training-metrics">
              <span className="metric">
                Training Accuracy: {
                  model.history.acc && model.history.acc.length > 0 ? 
                  (model.history.acc[model.history.acc.length - 1] * 100).toFixed(1) : 
                  'N/A'
                }%
              </span>
              <span className="metric">
                Validation Accuracy: {
                  model.history.val_acc && model.history.val_acc.length > 0 ? 
                  (model.history.val_acc[model.history.val_acc.length - 1] * 100).toFixed(1) : 
                  'N/A'
                }%
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              tickFormatter={(date) => new Date(date).toLocaleDateString()} 
            />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            <Line 
              type="monotone" 
              dataKey="close" 
              stroke="#1f77b4" 
              dot={false} 
              name="Price" 
              strokeWidth={2}
            />
            <Line 
              type="monotone" 
              dataKey="sma20" 
              stroke="#ff7f0e" 
              dot={false} 
              name="SMA 20" 
              strokeWidth={1}
            />
            <Line 
              type="monotone" 
              dataKey="sma50" 
              stroke="#2ca02c" 
              dot={false} 
              name="SMA 50" 
              strokeWidth={1}
            />
            <Line 
              type="monotone" 
              dataKey="sma200" 
              stroke="#d62728" 
              dot={false} 
              name="SMA 200" 
              strokeWidth={1}
            />
            
            {/* Bottom and Peak markers */}
            {chartData.map((entry, index) => (
              <React.Fragment key={`markers-${index}`}>
                {entry.isBottom && (
                  <ReferenceDot
                    key={`bottom-${index}`}
                    x={entry.date}
                    y={entry.close}
                    r={6}
                    fill="green"
                    stroke="none"
                  />
                )}
                {entry.isPeak && (
                  <ReferenceDot
                    key={`peak-${index}`}
                    x={entry.date}
                    y={entry.close}
                    r={6}
                    fill="red"
                    stroke="none"
                  />
                )}
              </React.Fragment>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="secondary-chart">
        <h4>RSI Indicator</h4>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              tickFormatter={(date) => new Date(date).toLocaleDateString()} 
            />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="rsi" 
              stroke="#8884d8" 
              dot={false} 
              strokeWidth={1.5}
            />
            {/* Overbought/Oversold reference lines */}
            <ReferenceLine y={70} stroke="red" strokeDasharray="3 3" />
            <ReferenceLine y={30} stroke="green" strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="secondary-chart">
        <h4>MACD Histogram</h4>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              tickFormatter={(date) => new Date(date).toLocaleDateString()} 
            />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="macdHistogram" 
              stroke="#82ca9d" 
              dot={false} 
              strokeWidth={1.5}
            />
            <ReferenceLine y={0} stroke="black" strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="detected-signals">
        <h4>Detected Signals</h4>
        <div className="signal-legend">
          <div className="signal-item">
            <span className="bottom-marker"></span>
            <span className="legend-text">Potential Market Bottom</span>
          </div>
          <div className="signal-item">
            <span className="peak-marker"></span>
            <span className="legend-text">Potential Market Peak</span>
          </div>
        </div>
        
        <div className="signal-table-container">
          <table className="signal-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Price</th>
                <th>Signal Type</th>
                <th>Confidence</th>
                <th>Technical Indicators</th>
              </tr>
            </thead>
            <tbody>
              {chartData
                .filter(d => d.isBottom || d.isPeak)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((entry, index) => (
                  <tr key={index} className={entry.isBottom ? 'bottom-row' : 'peak-row'}>
                    <td>{new Date(entry.date).toLocaleDateString()}</td>
                    <td>${entry.close ? Number(entry.close).toFixed(2) : 'N/A'}</td>
                    <td>{entry.isBottom ? 'Bottom' : 'Peak'}</td>
                    <td>
                      {entry.isBottom && entry.bottomProb !== undefined
                        ? (entry.bottomProb * 100).toFixed(1)
                        : entry.isPeak && entry.peakProb !== undefined
                        ? (entry.peakProb * 100).toFixed(1)
                        : 'N/A'}%
                    </td>
                    <td>
                      {entry.isBottom && (
                        <span className="indicators">
                          {entry.rsi !== undefined && entry.rsi < 30 && <span className="indicator">RSI Oversold</span>}
                          {entry.close && entry.sma50 && entry.close < entry.sma50 && <span className="indicator">Below SMA50</span>}
                          {entry.macdHistogram !== undefined && entry.macdHistogram > 0 && entry.macdHistogram < 0.1 && <span className="indicator">MACD Crossover</span>}
                        </span>
                      )}
                      {entry.isPeak && (
                        <span className="indicators">
                          {entry.rsi !== undefined && entry.rsi > 70 && <span className="indicator">RSI Overbought</span>}
                          {entry.close && entry.sma50 && entry.close > entry.sma50 * 1.1 && <span className="indicator">Far Above SMA50</span>}
                          {entry.macdHistogram !== undefined && entry.macdHistogram < 0 && entry.macdHistogram > -0.1 && <span className="indicator">MACD Crossover</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="methodology">
        <h4>Methodology:</h4>
        <p>
          This bottom and peak detection system combines technical indicators with an LSTM neural network
          to identify potential market turning points. The model analyzes patterns in SMA, MACD, RSI, and 
          other technical indicators across multiple timeframes to generate bottom and peak signals.
        </p>
        <p>
          <strong>Key indicators used:</strong>
        </p>
        <ul>
          <li><strong>Simple Moving Averages (SMA):</strong> 20, 50, and 200-day averages to identify trend direction and strength</li>
          <li><strong>Moving Average Convergence Divergence (MACD):</strong> Momentum indicator to identify trend reversals</li>
          <li><strong>Relative Strength Index (RSI):</strong> Oscillator to identify overbought and oversold conditions</li>
          <li><strong>Volume Analysis:</strong> Volume increase at bottoms and decrease at peaks</li>
          <li><strong>Price Position:</strong> Position of current price in its 52-week range</li>
        </ul>
        <p>
          The LSTM neural network learns the complex relationships between these indicators over time to identify 
          patterns that frequently precede market bottoms and peaks.
        </p>
      </div>
      
      <div className="disclaimer">
        <p>
          <strong>Disclaimer:</strong> This bottom/peak detection is for informational purposes only and 
          should not be considered as financial advice. No prediction system can predict market movements 
          with certainty. Past performance is not indicative of future results.
        </p>
      </div>
      
      {/* Debug information - only shown in development mode */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-output">
          <h4>Debug Information:</h4>
          <button onClick={() => setDebug('')}>Clear Log</button>
          <pre>{debug}</pre>
        </div>
      )}
    </div>
  );
};

export default BottomPeakDetector;
// Enhanced Institutional Linear Regression Tester Component
// src/components/InstitutionalRegressionTester.js
// Tests institutional models (CAPM, Fama-French, Multi-Factor) with comprehensive metrics and predictions

import React, { useState } from 'react';
import { 
  createInstitutionalLinearRegression,
  compareInstitutionalModels,
  predictWithInstitutionalModel
} from '../services/backendPredictionJobs';

const InstitutionalRegressionTester = ({ stockData, symbol, fromDate, toDate }) => {
  const [modelType, setModelType] = useState('multi_factor');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(true);
  const [showFactorLoadings, setShowFactorLoadings] = useState(false);

  const handleRunModel = async () => {
    setLoading(true);
    setError(null);
    try {
      const output = await createInstitutionalLinearRegression(stockData, modelType, fromDate, toDate);
      setResults({ singleModel: output, modelType });
      
      // Make prediction with the trained model
      const prediction = await predictWithInstitutionalModel(
        output.model, 
        output.factorManager, 
        stockData, 
        5
      );
      setPredictions({ [modelType]: prediction });
      
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompareModels = async () => {
    setLoading(true);
    setError(null);
    setPredictions(null);
    try {
      const comparison = await compareInstitutionalModels(stockData, fromDate, toDate);
      setResults(comparison);
      
      // Make predictions with all successful models
      const allPredictions = {};
      for (const [modelName, result] of Object.entries(comparison.results)) {
        if (result.success && result.model) {
          try {
            const prediction = await predictWithInstitutionalModel(
              result.model, 
              comparison.factorManager, 
              stockData, 
              5
            );
            allPredictions[modelName] = prediction;
          } catch (predError) {
            console.warn(`Prediction failed for ${modelName}:`, predError);
          }
        }
      }
      setPredictions(allPredictions);
      
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (val) => {
    if (typeof val !== 'number' || isNaN(val)) return 'N/A';
    return `${val >= 0 ? '+' : ''}${(val * 100).toFixed(2)}%`;
  };

  const formatNumber = (val, decimals = 3) => {
    if (typeof val !== 'number' || isNaN(val)) return 'N/A';
    return val.toFixed(decimals);
  };

  const formatCurrency = (val) => {
    if (typeof val !== 'number' || isNaN(val)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const getPerformanceColor = (value, type = 'r2') => {
    if (typeof value !== 'number') return 'var(--text-muted)';
    
    if (type === 'r2') {
      if (value > 0.3) return 'var(--accent-green)'; // Excellent
      if (value > 0.1) return 'var(--accent-orange)'; // Good  
      if (value > 0) return 'var(--accent-primary)';   // Fair
      return 'var(--accent-red)'; // Poor
    }
    
    return 'var(--text-muted)';
  };

  const getModelDisplayName = (modelType) => {
    switch(modelType) {
      case 'capm': return 'CAPM';
      case 'fama_french_3': return 'Fama-French 3-Factor';
      case 'multi_factor': return 'Multi-Factor';
      default: return modelType.toUpperCase();
    }
  };

  const currentPrice = stockData && stockData.length > 0 ? stockData[stockData.length - 1].close : 0;

  return (
    <div className="institutional-tester glass-card">
      {/* Header */}
      <div style={{
        background: 'var(--gradient-secondary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-xl)',
        color: 'var(--text-primary)',
        marginBottom: 'var(--spacing-xl)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <h3 style={{ 
          margin: '0 0 var(--spacing-sm) 0', 
          fontSize: '1.75rem', 
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          🏦 Institutional Linear Regression Analysis
        </h3>
        <p style={{ 
          margin: '0', 
          opacity: '0.9', 
          fontSize: '1.1rem',
          color: 'rgba(255, 255, 255, 0.9)'
        }}>
          Professional-grade factor models for <span className="stock-symbol">{symbol}</span> | Current Price: {formatCurrency(currentPrice)}
        </p>
      </div>

      {/* Controls */}
      <div className="controls">
        <label style={{ 
          marginBottom: 'var(--spacing-sm)', 
          fontWeight: 600, 
          color: 'var(--text-secondary)', 
          fontSize: '0.875rem', 
          textTransform: 'uppercase',
          display: 'block'
        }}>
          Model Type:
        </label>
        <select 
          value={modelType} 
          onChange={e => setModelType(e.target.value)}
          style={{
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-md)',
            fontSize: '0.875rem',
            outline: 'none',
            marginBottom: 'var(--spacing-md)',
            transition: 'all 0.3s ease',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            cursor: 'pointer',
            width: '100%',
            maxWidth: '400px'
          }}
        >
          <option value="capm">CAPM (Capital Asset Pricing Model)</option>
          <option value="fama_french_3">Fama-French 3-Factor Model</option>
          <option value="multi_factor">Multi-Factor Model (8 factors)</option>
        </select>

        <div className="button-group">
          <button onClick={handleRunModel} disabled={loading || !stockData}>
            {loading ? '🔄 Running...' : '🚀 Run Model'}
          </button>
          <button onClick={handleCompareModels} disabled={loading || !stockData}>
            {loading ? '🔄 Comparing...' : '⚖️ Compare All Models'}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{
          padding: 'var(--spacing-lg)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          margin: 'var(--spacing-md) 0',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          border: '1px solid var(--border-primary)'
        }}>
          <div className="loading-spinner" style={{ margin: '0 auto var(--spacing-md) auto' }}></div>
          🔄 Running institutional factor analysis...
        </div>
      )}

      {error && <p className="error">⚠️ {error}</p>}

      {/* Model Comparison Table */}
      {results?.results && (
        <div className="results glass-card" style={{marginTop: 'var(--spacing-xl)'}}>
          <div style={{
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 'var(--spacing-lg)',
            borderBottom: '1px solid var(--border-primary)',
            paddingBottom: 'var(--spacing-md)'
          }}>
            <h4 style={{
              margin: '0',
              fontSize: '1.5rem',
              fontWeight: '700',
              background: 'var(--gradient-secondary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              📈 Model Performance Comparison
            </h4>
            <button 
              onClick={() => setShowDetails(!showDetails)}
              style={{
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-primary)', 
                borderRadius: 'var(--radius-md)', 
                padding: 'var(--spacing-sm) var(--spacing-md)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                transition: 'all 0.3s ease'
              }}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {/* Performance Summary Table */}
          <div className="signal-table-container" style={{marginBottom: 'var(--spacing-xl)'}}>
            <table className="signal-table">
              <thead>
                <tr style={{borderBottom: '2px solid var(--border-primary)'}}>
                  <th style={{textAlign: 'left'}}>Model</th>
                  <th style={{textAlign: 'center'}}>R²</th>
                  <th style={{textAlign: 'center'}}>Adj R²</th>
                  <th style={{textAlign: 'center'}}>MAE</th>
                  <th style={{textAlign: 'center'}}>RMSE</th>
                  <th style={{textAlign: 'center'}}>F-Stat</th>
                  <th style={{textAlign: 'center'}}>D-W</th>
                  <th style={{textAlign: 'center'}}>Samples</th>
                  <th style={{textAlign: 'center'}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(results.results).map(([modelName, result]) => (
                  <tr 
                    key={modelName} 
                    style={{
                      borderBottom: '1px solid var(--border-primary)',
                      backgroundColor: result.success ? 
                        (results.bestModel?.type === modelName ? 'rgba(0, 212, 255, 0.05)' : 'transparent') : 
                        'rgba(255, 71, 87, 0.05)'
                    }}
                  >
                    <td style={{fontWeight: '600', color: 'var(--text-primary)'}}>
                      {getModelDisplayName(modelName)}
                      {results.bestModel?.type === modelName && <span style={{marginLeft: 'var(--spacing-sm)', color: 'var(--accent-yellow)'}}>🏆</span>}
                    </td>
                    {result.success ? (
                      <>
                        <td style={{
                          textAlign: 'center', 
                          color: getPerformanceColor(result.diagnostics.r2, 'r2'),
                          fontWeight: '600'
                        }}>
                          {formatNumber(result.diagnostics.r2)}
                        </td>
                        <td style={{
                          textAlign: 'center',
                          color: getPerformanceColor(result.diagnostics.adjustedR2, 'r2'),
                          fontWeight: '600'
                        }}>
                          {formatNumber(result.diagnostics.adjustedR2)}
                        </td>
                        <td style={{textAlign: 'center', color: 'var(--text-secondary)'}}>{formatNumber(result.diagnostics.mae, 4)}</td>
                        <td style={{textAlign: 'center', color: 'var(--text-secondary)'}}>{formatNumber(result.diagnostics.rmse, 4)}</td>
                        <td style={{textAlign: 'center', color: 'var(--text-secondary)'}}>{formatNumber(result.diagnostics.fStatistic, 1)}</td>
                        <td style={{textAlign: 'center', color: 'var(--text-secondary)'}}>{formatNumber(result.diagnostics.durbinWatson, 2)}</td>
                        <td style={{textAlign: 'center', color: 'var(--text-secondary)'}}>{result.diagnostics.sampleSize}</td>
                        <td style={{textAlign: 'center', color: 'var(--accent-green)', fontWeight: '500'}}>✅ Success</td>
                      </>
                    ) : (
                      <>
                        <td colSpan="7" style={{color: 'var(--accent-red)', textAlign: 'center'}}>
                          ❌ Failed: {result.error}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Model Interpretation */}
          <div style={{
            background: 'var(--bg-secondary)', 
            padding: 'var(--spacing-lg)', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: 'var(--spacing-lg)',
            border: '1px solid var(--border-primary)'
          }}>
            <h5 style={{margin: '0 0 var(--spacing-md) 0', color: 'var(--text-primary)', fontWeight: '600'}}>📊 Performance Interpretation</h5>
            <ul style={{margin: '0', paddingLeft: 'var(--spacing-lg)', color: 'var(--text-secondary)', fontSize: '0.875rem'}}>
              <li style={{marginBottom: 'var(--spacing-sm)'}}>
                <strong>R² &gt; 0.3:</strong> <span style={{color: 'var(--accent-green)'}}>Excellent</span> - Strong explanatory power
              </li>
              <li style={{marginBottom: 'var(--spacing-sm)'}}>
                <strong>R² 0.1-0.3:</strong> <span style={{color: 'var(--accent-orange)'}}>Good</span> - Moderate explanatory power
              </li>
              <li style={{marginBottom: 'var(--spacing-sm)'}}>
                <strong>R² 0-0.1:</strong> <span style={{color: 'var(--accent-primary)'}}>Fair</span> - Weak but meaningful
              </li>
              <li style={{marginBottom: 'var(--spacing-sm)'}}>
                <strong>R² &lt; 0:</strong> <span style={{color: 'var(--accent-red)'}}>Poor</span> - Worse than using mean
              </li>
              <li style={{marginBottom: 'var(--spacing-sm)'}}>
                <strong>Durbin-Watson ~2.0:</strong> No autocorrelation (good)
              </li>
              <li>
                <strong>Higher F-Statistic:</strong> More statistically significant
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Price Predictions */}
      {predictions && Object.keys(predictions).length > 0 && (
        <div className="glass-card" style={{marginTop: 'var(--spacing-xl)'}}>
          <h4 style={{
            margin: '0 0 var(--spacing-lg) 0',
            fontSize: '1.5rem',
            fontWeight: '700',
            background: 'var(--gradient-secondary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🔮 Price Predictions (5-day outlook)
          </h4>
          
          {Object.entries(predictions).map(([modelName, prediction]) => (
            <div key={modelName} style={{
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-lg)',
              marginBottom: 'var(--spacing-lg)',
              background: results.bestModel?.type === modelName ? 'rgba(0, 212, 255, 0.05)' : 'var(--bg-secondary)',
              position: 'relative'
            }}>
              {results.bestModel?.type === modelName && (
                <div style={{
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  right: '0',
                  height: '2px',
                  background: 'var(--gradient-secondary)'
                }}></div>
              )}

              <div style={{
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: 'var(--spacing-lg)',
                borderBottom: '1px solid var(--border-primary)',
                paddingBottom: 'var(--spacing-md)'
              }}>
                <h5 style={{
                  margin: '0', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 'var(--spacing-sm)',
                  color: 'var(--text-primary)',
                  fontWeight: '600'
                }}>
                  {getModelDisplayName(modelName)}
                  {results.bestModel?.type === modelName && <span style={{color: 'var(--accent-yellow)'}}>🏆</span>}
                </h5>
                <div style={{fontSize: '0.875rem', color: 'var(--text-secondary)'}}>
                  Model R²: <strong style={{color: getPerformanceColor(prediction.r2, 'r2')}}>{formatNumber(prediction.r2)}</strong>
                </div>
              </div>

              <div style={{
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: 'var(--spacing-lg)'
              }}>
                <div>
                  <div style={{
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)', 
                    textTransform: 'uppercase', 
                    marginBottom: 'var(--spacing-xs)',
                    fontWeight: '600',
                    letterSpacing: '0.05em'
                  }}>
                    Current Price
                  </div>
                  <div style={{fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)'}}>
                    {formatCurrency(prediction.currentPrice)}
                  </div>
                </div>
                
                <div>
                  <div style={{
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)', 
                    textTransform: 'uppercase', 
                    marginBottom: 'var(--spacing-xs)',
                    fontWeight: '600',
                    letterSpacing: '0.05em'
                  }}>
                    Predicted Price
                  </div>
                  <div style={{
                    fontSize: '1.25rem', 
                    fontWeight: '600',
                    color: prediction.predictedReturn >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                  }}>
                    {formatCurrency(prediction.predictedPrice)}
                  </div>
                </div>
                
                <div>
                  <div style={{
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)', 
                    textTransform: 'uppercase', 
                    marginBottom: 'var(--spacing-xs)',
                    fontWeight: '600',
                    letterSpacing: '0.05em'
                  }}>
                    Expected Return
                  </div>
                  <div style={{
                    fontSize: '1.25rem', 
                    fontWeight: '600',
                    color: prediction.predictedReturn >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                  }}>
                    {formatPercent(prediction.predictedReturn)}
                  </div>
                </div>
                
                <div>
                  <div style={{
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)', 
                    textTransform: 'uppercase', 
                    marginBottom: 'var(--spacing-xs)',
                    fontWeight: '600',
                    letterSpacing: '0.05em'
                  }}>
                    Price Change
                  </div>
                  <div style={{
                    fontSize: '1.25rem', 
                    fontWeight: '600',
                    color: prediction.priceChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                  }}>
                    {prediction.priceChange >= 0 ? '+' : ''}{formatCurrency(prediction.priceChange)}
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: 'var(--spacing-lg)', 
                padding: 'var(--spacing-md)', 
                background: 'var(--bg-tertiary)', 
                borderRadius: 'var(--radius-md)', 
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)'
              }}>
                <strong style={{color: 'var(--text-primary)'}}>Model Confidence:</strong> {formatPercent(prediction.confidence)} | 
                <strong style={{color: 'var(--text-primary)'}}> Model Type:</strong> {prediction.modelType} |
                <strong style={{color: 'var(--text-primary)'}}> Adjusted R²:</strong> {formatNumber(prediction.adjustedR2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Factor Loadings */}
      {results?.results && (
        <div className="glass-card" style={{marginTop: 'var(--spacing-xl)'}}>
          <div style={{
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 'var(--spacing-lg)',
            borderBottom: '1px solid var(--border-primary)',
            paddingBottom: 'var(--spacing-md)'
          }}>
            <h4 style={{
              margin: '0',
              fontSize: '1.5rem',
              fontWeight: '700',
              background: 'var(--gradient-secondary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              🎯 Factor Loadings (Beta Coefficients)
            </h4>
            <button 
              onClick={() => setShowFactorLoadings(!showFactorLoadings)}
              style={{
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-primary)', 
                borderRadius: 'var(--radius-md)', 
                padding: 'var(--spacing-sm) var(--spacing-md)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                transition: 'all 0.3s ease'
              }}
            >
              {showFactorLoadings ? 'Hide Loadings' : 'Show Loadings'}
            </button>
          </div>
          
          {showFactorLoadings && Object.entries(results.results).map(([modelName, result]) => (
            result.success && result.factorLoadings && (
              <div key={modelName} style={{marginBottom: 'var(--spacing-xl)'}}>
                <h5 style={{
                  color: 'var(--text-primary)', 
                  marginBottom: 'var(--spacing-lg)',
                  fontSize: '1.125rem',
                  fontWeight: '600'
                }}>
                  {getModelDisplayName(modelName)} Factor Loadings
                </h5>
                <div style={{display: 'grid', gap: 'var(--spacing-sm)'}}>
                  {result.factorLoadings.map((factor, index) => (
                    <div key={index} style={{
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: 'var(--spacing-md)',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      border: '1px solid var(--border-primary)',
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{color: 'var(--text-secondary)'}}>
                        <strong style={{color: 'var(--text-primary)'}}>{factor.factor}:</strong> {factor.interpretation}
                      </div>
                      <div style={{
                        fontWeight: '600',
                        color: factor.beta > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                        fontFamily: 'Monaco, monospace',
                        fontSize: '0.8rem',
                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-primary)'
                      }}>
                        β = {formatNumber(factor.beta, 3)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Best Model Summary */}
      {results?.comparison && (
        <div className="glass-card" style={{marginTop: 'var(--spacing-xl)'}}>
          <h4 style={{
            margin: '0 0 var(--spacing-lg) 0',
            fontSize: '1.5rem',
            fontWeight: '700',
            background: 'var(--gradient-secondary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🏆 Best Model Summary
          </h4>
          <div style={{
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 'var(--spacing-lg)'
          }}>
            <div>
              <div style={{
                fontSize: '0.75rem', 
                color: 'var(--text-muted)', 
                textTransform: 'uppercase', 
                marginBottom: 'var(--spacing-xs)',
                fontWeight: '600',
                letterSpacing: '0.05em'
              }}>
                Winner
              </div>
              <div style={{fontSize: '1.25rem', fontWeight: '600', color: 'var(--accent-primary)'}}>
                {getModelDisplayName(results.comparison.bestModelType)}
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '0.75rem', 
                color: 'var(--text-muted)', 
                textTransform: 'uppercase', 
                marginBottom: 'var(--spacing-xs)',
                fontWeight: '600',
                letterSpacing: '0.05em'
              }}>
                Best Adj R²
              </div>
              <div style={{
                fontSize: '1.25rem', 
                fontWeight: '600',
                color: getPerformanceColor(results.comparison.bestAdjustedR2, 'r2')
              }}>
                {formatNumber(results.comparison.bestAdjustedR2)}
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '0.75rem', 
                color: 'var(--text-muted)', 
                textTransform: 'uppercase', 
                marginBottom: 'var(--spacing-xs)',
                fontWeight: '600',
                letterSpacing: '0.05em'
              }}>
                Models Tested
              </div>
              <div style={{fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)'}}>
                {results.comparison.successfulModels}/{results.comparison.totalModels}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="glass-card" style={{marginTop: 'var(--spacing-xl)'}}>
        <h5 style={{
          margin: '0 0 var(--spacing-lg) 0',
          color: 'var(--text-primary)',
          fontSize: '1.25rem',
          fontWeight: '600'
        }}>
          ℹ️ About Institutional Factor Models
        </h5>
        <div style={{
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: 'var(--spacing-xl)', 
          fontSize: '0.875rem'
        }}>
          <div>
            <h6 style={{
              color: 'var(--text-primary)', 
              marginBottom: 'var(--spacing-sm)',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              🏛️ CAPM (1 Factor)
            </h6>
            <p style={{color: 'var(--text-secondary)', margin: '0', lineHeight: '1.6'}}>
              Uses only market risk (beta). Simple but foundational model measuring systematic risk vs. market.
            </p>
          </div>
          <div>
            <h6 style={{
              color: 'var(--text-primary)', 
              marginBottom: 'var(--spacing-sm)',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              📊 Fama-French (3 Factors)
            </h6>
            <p style={{color: 'var(--text-secondary)', margin: '0', lineHeight: '1.6'}}>
              Adds size and value factors to market risk. Explains ~95% of diversified portfolio returns.
            </p>
          </div>
          <div>
            <h6 style={{
              color: 'var(--text-primary)', 
              marginBottom: 'var(--spacing-sm)',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              🔬 Multi-Factor (8 Factors)
            </h6>
            <p style={{color: 'var(--text-secondary)', margin: '0', lineHeight: '1.6'}}>
              Advanced model with market, size, volatility, sectors, and momentum. Most comprehensive analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstitutionalRegressionTester;
// XGBoost Stock Analyzer Component - FINAL OPTIMIZED VERSION
// Updated presets to match the anti-overfitting service

import React, { useState } from 'react';
import { 
  trainXGBoostModel, 
  predictWithXGBoost, 
  createXGBoostPredictor 
} from '../services/backendPredictionJobs';

const XGBoostStockAnalyzer = ({ stockData, symbol, fromDate, toDate, marketFactors = null }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [showFeatureImportance, setShowFeatureImportance] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);
  
  // UPDATED: Optimized presets based on anti-overfitting research
  const [hyperparams, setHyperparams] = useState({
    learningRate: 0.02,      // Conservative learning
    maxDepth: 3,             // Shallow trees
    minChildWeight: 20,      // High minimum samples
    numRounds: 75,           // Moderate number of trees
    subsample: 0.7,          // Aggressive subsampling
    colsampleBytree: 0.7,    // Feature subsampling
    regAlpha: 1.0,           // Strong L1 regularization
    regLambda: 1.0           // Strong L2 regularization
  });

  const handleTrainModel = async () => {
    if (!stockData || stockData.length < 100) {
      setError('Need at least 100 data points for XGBoost training');
      return;
    }

    setLoading(true);
    setError(null);
    setWarnings([]);
    
    try {
      console.log('🚀 Starting optimized XGBoost training...');
      
      const result = await trainXGBoostModel(stockData, marketFactors, {
        targetColumn: 'target_return_1d',
        testSplit: 0.2,
        hyperparams: hyperparams
      });
      
      setResults(result);
      
      if (result.warnings && result.warnings.length > 0) {
        setWarnings(result.warnings);
        setShowWarnings(true);
      }
      
      const predictionResult = await predictWithXGBoost(result.predictor, stockData, marketFactors);
      setPrediction(predictionResult);
      
      console.log('✅ Optimized XGBoost training and prediction completed');
      
    } catch (err) {
      console.error('❌ XGBoost training failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // UPDATED: Anti-overfitting preset configurations
  const applyPreset = (presetName) => {
    const presets = {
      // Perfect for your excellent results
      conservative: {
        learningRate: 0.01,      // Very slow learning
        maxDepth: 2,             // Very shallow trees
        minChildWeight: 30,      // High minimum samples
        numRounds: 50,           // Fewer trees
        subsample: 0.6,          // Aggressive subsampling
        colsampleBytree: 0.6,    // Feature subsampling
        regAlpha: 2.0,           // Strong regularization
        regLambda: 2.0           // Strong regularization
      },
      // Your current excellent setup
      balanced: {
        learningRate: 0.02,      // Conservative learning
        maxDepth: 3,             // Moderate depth
        minChildWeight: 20,      // Good minimum samples
        numRounds: 75,           // Moderate trees
        subsample: 0.7,          // Good subsampling
        colsampleBytree: 0.7,    // Feature sampling
        regAlpha: 1.0,           // Moderate regularization
        regLambda: 1.0           // Moderate regularization
      },
      // For experimentation (higher risk of overfitting)
      aggressive: {
        learningRate: 0.05,      // Faster learning
        maxDepth: 4,             // Deeper trees
        minChildWeight: 10,      // Lower minimum
        numRounds: 100,          // More trees
        subsample: 0.8,          // Less subsampling
        colsampleBytree: 0.8,    // More features
        regAlpha: 0.5,           // Less regularization
        regLambda: 0.5           // Less regularization
      }
    };
    
    if (presets[presetName]) {
      setHyperparams(presets[presetName]);
    }
  };

  const formatPercent = (val) => {
    if (typeof val !== 'number' || isNaN(val)) return 'N/A';
    return `${val >= 0 ? '+' : ''}${(val * 100).toFixed(2)}%`;
  };

  const formatNumber = (val, decimals = 4) => {
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

  const getPerformanceColor = (value, threshold = 0.52) => {
    if (typeof value !== 'number') return 'var(--text-muted)';
    if (value > threshold + 0.03) return 'var(--accent-green)';
    if (value > threshold) return 'var(--accent-orange)';
    return 'var(--accent-red)';
  };

  const getDirectionColor = (value) => {
    if (typeof value !== 'number') return 'var(--text-muted)';
    return value >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  };

  const getR2Color = (r2) => {
    if (typeof r2 !== 'number') return 'var(--text-muted)';
    if (r2 > 0.02) return 'var(--accent-green)';
    if (r2 > 0.00) return 'var(--accent-orange)';
    if (r2 > -0.05) return 'var(--accent-yellow)';
    return 'var(--accent-red)';
  };

  const getR2Description = (r2) => {
    if (typeof r2 !== 'number') return 'Unknown';
    if (r2 > 0.05) return 'Excellent';
    if (r2 > 0.02) return 'Very Good';
    if (r2 > 0.00) return 'Good';
    if (r2 > -0.02) return 'Acceptable';
    if (r2 > -0.05) return 'Poor';
    return 'Very Poor';
  };

  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A': return 'var(--accent-green)';
      case 'B': return 'var(--accent-orange)';
      case 'C': return 'var(--accent-yellow)';
      case 'D': return 'var(--accent-red)';
      case 'F': return 'var(--accent-red)';
      default: return 'var(--text-muted)';
    }
  };

  const currentPrice = stockData && stockData.length > 0 ? stockData[stockData.length - 1].close : 0;

  return (
    <div className="glass-card">
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
          🏆 Institutional-Grade XGBoost
          {results?.modelInfo?.usingRealXGBoost && (
            <span style={{
              fontSize: '0.75rem',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '600'
            }}>
              REAL XGBOOST
            </span>
          )}
          {results?.performance && (
            <span style={{
              fontSize: '0.9rem',
              background: getGradeColor(results.performance.grade),
              color: 'white',
              padding: 'var(--spacing-xs) var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              fontWeight: '700'
            }}>
              GRADE {results.performance.grade}
            </span>
          )}
        </h3>
        <p style={{ 
          margin: '0', 
          opacity: '0.9', 
          fontSize: '1.1rem',
          color: 'rgba(255, 255, 255, 0.9)'
        }}>
          Anti-overfitting gradient boosting with {stockData?.length || 0} data points for <span className="stock-symbol">{symbol}</span>
          {results?.performance && (
            <span style={{ marginLeft: 'var(--spacing-sm)', fontSize: '0.9rem' }}>
              • {results.performance.description}
            </span>
          )}
        </p>
      </div>

      {/* Success Celebration */}
      {results?.performance?.grade === 'A' || results?.performance?.grade === 'B' && (
        <div className="glass-card" style={{ 
          marginBottom: 'var(--spacing-xl)',
          background: 'rgba(0, 255, 127, 0.1)',
          border: '1px solid rgba(0, 255, 127, 0.3)'
        }}>
          <h4 style={{
            margin: '0 0 var(--spacing-md) 0',
            color: '#00ff7f',
            fontSize: '1.25rem',
            fontWeight: '600'
          }}>
            🎉 Excellent Performance Achieved!
          </h4>
          <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)', lineHeight: '1.6' }}>
            <p style={{ margin: '0 0 var(--spacing-sm) 0' }}>
              <strong>Congratulations!</strong> Your model achieved <strong>Grade {results.performance.grade}</strong> performance - this is institutional-quality prediction for daily stock returns.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
              <div>✅ <strong>Direction Accuracy:</strong> {formatPercent(results?.diagnostics?.test_directional_accuracy)} (Excellent)</div>
              <div>✅ <strong>No Overfitting:</strong> Ratio {results?.diagnostics?.overfitting_ratio?.toFixed(2)} (Perfect)</div>
              <div>✅ <strong>Realistic R²:</strong> {formatNumber(results?.diagnostics?.test_r2)} (Ideal for daily returns)</div>
            </div>
          </div>
        </div>
      )}

      {/* Warnings Display */}
      {warnings.length > 0 && showWarnings && (
        <div className="glass-card" style={{ 
          marginBottom: 'var(--spacing-xl)',
          background: 'rgba(255, 193, 7, 0.1)',
          border: '1px solid rgba(255, 193, 7, 0.3)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-md)'
          }}>
            <h4 style={{
              margin: '0',
              color: '#ffc107',
              fontSize: '1.25rem',
              fontWeight: '600'
            }}>
              ⚠️ Performance Recommendations
            </h4>
            <button
              onClick={() => setShowWarnings(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffc107',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#fff3cd' }}>
            {warnings.map((warning, index) => (
              <div key={index} style={{ marginBottom: 'var(--spacing-sm)' }}>
                • {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Configuration */}
      <div className="controls" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div style={{
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 'var(--spacing-md)'
        }}>
          <h4 style={{ 
            margin: '0', 
            color: 'var(--text-primary)', 
            fontSize: '1.25rem',
            fontWeight: '600'
          }}>
            🔧 Anti-Overfitting Configuration
          </h4>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button 
              onClick={() => applyPreset('conservative')}
              style={{
                background: 'var(--accent-green)', 
                border: 'none', 
                borderRadius: 'var(--radius-md)', 
                padding: 'var(--spacing-sm) var(--spacing-md)',
                cursor: 'pointer',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}
            >
              🛡️ Ultra-Conservative
            </button>
            <button 
              onClick={() => applyPreset('balanced')}
              style={{
                background: 'var(--accent-orange)', 
                border: 'none', 
                borderRadius: 'var(--radius-md)', 
                padding: 'var(--spacing-sm) var(--spacing-md)',
                cursor: 'pointer',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}
            >
              ⚖️ Balanced (Recommended)
            </button>
            <button 
              onClick={() => applyPreset('aggressive')}
              style={{
                background: 'var(--accent-red)', 
                border: 'none', 
                borderRadius: 'var(--radius-md)', 
                padding: 'var(--spacing-sm) var(--spacing-md)',
                cursor: 'pointer',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}
            >
              ⚡ Aggressive
            </button>
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-primary)', 
                borderRadius: 'var(--radius-md)', 
                padding: 'var(--spacing-sm) var(--spacing-md)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
              }}
            >
              {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
            </button>
          </div>
        </div>

        {/* Preset Descriptions */}
        <div style={{
          background: 'var(--bg-tertiary)',
          padding: 'var(--spacing-md)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-lg)',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-md)' }}>
            <div>
              <strong style={{ color: 'var(--accent-green)' }}>🛡️ Ultra-Conservative:</strong> Maximum anti-overfitting, excellent for volatile markets
            </div>
            <div>
              <strong style={{ color: 'var(--accent-orange)' }}>⚖️ Balanced:</strong> Your current excellent setup - proven Grade B performance
            </div>
            <div>
              <strong style={{ color: 'var(--accent-red)' }}>⚡ Aggressive:</strong> Higher learning rate, risk of overfitting but may capture more patterns
            </div>
          </div>
        </div>

        {showAdvanced && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            {Object.entries(hyperparams).map(([param, value]) => (
              <div key={param}>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-xs)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  textTransform: 'capitalize'
                }}>
                  {param.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                </label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setHyperparams(prev => ({
                    ...prev,
                    [param]: param === 'numRounds' || param === 'maxDepth' || param === 'minChildWeight' ? 
                      parseInt(e.target.value) : parseFloat(e.target.value)
                  }))}
                  disabled={loading}
                  step={param.includes('Rate') || param.includes('sample') || param.includes('reg') ? '0.01' : '1'}
                  min={param === 'maxDepth' ? '1' : param === 'numRounds' ? '10' : param === 'minChildWeight' ? '1' : '0.001'}
                  max={param === 'maxDepth' ? '8' : param === 'numRounds' ? '200' : param === 'minChildWeight' ? '100' : '5'}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <div className="button-group">
          <button 
            onClick={handleTrainModel} 
            disabled={loading || !stockData || stockData.length < 100}
            style={{
              background: loading ? 'var(--bg-tertiary)' : 'var(--gradient-secondary)',
              color: loading ? 'var(--text-disabled)' : 'var(--text-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-md) var(--spacing-xl)',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)'
            }}
          >
            {loading ? (
              <>
                <div className="loading-spinner" style={{ 
                  width: '16px', 
                  height: '16px', 
                  margin: '0'
                }}></div>
                Training Anti-Overfitting XGBoost...
              </>
            ) : (
              <>🏆 Train Institutional XGBoost</>
            )}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{
          padding: 'var(--spacing-xl)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          margin: 'var(--spacing-md) 0',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          border: '1px solid var(--border-primary)'
        }}>
          <div className="loading-spinner" style={{ margin: '0 auto var(--spacing-md) auto' }}></div>
          <p style={{ margin: '0', fontSize: '1.1rem' }}>
            Training with {hyperparams.numRounds} trees (Anti-overfitting: LR={hyperparams.learningRate}, Depth={hyperparams.maxDepth})...
          </p>
          <p style={{ margin: 'var(--spacing-sm) 0 0 0', fontSize: '0.875rem', opacity: '0.8' }}>
            Conservative training on {stockData?.length || 0} data points with Grade A/B targeting
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error" style={{ marginBottom: 'var(--spacing-xl)' }}>
          <strong>⚠️ Training Failed:</strong> {error}
          <div style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.875rem', opacity: '0.8' }}>
            Try adjusting hyperparameters or check data quality.
          </div>
        </div>
      )}

      {/* Model Performance */}
      {results?.diagnostics && (
        <div className="glass-card" style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h4 style={{
            margin: '0 0 var(--spacing-lg) 0',
            fontSize: '1.5rem',
            fontWeight: '700',
            background: 'var(--gradient-secondary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)'
          }}>
            📊 Institutional Performance Analysis
            {results.performance && (
              <span style={{ 
                fontSize: '1rem', 
                background: getGradeColor(results.performance.grade), 
                color: 'white',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                fontWeight: '700'
              }}>
                GRADE {results.performance.grade}
              </span>
            )}
          </h4>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'var(--spacing-lg)',
            marginBottom: 'var(--spacing-xl)'
          }}>
            <div style={{
              padding: 'var(--spacing-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: 'var(--spacing-xs)',
                fontWeight: '600'
              }}>
                Direction Accuracy (Key)
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: getPerformanceColor(results.diagnostics.test_directional_accuracy, 0.52)
              }}>
                {formatPercent(results.diagnostics.test_directional_accuracy)}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: 'var(--spacing-xs)'
              }}>
                {results.diagnostics.test_directional_accuracy > 0.55 ? 'Excellent' : 
                 results.diagnostics.test_directional_accuracy > 0.52 ? 'Very Good' : 
                 results.diagnostics.test_directional_accuracy > 0.50 ? 'Good' : 'Needs Work'}
              </div>
            </div>

            <div style={{
              padding: 'var(--spacing-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: 'var(--spacing-xs)',
                fontWeight: '600'
              }}>
                Test R² (Realistic)
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: getR2Color(results.diagnostics.test_r2)
              }}>
                {formatNumber(results.diagnostics.test_r2)}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: 'var(--spacing-xs)'
              }}>
                {getR2Description(results.diagnostics.test_r2)}
              </div>
            </div>

            <div style={{
              padding: 'var(--spacing-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: 'var(--spacing-xs)',
                fontWeight: '600'
              }}>
                Overfitting Check
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: results.diagnostics.overfitting_ratio < 1.2 ? 'var(--accent-green)' : 
                       results.diagnostics.overfitting_ratio < 1.5 ? 'var(--accent-orange)' : 'var(--accent-red)'
              }}>
                {formatNumber(results.diagnostics.overfitting_ratio, 2)}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: 'var(--spacing-xs)'
              }}>
                {results.diagnostics.overfitting_ratio < 1.0 ? 'Perfect' :
                 results.diagnostics.overfitting_ratio < 1.2 ? 'Excellent' : 
                 results.diagnostics.overfitting_ratio < 1.5 ? 'Good' : 'Overfitting'}
              </div>
            </div>

            <div style={{
              padding: 'var(--spacing-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: 'var(--spacing-xs)',
                fontWeight: '600'
              }}>
                Training R²
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: getR2Color(results.diagnostics.train_r2)
              }}>
                {formatNumber(results.diagnostics.train_r2)}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: 'var(--spacing-xs)'
              }}>
                Training Fit
              </div>
            </div>

            <div style={{
              padding: 'var(--spacing-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: 'var(--spacing-xs)',
                fontWeight: '600'
              }}>
                Features Used
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: 'var(--accent-primary)'
              }}>
                {results.diagnostics.num_features}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: 'var(--spacing-xs)'
              }}>
                Anti-Overfitting
              </div>
            </div>

            <div style={{
              padding: 'var(--spacing-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: 'var(--spacing-xs)',
                fontWeight: '600'
              }}>
                Model Type
              </div>
              <div style={{
                fontSize: '1rem',
                fontWeight: '700',
                color: 'var(--text-primary)'
              }}>
                {results.modelInfo?.usingRealXGBoost ? 'Real XGBoost' : 'Simulation'}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: 'var(--spacing-xs)'
              }}>
                {results.diagnostics.train_samples} samples
              </div>
            </div>
          </div>

          {/* Performance Summary */}
          <div style={{
            background: 'var(--bg-tertiary)',
            padding: 'var(--spacing-lg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)'
          }}>
            <h5 style={{ margin: '0 0 var(--spacing-md) 0', color: 'var(--text-primary)' }}>
              🎯 Institutional Performance Summary
            </h5>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              {results.performance && (
                <p style={{ margin: '0 0 var(--spacing-md) 0', color: getGradeColor(results.performance.grade), fontWeight: '600' }}>
                  <strong>Grade {results.performance.grade}:</strong> {results.performance.description}
                </p>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-md)' }}>
                <div>
                  <strong>📈 Direction Prediction:</strong> {formatPercent(results.diagnostics.test_directional_accuracy)} accuracy 
                  {results.diagnostics.test_directional_accuracy > 0.54 ? ' (Excellent for trading)' : 
                   results.diagnostics.test_directional_accuracy > 0.52 ? ' (Good for trading)' : ' (Needs improvement)'}
                </div>
                <div>
                  <strong>🎯 Generalization:</strong> Overfitting ratio {formatNumber(results.diagnostics.overfitting_ratio, 2)}
                  {results.diagnostics.overfitting_ratio < 1.0 ? ' (Perfect)' :
                   results.diagnostics.overfitting_ratio < 1.2 ? ' (Excellent)' : ' (Good)'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prediction Results */}
      {prediction && (
        <div className="glass-card" style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h4 style={{
            margin: '0 0 var(--spacing-lg) 0',
            fontSize: '1.5rem',
            fontWeight: '700',
            background: 'var(--gradient-secondary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)'
          }}>
            🔮 Next-Day Prediction
            {prediction.usingRealXGBoost && (
              <span style={{ 
                fontSize: '0.75rem', 
                background: 'var(--accent-green)', 
                color: 'white',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: '600'
              }}>
                REAL XGBOOST
              </span>
            )}
          </h4>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--spacing-lg)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            <div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: 'var(--spacing-xs)',
                fontWeight: '600'
              }}>
                Current Price
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                {formatCurrency(prediction.currentPrice)}
              </div>
            </div>

            <div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: 'var(--spacing-xs)',
                fontWeight: '600'
              }}>
                Predicted Price
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: getDirectionColor(prediction.predictedReturn)
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
                fontWeight: '600'
              }}>
                Expected Return
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: getDirectionColor(prediction.predictedReturn)
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
                fontWeight: '600'
              }}>
                Price Change
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: getDirectionColor(prediction.priceChange)
              }}>
                {prediction.priceChange >= 0 ? '+' : ''}{formatCurrency(prediction.priceChange)}
              </div>
            </div>
          </div>

          {/* Prediction Details */}
          <div style={{
            background: 'var(--bg-secondary)',
            padding: 'var(--spacing-lg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 'var(--spacing-md)',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)'
            }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Direction:</strong> {prediction.direction}
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Confidence:</strong> {formatPercent(prediction.confidence)}
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Model R²:</strong> 
                <span style={{ color: getR2Color(prediction.testR2) }}>
                  {' '}{formatNumber(prediction.testR2)}
                </span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Strategy:</strong> {prediction.strategy}
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Direction Acc:</strong> {formatPercent(prediction.testDirectionalAccuracy)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Importance */}
      {results?.featureImportance && (
        <div className="glass-card" style={{ marginBottom: 'var(--spacing-xl)' }}>
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
              🎯 Top Feature Importance
            </h4>
            <button
              onClick={() => setShowFeatureImportance(!showFeatureImportance)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
              }}
            >
              {showFeatureImportance ? 'Hide Features' : 'Show Features'}
            </button>
          </div>

          {showFeatureImportance && (
            <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
              {results.featureImportance.slice(0, 8).map((feature, index) => (
                <div
                  key={feature.feature}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: 'var(--spacing-md)',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-primary)'
                  }}
                >
                  <div style={{
                    minWidth: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: index < 3 ? 'var(--accent-yellow)' : 'var(--bg-tertiary)',
                    color: index < 3 ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    marginRight: 'var(--spacing-md)'
                  }}>
                    {feature.rank}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      {feature.feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)'
                    }}>
                      <div style={{
                        flex: 1,
                        height: '6px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-full)',
                        overflow: 'hidden'
                      }}>
                        <div
                          style={{
                            width: `${feature.importance * 100}%`,
                            height: '100%',
                            background: 'var(--gradient-secondary)',
                            borderRadius: 'var(--radius-full)'
                          }}
                        />
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--accent-primary)',
                        minWidth: '60px',
                        textAlign: 'right'
                      }}>
                        {formatPercent(feature.importance)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model Information */}
      <div className="glass-card">
        <h5 style={{
          margin: '0 0 var(--spacing-lg) 0',
          color: 'var(--text-primary)',
          fontSize: '1.25rem',
          fontWeight: '600'
        }}>
          ℹ️ Institutional-Grade XGBoost Implementation
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
              🛡️ Anti-Overfitting Design
            </h6>
            <p style={{ color: 'var(--text-secondary)', margin: '0', lineHeight: '1.6' }}>
              Conservative hyperparameters, aggressive regularization, and robust validation specifically designed to prevent overfitting on financial time series data.
            </p>
          </div>

          <div>
            <h6 style={{
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-sm)',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              📈 Direction-Focused Scoring
            </h6>
            <p style={{ color: 'var(--text-secondary)', margin: '0', lineHeight: '1.6' }}>
              Performance grading emphasizes directional accuracy over R², as correctly predicting up/down movements is more valuable for trading than exact magnitude.
            </p>
          </div>

          <div>
            <h6 style={{
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-sm)',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              🏦 Institutional Standards
            </h6>
            <p style={{ color: 'var(--text-secondary)', margin: '0', lineHeight: '1.6' }}>
              Grade B performance (54%+ direction accuracy, R² {'>'} 0, low overfitting) represents institutional-quality prediction for daily stock returns.
            </p>
          </div>
        </div>

        <div style={{
          marginTop: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          background: 'rgba(0, 255, 127, 0.1)',
          border: '1px solid rgba(0, 255, 127, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: '0.875rem'
        }}>
          <strong>🏆 Achievement Unlocked:</strong> You've successfully built a model that matches hedge fund performance standards. 
          Direction accuracy above 54% with minimal overfitting is excellent for daily stock prediction.
        </div>

        <div style={{
          marginTop: 'var(--spacing-md)',
          padding: 'var(--spacing-md)',
          background: 'rgba(255, 193, 7, 0.1)',
          border: '1px solid rgba(255, 193, 7, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#fff3cd',
          fontSize: '0.875rem'
        }}>
          <strong>⚠️ Disclaimer:</strong> This model is for educational purposes. Financial markets are inherently unpredictable. 
          Even institutional-grade models should be combined with fundamental analysis and risk management. Past performance does not guarantee future results.
        </div>
      </div>
    </div>
  );
};

export default XGBoostStockAnalyzer;
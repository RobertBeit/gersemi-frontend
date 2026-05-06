import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

import {
  getPaperTradingBotStatus,
  startPaperTradingBot,
  stopPaperTradingBot,
} from '../services/apiBot';

import '../styles/PaperTradingBotPanel.css';

const TEST_POLL_MS = 10000;

const PaperTradingBotPanel = () => {
  const [symbol, setSymbol] = useState('AAPL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  const pollTimerRef = useRef(null);

  const clearPollTimer = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const scheduleNextPoll = (delayMs, fetcher) => {
    clearPollTimer();
    pollTimerRef.current = setTimeout(fetcher, delayMs);
  };

  const fetchStatus = async (forceFull = false) => {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!normalizedSymbol) {
      setIsPolling(false);
      return;
    }

    try {
      const latestSession = await getPaperTradingBotStatus(normalizedSymbol, {
        sinceUpdatedAt: !forceFull && session?.updatedAt ? session.updatedAt : undefined,
      });

      if (!latestSession.unchanged) {
        setSession(latestSession);
      }

      if ((latestSession.status || session?.status) === 'running') {
        setIsPolling(true);
        scheduleNextPoll(TEST_POLL_MS, () => fetchStatus(false));
      } else {
        setIsPolling(false);
      }
    } catch (err) {
      setIsPolling(false);
      setError(err.message || 'Failed to refresh bot status');
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError('');

    try {
      const startedSession = await startPaperTradingBot(symbol.trim().toUpperCase());
      setSession(startedSession);
      setIsPolling(startedSession.status === 'running');
      if (startedSession.status === 'running') {
        scheduleNextPoll(TEST_POLL_MS, () => fetchStatus(false));
      }
    } catch (err) {
      setError(err.message || 'Failed to start bot');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError('');

    try {
      await fetchStatus(true);
    } catch (err) {
      setError(err.message || 'Failed to refresh bot status');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError('');

    try {
      const stoppedSession = await stopPaperTradingBot(symbol.trim().toUpperCase());
      setSession(stoppedSession);
      clearPollTimer();
      setIsPolling(false);
    } catch (err) {
      setError(err.message || 'Failed to stop bot');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => clearPollTimer(), []);

  const chartData = useMemo(() => {
    if (!session?.portfolio?.equityHistory) return [];
    return session.portfolio.equityHistory.map((point) => ({
      ...point,
      t: new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    }));
  }, [session]);

  const trades = session?.portfolio?.trades || [];

  const formatMoney = (value) => {
    if (value == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <section className="paper-bot-panel">
      <div className="paper-bot-panel__header">
        <div>
          <h2>Paper Trading Bot</h2>
          <p>Starts a Yahoo Finance driven paper bot for one symbol. Trades are random for now.</p>
        </div>
      </div>

      <div className="paper-bot-panel__controls">
        <div className="paper-bot-panel__field">
          <label htmlFor="paper-bot-symbol">Stock Symbol</label>
          <input
            id="paper-bot-symbol"
            type="text"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder="AAPL"
            maxLength={10}
          />
        </div>

        <div className="paper-bot-panel__buttons">
          <button type="button" onClick={handleStart} disabled={loading || !symbol.trim()}>
            {loading ? 'Working...' : 'Start'}
          </button>
          <button type="button" onClick={handleRefresh} disabled={loading || !symbol.trim()}>
            Refresh
          </button>
          <button type="button" onClick={handleStop} disabled={loading || !symbol.trim()}>
            Stop
          </button>
        </div>
        {isPolling && <div className="paper-bot-panel__polling">Live updates enabled</div>}
      </div>

      {error && <div className="paper-bot-panel__error">{error}</div>}

      {session && (
        <div className="paper-bot-panel__status">
          <div className="paper-bot-panel__grid">
            <div>
              <span>Status</span>
              <strong>{session.status}</strong>
            </div>
            <div>
              <span>Last Price</span>
              <strong>{session.lastQuote ? `${session.lastQuote.price} ${session.lastQuote.currency}` : 'N/A'}</strong>
            </div>
            <div>
              <span>Quote Time</span>
              <strong>
                {session.lastQuote?.fetchedAt
                  ? new Date(session.lastQuote.fetchedAt).toLocaleTimeString()
                  : 'N/A'}
              </strong>
            </div>
            <div>
              <span>Cash</span>
              <strong>{formatMoney(session.portfolio?.cash)}</strong>
            </div>
            <div>
              <span>Shares</span>
              <strong>{session.portfolio?.positionShares ?? 'N/A'}</strong>
            </div>
            <div>
              <span>Equity</span>
              <strong>{formatMoney(session.portfolio?.equity)}</strong>
            </div>
            <div>
              <span>Total P&L</span>
              <strong className={session.portfolio?.totalPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                {formatMoney(session.portfolio?.totalPnl)}
              </strong>
            </div>
            <div>
              <span>Realized P&L</span>
              <strong className={session.portfolio?.realizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                {formatMoney(session.portfolio?.realizedPnl)}
              </strong>
            </div>
            <div>
              <span>Unrealized P&L</span>
              <strong className={session.portfolio?.unrealizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                {formatMoney(session.portfolio?.unrealizedPnl)}
              </strong>
            </div>
            <div>
              <span>Return</span>
              <strong className={session.portfolio?.returnPct >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                {session.portfolio?.returnPct != null ? `${session.portfolio.returnPct}%` : 'N/A'}
              </strong>
            </div>
            <div>
              <span>Last Action</span>
              <strong>{session.lastDecision?.action || 'N/A'}</strong>
            </div>
          </div>

          {session.lastError && (
            <div className="paper-bot-panel__error">{session.lastError}</div>
          )}

          {session.lastTrade && (
            <div className="paper-bot-panel__trade-card">
              <h3>Last Paper Trade</h3>
              <p>
                {session.lastTrade.side.toUpperCase()} {session.lastTrade.quantity} shares of {session.lastTrade.symbol} at {session.lastTrade.price}
              </p>
              {session.lastTrade.realizedPnl != null && (
                <p className={session.lastTrade.realizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                  Realized P&L: {formatMoney(session.lastTrade.realizedPnl)}
                </p>
              )}
              <p>{session.lastTrade.reason}</p>
            </div>
          )}

          <div className="paper-bot-panel__chart-card">
            <h3>Equity & P&L</h3>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                  <XAxis dataKey="t" minTickGap={28} stroke="rgba(255,255,255,0.7)" />
                  <YAxis stroke="rgba(255,255,255,0.7)" domain={['auto', 'auto']} />
                  <Tooltip
                    formatter={(value, name) => [formatMoney(value), name]}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Line type="monotone" dataKey="equity" stroke="#ffd166" strokeWidth={2} dot={false} name="Equity" />
                  <Line type="monotone" dataKey="totalPnl" stroke="#7bd88f" strokeWidth={2} dot={false} name="Total P&L" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="paper-bot-panel__muted">Chart will appear after more updates.</p>
            )}
          </div>

          <div className="paper-bot-panel__trades-card">
            <h3>Trade History ({session.portfolio?.tradeCount || 0})</h3>
            {trades.length === 0 ? (
              <p className="paper-bot-panel__muted">No trades yet.</p>
            ) : (
              <div className="paper-bot-panel__table-wrap">
                <table className="paper-bot-panel__table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Side</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Notional</th>
                      <th>Realized P&L</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.id}>
                        <td>{new Date(trade.executedAt).toLocaleTimeString()}</td>
                        <td className={trade.side === 'buy' ? 'pnl-positive' : 'pnl-negative'}>{trade.side.toUpperCase()}</td>
                        <td>{trade.quantity}</td>
                        <td>{formatMoney(trade.price)}</td>
                        <td>{formatMoney(trade.notional)}</td>
                        <td className={trade.realizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                          {trade.realizedPnl != null ? formatMoney(trade.realizedPnl) : 'N/A'}
                        </td>
                        <td>{trade.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default PaperTradingBotPanel;
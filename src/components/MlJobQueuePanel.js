import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchMlJobs,
  fetchMlJobResult,
  cancelMlJob,
} from '../services/mlJobsApi';

import '../styles/MlJobQueuePanel.css';

const MlJobQueuePanel = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [error, setError] = useState('');

  const refreshJobs = async () => {
    try {
      const data = await fetchMlJobs();
      setJobs(data.jobs || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch jobs');
    }
  };

  useEffect(() => {
    refreshJobs();
    const id = setInterval(refreshJobs, 2000);
    return () => clearInterval(id);
  }, []);

  const activeCount = useMemo(
    () => jobs.filter((job) => job.status === 'queued' || job.status === 'running').length,
    [jobs]
  );

  const handleViewResults = async (job) => {
    try {
      const result = await fetchMlJobResult(job.id);
      setSelectedResult({ job, result });

      window.dispatchEvent(new CustomEvent('ml-job-view-results', {
        detail: {
          job,
          result: result.result,
        },
      }));
    } catch (err) {
      setError(err.message || 'Failed to load job result');
    }
  };

  const handleCancel = async (jobId) => {
    try {
      await cancelMlJob(jobId);
      await refreshJobs();
    } catch (err) {
      setError(err.message || 'Failed to cancel job');
    }
  };

  return (
    <section className="ml-job-queue-panel">
      <div className="ml-job-queue-header">
        <div>
          <h2>ML Job Queue</h2>
          <p>Jobs run one at a time on the backend. Queue several jobs and monitor status here.</p>
        </div>
        <div className="ml-job-queue-summary">
          <strong>{activeCount}</strong>
          <span>Active</span>
        </div>
      </div>

      <div className="ml-job-actions">
        <button type="button" onClick={refreshJobs}>Refresh Queue</button>
      </div>

      {error && <div className="ml-job-error">{error}</div>}

      <div className="ml-job-list">
        {jobs.length === 0 && <div className="ml-job-empty">No ML jobs queued yet.</div>}
        {jobs.map((job) => (
          <article key={job.id} className="ml-job-item">
            <div className="ml-job-item-main">
              <div className="ml-job-title">
                <h3>{job.metadata?.algorithm || `${job.service}.${job.method}`}</h3>
                <span className={`status status-${job.status}`}>{job.status}</span>
              </div>
              <p>ID: {job.id}</p>
              <p>Created: {new Date(job.createdAt).toLocaleString()}</p>
              {job.error && <p className="ml-job-error-inline">{job.error}</p>}
            </div>
            <div className="ml-job-item-actions">
              {job.status === 'completed' && (
                <button type="button" onClick={() => handleViewResults(job)}>
                  View Results
                </button>
              )}
              {job.status === 'queued' && (
                <button type="button" onClick={() => handleCancel(job.id)}>
                  Cancel
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {selectedResult && (
        <div className="ml-job-result">
          <h3>Result Preview</h3>
          <pre>{JSON.stringify(selectedResult.result.result, null, 2)}</pre>
        </div>
      )}
    </section>
  );
};

export default MlJobQueuePanel;
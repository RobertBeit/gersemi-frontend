// src/utils/fileLogger.js
// Client-side logger that automatically writes to a file

class FileLogger {
  constructor() {
    this.logs = [];
    this.startTime = new Date();
    this.logFileName = `stock-app-logs-${new Date().toISOString().split('T')[0]}.txt`;
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const elapsed = ((new Date() - this.startTime) / 1000).toFixed(3);
    const logEntry = `[${timestamp}] [${elapsed}s] [${level}] ${message}`;
    
    this.logs.push(logEntry);
    
    // Also log to console
    const consoleFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    consoleFn(logEntry);
    
    // Store in window for DevTools inspection
    window.__STOCK_APP_LOGS = this.logs;
    
    // Auto-save to file every 5 logs
    if (this.logs.length % 5 === 0) {
      this.autoSaveToFile();
    }
  }

  info(message) {
    this.log(message, 'INFO');
  }

  warn(message) {
    this.log(message, 'WARN');
  }

  error(message) {
    this.log(message, 'ERROR');
  }

  debug(message) {
    this.log(message, 'DEBUG');
  }

  getLogs() {
    return this.logs.join('\n');
  }

  clearLogs() {
    this.logs = [];
    this.startTime = new Date();
    window.__STOCK_APP_LOGS = this.logs;
  }

  // Auto-save to IndexedDB (persistent storage)
  async autoSaveToFile() {
    try {
      const db = await this.openIndexedDB();
      const tx = db.transaction(['logs'], 'readwrite');
      const store = tx.objectStore('logs');
      
      const logData = {
        timestamp: new Date().toISOString(),
        content: this.getLogs()
      };
      
      // Save with key so it's overwritten each time
      await store.put(logData, 'current');
      
      console.log('💾 Logs auto-saved to storage');
    } catch (e) {
      console.warn('Could not auto-save logs:', e);
    }
  }

  // Open or create IndexedDB
  openIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('StockAppLogs', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('logs')) {
          db.createObjectStore('logs');
        }
      };
    });
  }

  // Retrieve logs from IndexedDB
  async getLogsFromStorage() {
    try {
      const db = await this.openIndexedDB();
      const tx = db.transaction(['logs'], 'readonly');
      const store = tx.objectStore('logs');
      
      return new Promise((resolve, reject) => {
        const request = store.get('current');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          if (request.result && request.result.content) {
            resolve(request.result.content);
          } else {
            resolve(this.getLogs());
          }
        };
      });
    } catch (e) {
      console.warn('Could not retrieve logs from storage:', e);
      return this.getLogs();
    }
  }

  downloadNow() {
    const content = this.getLogs();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = this.logFileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    console.log('📥 Logs downloaded to: ' + this.logFileName);
  }
}

export const logger = new FileLogger();
// Also attach to window for easy access in DevTools console
window.__logger = logger;

export default logger;


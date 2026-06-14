#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const env = {};

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const idx = trimmed.indexOf('=');
    if (idx <= 0) return;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  });

  return env;
};

const envFromFile = parseEnvFile(path.join(projectRoot, '.env'));

const getValue = (key) => {
  if (process.env[key] && process.env[key].trim()) return process.env[key].trim();
  if (envFromFile[key] && envFromFile[key].trim()) return envFromFile[key].trim();
  return '';
};

const serviceMap = {
  ml: {
    explicit: 'REACT_APP_BACKEND_ML_URL',
    local: 'REACT_APP_BACKEND_ML_URL_LOCAL',
    deployed: 'REACT_APP_BACKEND_ML_URL_DEV',
  },
  data: {
    explicit: 'REACT_APP_BACKEND_DATA_URL',
    local: 'REACT_APP_BACKEND_DATA_URL_LOCAL',
    deployed: 'REACT_APP_BACKEND_DATA_URL_DEV',
  },
  bot: {
    explicit: 'REACT_APP_BOT_BASE_URL',
    local: 'REACT_APP_BOT_BASE_URL_LOCAL',
    deployed: 'REACT_APP_BOT_BASE_URL_DEV',
  },
  senator: {
    explicit: 'REACT_APP_SENATOR_MICROSERVICE_BASE_URL',
    local: 'REACT_APP_SENATOR_MICROSERVICE_BASE_URL_LOCAL',
    deployed: 'REACT_APP_SENATOR_MICROSERVICE_BASE_URL_DEV',
  },
};

const args = process.argv.slice(2);
const requestedTarget = (args[0] || '').toLowerCase();
const selected = serviceMap[requestedTarget] ? requestedTarget : '';
const passthroughArgs = selected ? args.slice(1) : args;

Object.values(serviceMap).forEach((config) => {
  const localValue = getValue(config.local);
  if (localValue) {
    process.env[config.explicit] = localValue;
  }
});

if (selected) {
  const config = serviceMap[selected];
  const deployedValue = getValue(config.deployed);
  if (!deployedValue) {
    console.error(`[start-local-target] Missing ${config.deployed} in environment/.env`);
    process.exit(1);
  }

  process.env[config.explicit] = deployedValue;
  console.log(`[start-local-target] Using deployed URL for: ${selected}`);
} else {
  console.log('[start-local-target] Using local URLs for all services');
}

const reactScriptsBin = path.join(projectRoot, 'node_modules', 'react-scripts', 'bin', 'react-scripts.js');
const child = spawn(process.execPath, [reactScriptsBin, 'start', ...passthroughArgs], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

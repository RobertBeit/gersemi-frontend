import { createNoSqlRepository } from '../data/nosql/noSqlRepository';

const COLLECTION_NAME = 'ml_run_results';
const repository = createNoSqlRepository(COLLECTION_NAME);

const normalizeSymbol = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const sanitizePart = (value) => String(value || '').replace(/[^A-Za-z0-9_-]/g, '');

export const buildMlRunRecordId = (symbol, isoTimestamp) => {
  const safeSymbol = sanitizePart(normalizeSymbol(symbol) || 'UNKNOWN') || 'UNKNOWN';
  const timestampSource = isoTimestamp || new Date().toISOString();
  const safeTimestamp = sanitizePart(String(timestampSource).replace(/[:.]/g, '-')) || String(Date.now());
  return `${safeSymbol}_${safeTimestamp}`;
};

export const hasDeterministicMlRunRecordId = (record) => {
  const safeSymbol = sanitizePart(normalizeSymbol(record?.symbol) || '');
  if (!safeSymbol || !record?.id || typeof record.id !== 'string') {
    return false;
  }
  return record.id.startsWith(`${safeSymbol}_`);
};

export const createMlRunRecord = async (payload) => {
  const nowIso = new Date().toISOString();
  const createdAt = payload?.createdAt || nowIso;
  const recordId = payload?.id || buildMlRunRecordId(payload?.symbol, createdAt);
  const normalized = {
    ...payload,
    id: recordId,
    symbol: normalizeSymbol(payload?.symbol),
    createdAt,
    updatedAt: payload?.updatedAt || nowIso,
  };

  return repository.create(normalized);
};

export const migrateMlRunRecordToDeterministicId = async (record) => {
  if (!record?.id) {
    return record;
  }

  if (hasDeterministicMlRunRecordId(record)) {
    return record;
  }

  const nowIso = new Date().toISOString();
  let targetId = buildMlRunRecordId(record.symbol, record.createdAt || nowIso);
  const existing = await repository.getById(targetId);

  if (existing && existing.id !== record.id) {
    const suffix = sanitizePart(record.jobId || nowIso);
    targetId = `${targetId}_${suffix}`;
  }

  await repository.create({
    ...record,
    id: targetId,
    updatedAt: nowIso,
  });

  await repository.remove(record.id);

  return repository.getById(targetId);
};

export const getMlRunRecord = (id) => repository.getById(id);

export const updateMlRunRecord = async (id, updates) => {
  const normalized = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return repository.update(id, normalized);
};

export const deleteMlRunRecord = (id) => repository.remove(id);

export const searchMlRunRecords = (criteria = {}) => {
  const normalized = {
    ...criteria,
    symbol: normalizeSymbol(criteria?.symbol),
  };

  return repository.search(normalized);
};

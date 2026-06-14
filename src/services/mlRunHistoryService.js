import {
  buildMlRunRecordId,
  createMlRunRecord,
  deleteMlRunRecord,
  getMlRunRecord,
  hasDeterministicMlRunRecordId,
  migrateMlRunRecordToDeterministicId,
  searchMlRunRecords,
  updateMlRunRecord,
} from '../repositories/mlRunRecordsRepository';

const normalizeError = (error) => {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return error.message;
  return String(error);
};

export const saveMlRunResult = async (record) => {
  if (!record || !record.jobId) {
    return;
  }

  await createMlRunRecord({
    ...record,
    id: record.id || buildMlRunRecordId(record.symbol, record.createdAt),
    error: normalizeError(record.error),
    userNote: record.userNote ?? null,
  });
};

export const getRunRecordById = async (id) => getMlRunRecord(id);

export const searchRunRecords = async (criteria = {}) => searchMlRunRecords(criteria);

export const updateRunRecord = async (id, updates = {}) => updateMlRunRecord(id, updates);

export const deleteRunRecord = async (id) => deleteMlRunRecord(id);

export const isDeterministicRunRecordId = (record) => hasDeterministicMlRunRecordId(record);

export const migrateRunRecordId = async (record) => migrateMlRunRecordToDeterministicId(record);

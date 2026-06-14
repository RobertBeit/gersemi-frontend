import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../../firebase/firebase';

const toPlainRecord = (snapshot) => {
  if (!snapshot?.exists?.()) return null;
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

const buildSearchQuery = (collectionName, criteria = {}) => {
  const constraints = [];

  if (criteria?.symbol) {
    constraints.push(where('symbol', '==', criteria.symbol.toUpperCase()));
  }
  if (criteria?.algorithm) {
    constraints.push(where('algorithm', '==', criteria.algorithm));
  }
  if (criteria?.status) {
    constraints.push(where('status', '==', criteria.status));
  }
  if (criteria?.jobId) {
    constraints.push(where('jobId', '==', criteria.jobId));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(Number(criteria?.limit) > 0 ? Number(criteria.limit) : 100));

  return query(collection(db, collectionName), ...constraints);
};

const passesClientSideFilters = (record, criteria = {}) => {
  const createdAt = record?.createdAt ? Date.parse(record.createdAt) : null;
  const fromTime = criteria?.createdFrom ? Date.parse(criteria.createdFrom) : null;
  const toTime = criteria?.createdTo ? Date.parse(criteria.createdTo) : null;

  if (Number.isFinite(fromTime) && Number.isFinite(createdAt) && createdAt < fromTime) {
    return false;
  }

  if (Number.isFinite(toTime) && Number.isFinite(createdAt) && createdAt > toTime) {
    return false;
  }

  if (criteria?.searchText) {
    const performanceText = (record?.algorithmPerformance || [])
      .map((item) => `${item?.label || ''} ${item?.displayValue || item?.value || ''}`)
      .join(' ');
    const forecastText = (record?.predictionForecast || [])
      .map((item) => `${item?.label || ''} ${item?.value || ''}`)
      .join(' ');

    const haystack = [
      record?.jobId,
      record?.symbol,
      record?.algorithm,
      record?.status,
      record?.label,
      record?.userNote,
      record?.direction,
      performanceText,
      forecastText,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(String(criteria.searchText).toLowerCase())) {
      return false;
    }
  }

  return true;
};

const firestoreAdapter = {
  async create(collectionName, payload) {
    const recordId = payload?.id || null;
    const body = { ...payload };
    delete body.id;

    if (recordId) {
      await setDoc(doc(db, collectionName, recordId), body);
      return { id: recordId, ...body };
    }

    throw new Error('NoSQL create requires a record id for deterministic keying');
  },

  async getById(collectionName, id) {
    const snapshot = await getDoc(doc(db, collectionName, id));
    return toPlainRecord(snapshot);
  },

  async update(collectionName, id, updates) {
    await updateDoc(doc(db, collectionName, id), updates);
    return this.getById(collectionName, id);
  },

  async remove(collectionName, id) {
    await deleteDoc(doc(db, collectionName, id));
    return { id };
  },

  async search(collectionName, criteria = {}) {
    const searchQuery = buildSearchQuery(collectionName, criteria);
    const snapshot = await getDocs(searchQuery);

    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((record) => passesClientSideFilters(record, criteria));
  },
};

export default firestoreAdapter;

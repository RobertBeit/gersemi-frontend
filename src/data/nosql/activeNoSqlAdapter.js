import firestoreAdapter from './adapters/firestoreAdapter';

// Swap this single file to migrate to another NoSQL backend.
const activeNoSqlAdapter = firestoreAdapter;

export default activeNoSqlAdapter;

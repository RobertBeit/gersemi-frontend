import activeNoSqlAdapter from './activeNoSqlAdapter';

export const createNoSqlRepository = (collectionName) => ({
  create: (payload) => activeNoSqlAdapter.create(collectionName, payload),
  getById: (id) => activeNoSqlAdapter.getById(collectionName, id),
  update: (id, updates) => activeNoSqlAdapter.update(collectionName, id, updates),
  remove: (id) => activeNoSqlAdapter.remove(collectionName, id),
  search: (criteria) => activeNoSqlAdapter.search(collectionName, criteria),
});

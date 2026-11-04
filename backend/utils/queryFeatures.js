/**
 * Shared list helper: search (?search=), field filters, date range, sorting, pagination.
 * Returns { filter, sort, skip, limit, page }.
 */
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildQuery(query, { searchFields = [], dateField = 'createdAt', extraFilters = [] } = {}) {
  const filter = {};

  // free text search
  if (query.search && searchFields.length) {
    const rx = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = searchFields.map((field) => ({ [field]: rx }));
  }

  // exact-match filters (status, category, priority, ...)
  extraFilters.forEach((field) => {
    if (query[field] !== undefined && query[field] !== '' && query[field] !== 'all') {
      filter[field] = query[field];
    }
  });

  // date range
  if (query.from || query.to) {
    filter[dateField] = {};
    if (query.from) filter[dateField].$gte = new Date(query.from);
    if (query.to) {
      const to = new Date(query.to);
      to.setHours(23, 59, 59, 999);
      filter[dateField].$lte = to;
    }
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 10));
  const sort = {};
  if (query.sortBy) {
    sort[query.sortBy] = query.sortOrder === 'asc' ? 1 : -1;
  } else {
    sort.createdAt = -1;
  }

  return { filter, sort, skip: (page - 1) * limit, limit, page };
}

module.exports = { buildQuery, escapeRegex };

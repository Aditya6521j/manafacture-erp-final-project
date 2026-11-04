function success(res, data, meta, statusCode = 200) {
  const payload = { success: true, ...(Array.isArray(data) ? { data } : { data }) };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
}

function created(res, data, message = 'Created successfully') {
  return res.status(201).json({ success: true, message, data });
}

module.exports = { success, created };

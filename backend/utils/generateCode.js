/** Generates a sequential business code such as PO-2026-0007. */
async function generateCode(Model, field, prefix, width = 4) {
  const year = new Date().getFullYear();
  const last = await Model.findOne({ [field]: new RegExp(`^${prefix}-${year}-`) })
    .sort({ [field]: -1 })
    .select(field)
    .lean();
  let next = 1;
  if (last && last[field]) {
    next = parseInt(last[field].split('-').pop(), 10) + 1;
  }
  return `${prefix}-${year}-${String(next).padStart(width, '0')}`;
}

module.exports = generateCode;

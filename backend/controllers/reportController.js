const asyncHandler = require('../utils/asyncHandler');
const { REPORTS, buildReport, toExcel, toPDF } = require('../services/reportService');

exports.types = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: Object.entries(REPORTS).map(([key, value]) => ({ key, title: value.title })),
  });
});

/** GET /api/reports/:type?from=&to= — JSON preview */
exports.preview = asyncHandler(async (req, res) => {
  const report = await buildReport(req.params.type, { from: req.query.from, to: req.query.to });
  res.json({ success: true, data: report });
});

/** GET /api/reports/:type/download?format=xlsx|pdf&from=&to= */
exports.download = asyncHandler(async (req, res) => {
  const format = (req.query.format || 'xlsx').toLowerCase();
  const report = await buildReport(req.params.type, { from: req.query.from, to: req.query.to });
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${report.type}-report-${stamp}`;

  if (format === 'pdf') {
    const buffer = await toPDF(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
    return res.send(buffer);
  }

  const buffer = await toExcel(report);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
  return res.send(Buffer.from(buffer));
});

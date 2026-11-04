const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboardService');

exports.overview = asyncHandler(async (req, res) => {
  const data = await dashboardService.getOverview(req.user);
  res.json({ success: true, data: { ...data, role: req.user.role, user: { name: req.user.name, role: req.user.role } } });
});

exports.stats = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await dashboardService.getStats() });
});

exports.charts = asyncHandler(async (req, res) => {
  const months = Math.min(12, Math.max(3, parseInt(req.query.months, 10) || 6));
  const [monthlyProduction, quality, defects, machines, materials] = await Promise.all([
    dashboardService.getMonthlyProduction(months),
    dashboardService.getQualityAnalysis(months),
    dashboardService.getDefectAnalysis(months),
    dashboardService.getMachineUtilization(),
    dashboardService.getMaterialConsumption(),
  ]);
  res.json({ success: true, data: { monthlyProduction, quality, defects, machines, materials } });
});

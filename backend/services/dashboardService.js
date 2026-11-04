const ProductionOrder = require('../models/ProductionOrder');
const QualityInspection = require('../models/QualityInspection');
const DefectRecord = require('../models/DefectRecord');
const RawMaterial = require('../models/RawMaterial');
const Machine = require('../models/Machine');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function lastMonths(count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` });
  }
  return out;
}

async function getStats() {
  const [
    totalOrders,
    completedOrders,
    pendingOrders,
    inProgressOrders,
    producedAgg,
    rejectedAgg,
    inspectionAgg,
    materialAgg,
    machineAgg,
    employeeAgg,
  ] = await Promise.all([
    ProductionOrder.countDocuments(),
    ProductionOrder.countDocuments({ status: 'Completed' }),
    ProductionOrder.countDocuments({ status: { $in: ['Planned', 'Approved', 'In Progress', 'On Hold'] } }),
    ProductionOrder.countDocuments({ status: 'In Progress' }),
    ProductionOrder.aggregate([{ $group: { _id: null, produced: { $sum: '$producedQuantity' } } }]),
    ProductionOrder.aggregate([{ $group: { _id: null, rejected: { $sum: '$rejectedQuantity' } } }]),
    QualityInspection.aggregate([
      {
        $group: {
          _id: null,
          inspected: { $sum: '$inspectedQuantity' },
          passed: { $sum: '$passedQuantity' },
          rejected: { $sum: '$rejectedQuantity' },
        },
      },
    ]),
    RawMaterial.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          lowStock: { $sum: { $cond: [{ $lt: ['$availableQuantity', '$minimumStockLevel'] }, 1, 0] } },
          stockValue: { $sum: { $multiply: ['$availableQuantity', '$unitPrice'] } },
        },
      },
    ]),
    Machine.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Employee.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const inspected = inspectionAgg[0]?.inspected || 0;
  const passed = inspectionAgg[0]?.passed || 0;
  const rejectedInsp = inspectionAgg[0]?.rejected || 0;
  const machineByStatus = machineAgg.reduce((acc, m) => ({ ...acc, [m._id]: m.count }), {});

  return {
    totalProductionOrders: totalOrders,
    completedProductionOrders: completedOrders,
    pendingProductionOrders: pendingOrders,
    inProgressOrders,
    totalProductsManufactured: producedAgg[0]?.produced || 0,
    defectiveProducts: rejectedInsp || rejectedAgg[0]?.rejected || 0,
    qualityPassPercentage: inspected ? Math.round((passed / inspected) * 10000) / 100 : 0,
    defectPercentage: inspected ? Math.round((rejectedInsp / inspected) * 10000) / 100 : 0,
    totalInspected: inspected,
    availableRawMaterials: materialAgg[0]?.total || 0,
    lowStockMaterials: materialAgg[0]?.lowStock || 0,
    stockValue: Math.round(materialAgg[0]?.stockValue || 0),
    totalMachines: machineAgg.reduce((s, m) => s + m.count, 0),
    activeMachines: machineByStatus.Running || 0,
    machinesUnderMaintenance: machineByStatus['Under Maintenance'] || 0,
    machinesBreakdown: machineByStatus.Breakdown || 0,
    idleMachines: machineByStatus.Idle || 0,
    totalEmployees: employeeAgg.reduce((s, e) => s + e.count, 0),
    availableEmployees: employeeAgg.find((e) => e._id === 'Available')?.count || 0,
  };
}

/** Monthly targets vs actual production for the last N months. */
async function getMonthlyProduction(months = 6) {
  const buckets = lastMonths(months);
  const start = new Date(buckets[0].year, buckets[0].month - 1, 1);

  const orders = await ProductionOrder.find({ startDate: { $gte: start } })
    .select('quantity producedQuantity startDate status')
    .lean();

  return buckets.map((b) => {
    const inMonth = orders.filter((o) => {
      const d = new Date(o.startDate);
      return d.getFullYear() === b.year && d.getMonth() + 1 === b.month;
    });
    return {
      label: b.label,
      target: inMonth.reduce((s, o) => s + (o.quantity || 0), 0),
      actual: inMonth.reduce((s, o) => s + (o.producedQuantity || 0), 0),
      orders: inMonth.length,
      completed: inMonth.filter((o) => o.status === 'Completed').length,
    };
  });
}

/** Quality status distribution + monthly pass/defect trend. */
async function getQualityAnalysis(months = 6) {
  const [byStatus, inspections] = await Promise.all([
    QualityInspection.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    QualityInspection.find({ inspectionDate: { $gte: new Date(Date.now() - months * 31 * 24 * 3600 * 1000) } })
      .select('inspectionDate passedQuantity rejectedQuantity inspectedQuantity')
      .lean(),
  ]);

  const buckets = lastMonths(months);
  const trend = buckets.map((b) => {
    const rows = inspections.filter((i) => {
      const d = new Date(i.inspectionDate);
      return d.getFullYear() === b.year && d.getMonth() + 1 === b.month;
    });
    const inspected = rows.reduce((s, r) => s + r.inspectedQuantity, 0);
    const passed = rows.reduce((s, r) => s + r.passedQuantity, 0);
    return {
      label: b.label,
      passPercentage: inspected ? Math.round((passed / inspected) * 10000) / 100 : 0,
      defectPercentage: inspected ? Math.round(((inspected - passed) / inspected) * 10000) / 100 : 0,
      inspected,
    };
  });

  const statusMap = byStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {});
  return { trend, byStatus: statusMap };
}

/** Defects grouped by category and by month. */
async function getDefectAnalysis(months = 6) {
  const start = new Date(Date.now() - months * 31 * 24 * 3600 * 1000);
  const [byCategory, records] = await Promise.all([
    DefectRecord.aggregate([{ $group: { _id: '$defectCategory', quantity: { $sum: '$quantity' }, count: { $sum: 1 } } }, { $sort: { quantity: -1 } }]),
    DefectRecord.find({ detectedDate: { $gte: start } }).select('detectedDate quantity').lean(),
  ]);

  const buckets = lastMonths(months);
  const trend = buckets.map((b) => {
    const rows = records.filter((r) => {
      const d = new Date(r.detectedDate);
      return d.getFullYear() === b.year && d.getMonth() + 1 === b.month;
    });
    return { label: b.label, quantity: rows.reduce((s, r) => s + r.quantity, 0), incidents: rows.length };
  });

  return {
    byCategory: byCategory.map((c) => ({ category: c._id, quantity: c.quantity, incidents: c.count })),
    trend,
  };
}

async function getMachineUtilization() {
  const machines = await Machine.find({ isActive: true })
    .select('machineCode name status utilizationPercentage operatingHours capacityPerHour')
    .lean();
  return machines.map((m) => ({
    machineCode: m.machineCode,
    name: m.name,
    status: m.status,
    utilizationPercentage: m.utilizationPercentage || 0,
    operatingHours: m.operatingHours || 0,
  }));
}

async function getMaterialConsumption() {
  const rows = await ProductionOrder.aggregate([
    { $unwind: '$materials' },
    { $group: { _id: '$materials.materialName', consumed: { $sum: { $ifNull: ['$materials.consumedQty', 0] } } } },
    { $sort: { consumed: -1 } },
    { $limit: 8 },
  ]);
  return rows.filter((r) => r._id).map((r) => ({ material: r._id, consumed: Math.round(r.consumed * 100) / 100 }));
}

async function getRecentActivities(limit = 8) {
  const [orders, inspections, defects] = await Promise.all([
    ProductionOrder.find().sort({ updatedAt: -1 }).limit(limit).select('orderNumber productName status updatedAt producedQuantity quantity').lean(),
    QualityInspection.find().sort({ createdAt: -1 }).limit(limit).select('inspectionNumber productName status qualityPassPercentage createdAt batchNumber').lean(),
    DefectRecord.find().sort({ createdAt: -1 }).limit(limit).select('defectNumber productName defectCategory severity createdAt quantity').lean(),
  ]);

  const activities = [
    ...orders.map((o) => ({
      id: `order-${o._id}`,
      icon: 'production',
      title: `${o.orderNumber} · ${o.productName}`,
      detail: `Production order is ${o.status} (${o.producedQuantity}/${o.quantity} units)`,
      status: o.status,
      timestamp: o.updatedAt,
      link: '/production',
    })),
    ...inspections.map((i) => ({
      id: `ins-${i._id}`,
      icon: 'quality',
      title: `${i.inspectionNumber} · Batch ${i.batchNumber}`,
      detail: `Quality inspection ${i.status} — ${i.qualityPassPercentage}% pass`,
      status: i.status,
      timestamp: i.createdAt,
      link: '/quality-control',
    })),
    ...defects.map((d) => ({
      id: `def-${d._id}`,
      icon: 'defect',
      title: `${d.defectNumber} · ${d.productName || 'Product'}`,
      detail: `${d.quantity} unit(s) reported — ${d.defectCategory} (${d.severity})`,
      status: d.severity,
      timestamp: d.createdAt,
      link: '/defects',
    })),
  ];

  return activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
}

async function getPendingTasks() {
  const now = new Date();
  const [orders, approvals, maintenance] = await Promise.all([
    ProductionOrder.find({ status: { $in: ['Planned', 'Approved', 'In Progress', 'On Hold'] } })
      .sort({ expectedCompletionDate: 1 })
      .limit(6)
      .select('orderNumber productName status expectedCompletionDate quantity producedQuantity priority')
      .lean(),
    QualityInspection.find({ status: 'Pending Inspection' }).limit(4).select('inspectionNumber batchNumber inspectionDate').lean(),
    Machine.find({ nextMaintenanceDate: { $lte: new Date(now.getTime() + 10 * 24 * 3600 * 1000) } })
      .limit(4)
      .select('machineCode name nextMaintenanceDate status')
      .lean(),
  ]);

  return {
    production: orders.map((o) => ({
      id: o._id,
      title: `${o.orderNumber} — ${o.productName}`,
      due: o.expectedCompletionDate,
      status: o.status,
      priority: o.priority,
      progress: o.quantity ? Math.round((o.producedQuantity / o.quantity) * 100) : 0,
      overdue: new Date(o.expectedCompletionDate) < now,
    })),
    approvals: approvals.map((a) => ({ id: a._id, title: `${a.inspectionNumber} — Batch ${a.batchNumber}`, due: a.inspectionDate })),
    maintenance: maintenance.map((m) => ({ id: m._id, title: `${m.machineCode} — ${m.name}`, due: m.nextMaintenanceDate, status: m.status })),
  };
}

async function getOverview(user) {
  const roleFilter = user?.role && user.role !== 'Admin'
    ? { $or: [{ targetRoles: { $size: 0 } }, { targetRoles: user.role }, { targetRoles: { $exists: false } }] }
    : {};

  const [stats, monthlyProduction, quality, defects, machines, materials, activities, pendingTasks, notifications] = await Promise.all([
    getStats(),
    getMonthlyProduction(6),
    getQualityAnalysis(6),
    getDefectAnalysis(6),
    getMachineUtilization(),
    getMaterialConsumption(),
    getRecentActivities(8),
    getPendingTasks(),
    Notification.find({ ...roleFilter, readBy: { $ne: user?._id } }).sort({ createdAt: -1 }).limit(6).lean(),
  ]);

  return { stats, monthlyProduction, quality, defects, machines, materials, activities, pendingTasks, notifications };
}

module.exports = {
  getStats,
  getMonthlyProduction,
  getQualityAnalysis,
  getDefectAnalysis,
  getMachineUtilization,
  getMaterialConsumption,
  getRecentActivities,
  getPendingTasks,
  getOverview,
  lastMonths,
};

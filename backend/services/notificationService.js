const Notification = require('../models/Notification');
const RawMaterial = require('../models/RawMaterial');
const ProductionOrder = require('../models/ProductionOrder');
const Machine = require('../models/Machine');

/** Creates a notification, skipping an identical unresolved one from the last 12 hours. */
async function createNotification(payload) {
  const { title, message, type, severity = 'info', module = 'system', referenceId, targetRoles, link } = payload;
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const duplicate = await Notification.findOne({ title, type, createdAt: { $gte: since } }).lean();
  if (duplicate) return duplicate;
  return Notification.create({ title, message, type, severity, module, referenceId, targetRoles, link });
}

/** Scans the database and raises alerts for low stock, deadlines, delays, breakdowns and maintenance. */
async function runSystemChecks() {
  const created = [];

  // 1. Low stock
  const lowStock = await RawMaterial.find({ $expr: { $lt: ['$availableQuantity', '$minimumStockLevel'] } }).lean();
  for (const m of lowStock) {
    created.push(
      await createNotification({
        title: `Low stock: ${m.name}`,
        message: `${m.name} (${m.materialCode}) is down to ${m.availableQuantity} ${m.unit}, below the minimum level of ${m.minimumStockLevel} ${m.unit}.`,
        type: 'low_stock',
        severity: m.availableQuantity <= 0 ? 'critical' : 'warning',
        module: 'inventory',
        referenceId: m._id,
        targetRoles: ['Admin', 'Inventory Manager', 'Production Manager'],
        link: '/inventory',
      })
    );
  }

  // 2. Production deadlines within 3 days + delayed orders
  const openOrders = await ProductionOrder.find({ status: { $in: ['Planned', 'Approved', 'In Progress', 'On Hold'] } }).lean();
  const now = new Date();
  for (const o of openOrders) {
    const due = new Date(o.expectedCompletionDate);
    const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (days < 0) {
      created.push(
        await createNotification({
          title: `Delayed order ${o.orderNumber}`,
          message: `${o.orderNumber} for ${o.productName} is ${Math.abs(days)} day(s) past its completion date (${due.toDateString()}).`,
          type: 'delayed',
          severity: 'critical',
          module: 'production',
          referenceId: o._id,
          targetRoles: ['Admin', 'Production Manager'],
          link: '/production',
        })
      );
    } else if (days <= 3) {
      created.push(
        await createNotification({
          title: `Deadline approaching: ${o.orderNumber}`,
          message: `${o.orderNumber} (${o.productName}) is due in ${days} day(s). Progress: ${o.producedQuantity}/${o.quantity}.`,
          type: 'deadline',
          severity: 'warning',
          module: 'production',
          referenceId: o._id,
          targetRoles: ['Admin', 'Production Manager', 'Machine Operator'],
          link: '/production',
        })
      );
    }
  }

  // 3. Machine breakdowns
  const broken = await Machine.find({ status: 'Breakdown' }).lean();
  for (const m of broken) {
    created.push(
      await createNotification({
        title: `Breakdown: ${m.name}`,
        message: `${m.machineCode} — ${m.name} is reporting a breakdown${m.breakdownReason ? `: ${m.breakdownReason}` : ''}.`,
        type: 'breakdown',
        severity: 'critical',
        module: 'machines',
        referenceId: m._id,
        targetRoles: ['Admin', 'Production Manager', 'Machine Operator'],
        link: '/machines',
      })
    );
  }

  // 4. Preventive maintenance due within 7 days
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const maintenanceDue = await Machine.find({ nextMaintenanceDate: { $lte: soon, $ne: null } }).lean();
  for (const m of maintenanceDue) {
    created.push(
      await createNotification({
        title: `Maintenance due: ${m.name}`,
        message: `Preventive maintenance for ${m.machineCode} is scheduled on ${new Date(m.nextMaintenanceDate).toDateString()}.`,
        type: 'maintenance',
        severity: 'info',
        module: 'machines',
        referenceId: m._id,
        targetRoles: ['Admin', 'Production Manager'],
        link: '/machines',
      })
    );
  }

  return created.filter(Boolean).length;
}

module.exports = { createNotification, runSystemChecks };

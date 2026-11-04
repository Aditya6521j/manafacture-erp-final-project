const RawMaterial = require('../models/RawMaterial');
const ApiError = require('../utils/ApiError');
const { createNotification } = require('./notificationService');

/** Deducts consumed quantity from stock and raises a low-stock alert if the level is breached. */
async function consumeMaterial(materialId, quantity) {
  const material = await RawMaterial.findById(materialId);
  if (!material) throw new ApiError(404, 'Raw material not found.');
  if (quantity <= 0) throw new ApiError(400, 'Consumption quantity must be greater than zero.');
  if (material.availableQuantity < quantity) {
    throw new ApiError(400, `Insufficient stock for ${material.name}. Available: ${material.availableQuantity} ${material.unit}.`);
  }
  material.availableQuantity = Math.round((material.availableQuantity - quantity) * 1000) / 1000;
  material.requiredQuantity = Math.max(0, material.requiredQuantity - quantity);
  await material.save();

  if (material.availableQuantity < material.minimumStockLevel) {
    await createNotification({
      title: `Low stock: ${material.name}`,
      message: `${material.name} (${material.materialCode}) has ${material.availableQuantity} ${material.unit} left — minimum level is ${material.minimumStockLevel} ${material.unit}.`,
      type: 'low_stock',
      severity: material.availableQuantity <= 0 ? 'critical' : 'warning',
      module: 'inventory',
      referenceId: material._id,
      targetRoles: ['Admin', 'Inventory Manager', 'Production Manager'],
      link: '/inventory',
    });
  }
  return material;
}

/** Records a purchase / stock-in entry. */
async function purchaseMaterial(materialId, quantity, unitPrice) {
  const material = await RawMaterial.findById(materialId);
  if (!material) throw new ApiError(404, 'Raw material not found.');
  if (quantity <= 0) throw new ApiError(400, 'Purchase quantity must be greater than zero.');
  material.availableQuantity = Math.round((material.availableQuantity + quantity) * 1000) / 1000;
  if (unitPrice !== undefined && unitPrice !== null && unitPrice !== '') material.unitPrice = Number(unitPrice);
  material.lastRestockedAt = new Date();
  await material.save();
  return material;
}

/** Sums required quantity from all open production orders so buyers know demand. */
async function syncRequiredQuantities(ProductionOrder) {
  const pipeline = [
    { $match: { status: { $in: ['Planned', 'Approved', 'In Progress', 'On Hold'] } } },
    { $unwind: '$materials' },
    {
      $group: {
        _id: '$materials.material',
        required: { $sum: { $subtract: ['$materials.requiredQty', { $ifNull: ['$materials.consumedQty', 0] }] } },
      },
    },
  ];
  const rows = await ProductionOrder.aggregate(pipeline);
  await RawMaterial.updateMany({}, { $set: { requiredQuantity: 0 } });
  const ops = rows
    .filter((r) => r._id)
    .map((r) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { requiredQuantity: Math.max(0, r.required) } } } }));
  if (ops.length) await RawMaterial.bulkWrite(ops);
}

module.exports = { consumeMaterial, purchaseMaterial, syncRequiredQuantities };

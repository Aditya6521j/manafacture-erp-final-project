/* eslint-disable no-console */
/**
 * Seeds the Manufacturing ERP database with realistic demo data.
 *   npm run seed          → insert sample data
 *   npm run seed:destroy  → wipe all collections
 */
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { MONGO_URI } = require('../config/env');

const User = require('../models/User');
const Department = require('../models/Department');
const Product = require('../models/Product');
const ProductionOrder = require('../models/ProductionOrder');
const ProductionSchedule = require('../models/ProductionSchedule');
const RawMaterial = require('../models/RawMaterial');
const Supplier = require('../models/Supplier');
const QualityInspection = require('../models/QualityInspection');
const DefectRecord = require('../models/DefectRecord');
const Machine = require('../models/Machine');
const Employee = require('../models/Employee');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const Notification = require('../models/Notification');
const { runSystemChecks } = require('../services/notificationService');

const day = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(Date.now() - days * day);
const ahead = (days) => new Date(Date.now() + days * day);
const round = (n) => Math.round(n * 100) / 100;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const MODELS = [User, Department, Product, ProductionOrder, ProductionSchedule, RawMaterial, Supplier,
  QualityInspection, DefectRecord, Machine, Employee, MaintenanceRecord, Notification];

async function destroy() {
  await Promise.all(MODELS.map((M) => M.deleteMany({})));
  console.log('  ✖  All collections cleared');
}

async function seed() {
  await destroy();

  /* ------------------------------ Departments ------------------------------ */
  const departments = await Department.insertMany([
    { name: 'Production', code: 'PROD', description: 'Core manufacturing and shop floor operations', head: 'Rajesh Kulkarni', location: 'Plant 1 · Bay A', headcount: 26 },
    { name: 'Quality Assurance', code: 'QA', description: 'Incoming, in-process and final quality inspection', head: 'Priya Nair', location: 'Plant 1 · QC Lab', headcount: 9 },
    { name: 'Inventory & Stores', code: 'INV', description: 'Raw material storage, procurement and dispatch', head: 'Amit Deshmukh', location: 'Warehouse Block', headcount: 7 },
    { name: 'Maintenance', code: 'MNT', description: 'Machine upkeep, preventive and breakdown maintenance', head: 'Sandeep Rao', location: 'Plant 1 · Service Bay', headcount: 6 },
    { name: 'Packaging & Dispatch', code: 'PACK', description: 'Final packaging, labelling and outbound logistics', head: 'Neha Joshi', location: 'Dispatch Yard', headcount: 5 },
  ]);
  const dept = (code) => departments.find((d) => d.code === code)._id;

  /* --------------------------------- Users --------------------------------- */
  const users = await User.create([
    { name: 'Arjun Mehta', email: 'admin@manufacture.com', password: 'Admin@123', role: 'Admin', phone: '+91 98220 11001', department: dept('PROD') },
    { name: 'Rajesh Kulkarni', email: 'manager@manufacture.com', password: 'Manager@123', role: 'Production Manager', phone: '+91 98220 11002', department: dept('PROD') },
    { name: 'Priya Nair', email: 'qc@manufacture.com', password: 'Qc@123', role: 'Quality Control Inspector', phone: '+91 98220 11003', department: dept('QA') },
    { name: 'Amit Deshmukh', email: 'inventory@manufacture.com', password: 'Inventory@123', role: 'Inventory Manager', phone: '+91 98220 11004', department: dept('INV') },
    { name: 'Sandeep Rao', email: 'operator@manufacture.com', password: 'Operator@123', role: 'Machine Operator', phone: '+91 98220 11005', department: dept('PROD') },
    { name: 'Sneha Patil', email: 'inspector2@manufacture.com', password: 'Inspector@123', role: 'Quality Control Inspector', phone: '+91 98220 11006', department: dept('QA') },
  ]);
  const user = (email) => users.find((u) => u.email === email)._id;

  /* -------------------------------- Suppliers ------------------------------- */
  const suppliers = await Supplier.insertMany([
    { supplierCode: 'SUP-001', name: 'Bharat Steel Traders', contactPerson: 'Vikram Shah', email: 'sales@bharatsteel.in', phone: '+91 22 2456 7890', address: 'MIDC Industrial Area, Pune', gstin: '27AABCB1234C1Z5', rating: 4.5 },
    { supplierCode: 'SUP-002', name: 'PolyPlast Industries', contactPerson: 'Deepa Iyer', email: 'orders@polyplast.in', phone: '+91 20 2678 1234', address: 'Chakan, Pune', gstin: '27AACCP5678D1Z2', rating: 4.2 },
    { supplierCode: 'SUP-003', name: 'Precision Fasteners Ltd', contactPerson: 'Mohit Bansal', email: 'support@precfas.in', phone: '+91 22 2233 4455', address: 'Bhiwandi, Thane', gstin: '27AAECF9012E1Z8', rating: 3.9 },
    { supplierCode: 'SUP-004', name: 'ElectroComponents India', contactPerson: 'Kavita Menon', email: 'kavita@electrocomp.in', phone: '+91 80 4123 9876', address: 'Peenya, Bengaluru', gstin: '29AAGCE3456F1Z1', rating: 4.7 },
    { supplierCode: 'SUP-005', name: 'SealTech Rubber Works', contactPerson: 'Faisal Khan', email: 'faisal@sealtech.in', phone: '+91 44 2789 6543', address: 'Ambattur, Chennai', gstin: '33AAHCS7890G1Z4', rating: 4.0 },
  ]);
  const sup = (code) => suppliers.find((s) => s.supplierCode === code)._id;

  /* ------------------------------ Raw materials ----------------------------- */
  const materials = await RawMaterial.insertMany([
    { materialCode: 'RM-001', name: 'MS Steel Plate 5mm', category: 'Metal', unit: 'Kg', availableQuantity: 4200, minimumStockLevel: 1500, unitPrice: 68, supplier: sup('SUP-001'), warehouseLocation: 'WH-A / Rack 1' },
    { materialCode: 'RM-002', name: 'Aluminium Billet 6061', category: 'Metal', unit: 'Kg', availableQuantity: 980, minimumStockLevel: 1200, unitPrice: 245, supplier: sup('SUP-001'), warehouseLocation: 'WH-A / Rack 2' },
    { materialCode: 'RM-003', name: 'ABS Plastic Granules', category: 'Plastic', unit: 'Kg', availableQuantity: 2650, minimumStockLevel: 800, unitPrice: 132, supplier: sup('SUP-002'), warehouseLocation: 'WH-B / Rack 1' },
    { materialCode: 'RM-004', name: 'Nylon Bush 20mm', category: 'Plastic', unit: 'Nos', availableQuantity: 640, minimumStockLevel: 1000, unitPrice: 24, supplier: sup('SUP-002'), warehouseLocation: 'WH-B / Rack 3' },
    { materialCode: 'RM-005', name: 'Hex Bolt M10 (Zinc)', category: 'Fasteners', unit: 'Nos', availableQuantity: 18400, minimumStockLevel: 5000, unitPrice: 6.5, supplier: sup('SUP-003'), warehouseLocation: 'WH-C / Bin 4' },
    { materialCode: 'RM-006', name: 'Allen Screw M6 x 20', category: 'Fasteners', unit: 'Nos', availableQuantity: 3200, minimumStockLevel: 4000, unitPrice: 3.2, supplier: sup('SUP-003'), warehouseLocation: 'WH-C / Bin 5' },
    { materialCode: 'RM-007', name: 'Hydraulic Oil 68 Grade', category: 'Chemical', unit: 'Litre', availableQuantity: 540, minimumStockLevel: 300, unitPrice: 185, supplier: sup('SUP-004'), warehouseLocation: 'WH-D / Tank 1' },
    { materialCode: 'RM-008', name: 'Copper Wire 2.5 sq mm', category: 'Electrical', unit: 'Meter', availableQuantity: 1250, minimumStockLevel: 600, unitPrice: 48, supplier: sup('SUP-004'), warehouseLocation: 'WH-D / Rack 2' },
    { materialCode: 'RM-009', name: 'Rubber Gasket 50mm', category: 'Rubber', unit: 'Nos', availableQuantity: 860, minimumStockLevel: 1500, unitPrice: 18, supplier: sup('SUP-005'), warehouseLocation: 'WH-B / Bin 2' },
    { materialCode: 'RM-010', name: 'Corrugated Box 400x300', category: 'Packaging', unit: 'Nos', availableQuantity: 2200, minimumStockLevel: 1000, unitPrice: 32, supplier: sup('SUP-002'), warehouseLocation: 'WH-E / Bay 1' },
    { materialCode: 'RM-011', name: 'Stretch Wrap Film', category: 'Packaging', unit: 'Kg', availableQuantity: 96, minimumStockLevel: 150, unitPrice: 210, supplier: sup('SUP-002'), warehouseLocation: 'WH-E / Bay 2' },
    { materialCode: 'RM-012', name: 'Stainless Steel Rod 12mm', category: 'Metal', unit: 'Kg', availableQuantity: 1750, minimumStockLevel: 700, unitPrice: 320, supplier: sup('SUP-001'), warehouseLocation: 'WH-A / Rack 4' },
  ]);
  const mat = (code) => materials.find((m) => m.materialCode === code)._id;

  await Supplier.updateMany({ supplierCode: 'SUP-001' }, { $set: { materialsSupplied: [mat('RM-001'), mat('RM-002'), mat('RM-012')] } });
  await Supplier.updateMany({ supplierCode: 'SUP-002' }, { $set: { materialsSupplied: [mat('RM-003'), mat('RM-004'), mat('RM-010'), mat('RM-011')] } });
  await Supplier.updateMany({ supplierCode: 'SUP-003' }, { $set: { materialsSupplied: [mat('RM-005'), mat('RM-006')] } });
  await Supplier.updateMany({ supplierCode: 'SUP-004' }, { $set: { materialsSupplied: [mat('RM-007'), mat('RM-008')] } });
  await Supplier.updateMany({ supplierCode: 'SUP-005' }, { $set: { materialsSupplied: [mat('RM-009')] } });

  /* --------------------------------- Products ------------------------------- */
  const products = await Product.insertMany([
    { productCode: 'PRD-1001', name: 'Precision Bearing Assembly', category: 'Mechanical Assembly', unit: 'Nos', specification: 'ID 40mm / OD 90mm · C3 clearance', drawingNumber: 'DRG-BRG-1001', standardCycleTimeMin: 12, unitPrice: 1850, qualityStandard: 'ISO 9001:2015' },
    { productCode: 'PRD-1002', name: 'Hydraulic Cylinder 50T', category: 'Hydraulics', unit: 'Nos', specification: 'Bore 100mm · Stroke 300mm · 210 bar', drawingNumber: 'DRG-HYD-1002', standardCycleTimeMin: 45, unitPrice: 12400, qualityStandard: 'ISO 9001:2015' },
    { productCode: 'PRD-1003', name: 'Steel Mounting Bracket', category: 'Fabrication', unit: 'Nos', specification: 'MS 5mm · powder coated · 2.4 kg', drawingNumber: 'DRG-FAB-1003', standardCycleTimeMin: 6, unitPrice: 420, qualityStandard: 'ISO 9001:2015' },
    { productCode: 'PRD-1004', name: 'Gear Shaft 32T', category: 'Machined Component', unit: 'Nos', specification: 'EN8 steel · 32 teeth · hardened 45 HRC', drawingNumber: 'DRG-GRS-1004', standardCycleTimeMin: 22, unitPrice: 2650, qualityStandard: 'IATF 16949' },
    { productCode: 'PRD-1005', name: 'Aluminium Heat Sink', category: 'Thermal Component', unit: 'Nos', specification: '6061-T6 · 120x80x35mm · anodised', drawingNumber: 'DRG-HSK-1005', standardCycleTimeMin: 9, unitPrice: 780, qualityStandard: 'ISO 9001:2015' },
    { productCode: 'PRD-1006', name: 'Control Panel Enclosure', category: 'Electrical Assembly', unit: 'Nos', specification: 'IP65 · 600x400x250mm · CRCA 2mm', drawingNumber: 'DRG-ELE-1006', standardCycleTimeMin: 55, unitPrice: 8900, qualityStandard: 'IEC 61439' },
  ]);
  const prod = (code) => products.find((p) => p.productCode === code)._id;

  /* --------------------------------- Machines ------------------------------- */
  const machines = await Machine.insertMany([
    { machineCode: 'MCH-001', name: 'CNC Turning Center TX-200', type: 'CNC Machine', manufacturer: 'Ace Micromatic', model: 'TX-200', serialNumber: 'AMTX200-1187', capacityPerHour: 28, location: 'Shop Floor A', status: 'Running', operatingHours: 4820, utilizationPercentage: 86, lastMaintenanceDate: ago(24), nextMaintenanceDate: ahead(6) },
    { machineCode: 'MCH-002', name: 'Injection Moulding 180T', type: 'Injection Molding', manufacturer: 'Ferromatik', model: 'FM-180', serialNumber: 'FM180-4402', capacityPerHour: 120, location: 'Shop Floor B', status: 'Running', operatingHours: 6310, utilizationPercentage: 78, lastMaintenanceDate: ago(40), nextMaintenanceDate: ahead(12) },
    { machineCode: 'MCH-003', name: 'Hydraulic Press 250T', type: 'Press', manufacturer: 'Godrej', model: 'GP-250', serialNumber: 'GP250-9901', capacityPerHour: 45, location: 'Shop Floor A', status: 'Idle', operatingHours: 3120, utilizationPercentage: 52, lastMaintenanceDate: ago(15), nextMaintenanceDate: ahead(20) },
    { machineCode: 'MCH-004', name: 'Robotic Welding Cell R-6', type: 'Welding Robot', manufacturer: 'Fanuc', model: 'ARC Mate 120iD', serialNumber: 'FNC-120-3321', capacityPerHour: 34, location: 'Shop Floor C', status: 'Under Maintenance', operatingHours: 2740, utilizationPercentage: 64, lastMaintenanceDate: ago(2), nextMaintenanceDate: ahead(2) },
    { machineCode: 'MCH-005', name: 'Surface Grinder SG-400', type: 'Lathe', manufacturer: 'HMT', model: 'SG-400', serialNumber: 'HMT-SG-6620', capacityPerHour: 22, location: 'Tool Room', status: 'Running', operatingHours: 5180, utilizationPercentage: 71, lastMaintenanceDate: ago(33), nextMaintenanceDate: ahead(9) },
    { machineCode: 'MCH-006', name: 'Auto Packaging Line PL-2', type: 'Packaging Unit', manufacturer: 'Bosch Packaging', model: 'PL-2', serialNumber: 'BP-PL2-2244', capacityPerHour: 240, location: 'Dispatch Bay', status: 'Breakdown', operatingHours: 1890, utilizationPercentage: 40, lastMaintenanceDate: ago(58), nextMaintenanceDate: ahead(1), breakdownReason: 'Conveyor belt snapped — replacement part ordered' },
  ]);
  const mc = (code) => machines.find((m) => m.machineCode === code)._id;

  /* -------------------------------- Employees ------------------------------- */
  const employees = await Employee.insertMany([
    { employeeId: 'EMP-101', name: 'Sandeep Rao', email: 'sandeep.rao@manufacture.com', phone: '+91 98901 22001', department: dept('PROD'), role: 'Senior CNC Operator', shift: 'Shift A (06:00-14:00)', skillSet: ['CNC Turning', 'GD&T', 'Tool Setting'], status: 'On Task', joinDate: ago(1450), hourlyRate: 420, performanceScore: 92 },
    { employeeId: 'EMP-102', name: 'Manoj Pawar', email: 'manoj.pawar@manufacture.com', phone: '+91 98901 22002', department: dept('PROD'), role: 'Moulding Operator', shift: 'Shift B (14:00-22:00)', skillSet: ['Injection Moulding', 'Mould Change'], status: 'On Task', joinDate: ago(980), hourlyRate: 360, performanceScore: 85 },
    { employeeId: 'EMP-103', name: 'Sunita Kale', email: 'sunita.kale@manufacture.com', phone: '+91 98901 22003', department: dept('QA'), role: 'QC Inspector', shift: 'Shift A (06:00-14:00)', skillSet: ['CMM', 'Hardness Testing', 'Visual Inspection'], status: 'Available', joinDate: ago(760), hourlyRate: 380, performanceScore: 88 },
    { employeeId: 'EMP-104', name: 'Rakesh Yadav', email: 'rakesh.yadav@manufacture.com', phone: '+91 98901 22004', department: dept('PROD'), role: 'Press Operator', shift: 'Shift A (06:00-14:00)', skillSet: ['Hydraulic Press', 'Die Setting'], status: 'On Task', joinDate: ago(1120), hourlyRate: 340, performanceScore: 79 },
    { employeeId: 'EMP-105', name: 'Farhan Shaikh', email: 'farhan.shaikh@manufacture.com', phone: '+91 98901 22005', department: dept('PROD'), role: 'Welding Technician', shift: 'Shift C (22:00-06:00)', skillSet: ['MIG Welding', 'Robotic Welding', 'Blueprint Reading'], status: 'Available', joinDate: ago(540), hourlyRate: 390, performanceScore: 83 },
    { employeeId: 'EMP-106', name: 'Vaishali More', email: 'vaishali.more@manufacture.com', phone: '+91 98901 22006', department: dept('INV'), role: 'Store Keeper', shift: 'General', skillSet: ['Inventory Control', 'FIFO', 'ERP Entry'], status: 'Available', joinDate: ago(1320), hourlyRate: 300, performanceScore: 90 },
    { employeeId: 'EMP-107', name: 'Dinesh Chaudhari', email: 'dinesh.chaudhari@manufacture.com', phone: '+91 98901 22007', department: dept('MNT'), role: 'Maintenance Technician', shift: 'Shift B (14:00-22:00)', skillSet: ['Hydraulics', 'Pneumatics', 'Electrical'], status: 'On Task', joinDate: ago(1650), hourlyRate: 430, performanceScore: 87 },
    { employeeId: 'EMP-108', name: 'Pooja Shirke', email: 'pooja.shirke@manufacture.com', phone: '+91 98901 22008', department: dept('QA'), role: 'Lab Analyst', shift: 'Shift A (06:00-14:00)', skillSet: ['Spectrometry', 'Hardness Testing'], status: 'Available', joinDate: ago(410), hourlyRate: 370, performanceScore: 81 },
    { employeeId: 'EMP-109', name: 'Ganesh Bhosale', email: 'ganesh.bhosale@manufacture.com', phone: '+91 98901 22009', department: dept('PACK'), role: 'Packaging Supervisor', shift: 'Shift A (06:00-14:00)', skillSet: ['Packaging', 'Label Verification'], status: 'On Leave', joinDate: ago(890), hourlyRate: 320, performanceScore: 74 },
    { employeeId: 'EMP-110', name: 'Nitin Jadhav', email: 'nitin.jadhav@manufacture.com', phone: '+91 98901 22010', department: dept('PROD'), role: 'Assembly Fitter', shift: 'Shift B (14:00-22:00)', skillSet: ['Assembly', 'Torque Tools'], status: 'On Task', joinDate: ago(640), hourlyRate: 330, performanceScore: 86 },
    { employeeId: 'EMP-111', name: 'Snehal Kadam', email: 'snehal.kadam@manufacture.com', phone: '+91 98901 22011', department: dept('QA'), role: 'Final Inspector', shift: 'Shift C (22:00-06:00)', skillSet: ['Final Inspection', 'Report Writing'], status: 'Available', joinDate: ago(300), hourlyRate: 350, performanceScore: 77 },
    { employeeId: 'EMP-112', name: 'Vijay Salunkhe', email: 'vijay.salunkhe@manufacture.com', phone: '+91 98901 22012', department: dept('MNT'), role: 'Electrician', shift: 'Shift A (06:00-14:00)', skillSet: ['Panel Wiring', 'PLC Basics'], status: 'Available', joinDate: ago(1210), hourlyRate: 400, performanceScore: 82 },
  ]);
  const emp = (code) => employees.find((e) => e.employeeId === code)._id;

  /* ----------------------------- Production orders -------------------------- */
  const orderDefs = [
    { no: 1, p: 'PRD-1001', pname: 'Precision Bearing Assembly', qty: 1200, prod: 1200, rej: 22, start: 165, due: 145, status: 'Completed', priority: 'High', machine: ['MCH-001'], mats: [['RM-001', 1450], ['RM-005', 4800]], completedDaysAgo: 143 },
    { no: 2, p: 'PRD-1003', pname: 'Steel Mounting Bracket', qty: 2500, prod: 2500, rej: 45, start: 140, due: 120, status: 'Completed', priority: 'Medium', machine: ['MCH-003'], mats: [['RM-001', 6000], ['RM-005', 5000]], completedDaysAgo: 118 },
    { no: 3, p: 'PRD-1005', pname: 'Aluminium Heat Sink', qty: 1800, prod: 1800, rej: 18, start: 110, due: 88, status: 'Completed', priority: 'High', machine: ['MCH-001'], mats: [['RM-002', 1620]], completedDaysAgo: 86 },
    { no: 4, p: 'PRD-1002', pname: 'Hydraulic Cylinder 50T', qty: 180, prod: 180, rej: 6, start: 85, due: 60, status: 'Completed', priority: 'Critical', machine: ['MCH-003', 'MCH-005'], mats: [['RM-001', 3200], ['RM-007', 120], ['RM-009', 360]], completedDaysAgo: 58 },
    { no: 5, p: 'PRD-1004', pname: 'Gear Shaft 32T', qty: 900, prod: 900, rej: 14, start: 62, due: 40, status: 'Completed', priority: 'High', machine: ['MCH-005'], mats: [['RM-012', 1100], ['RM-002', 340]], completedDaysAgo: 39 },
    { no: 6, p: 'PRD-1006', pname: 'Control Panel Enclosure', qty: 240, prod: 240, rej: 8, start: 45, due: 22, status: 'Completed', priority: 'Medium', machine: ['MCH-004'], mats: [['RM-001', 980], ['RM-008', 640], ['RM-010', 240]], completedDaysAgo: 21 },
    { no: 7, p: 'PRD-1001', pname: 'Precision Bearing Assembly', qty: 1500, prod: 940, rej: 12, start: 26, due: 8, status: 'In Progress', priority: 'High', machine: ['MCH-001'], mats: [['RM-001', 1800], ['RM-005', 6000], ['RM-004', 1500]] },
    { no: 8, p: 'PRD-1005', pname: 'Aluminium Heat Sink', qty: 2200, prod: 1480, rej: 20, start: 20, due: 6, status: 'In Progress', priority: 'Critical', machine: ['MCH-001', 'MCH-005'], mats: [['RM-002', 1980], ['RM-010', 1100]] },
    { no: 9, p: 'PRD-1002', pname: 'Hydraulic Cylinder 50T', qty: 150, prod: 45, rej: 3, start: 12, due: -2, status: 'In Progress', priority: 'Critical', machine: ['MCH-003'], mats: [['RM-001', 2600], ['RM-007', 90], ['RM-009', 300]] },
    { no: 10, p: 'PRD-1003', pname: 'Steel Mounting Bracket', qty: 3000, prod: 0, rej: 0, start: 5, due: 18, status: 'Approved', priority: 'Medium', machine: ['MCH-003'], mats: [['RM-001', 7200], ['RM-005', 6000]] },
    { no: 11, p: 'PRD-1004', pname: 'Gear Shaft 32T', qty: 750, prod: 0, rej: 0, start: 2, due: 30, status: 'Planned', priority: 'High', machine: ['MCH-005'], mats: [['RM-012', 900], ['RM-002', 280]] },
    { no: 12, p: 'PRD-1006', pname: 'Control Panel Enclosure', qty: 320, prod: 0, rej: 0, start: -3, due: 25, status: 'On Hold', priority: 'Low', machine: ['MCH-004'], mats: [['RM-001', 1250], ['RM-008', 820], ['RM-010', 320]] },
    { no: 13, p: 'PRD-1001', pname: 'Precision Bearing Assembly', qty: 600, prod: 0, rej: 0, start: -8, due: 12, status: 'Cancelled', priority: 'Low', machine: [], mats: [['RM-001', 720]] },
  ];

  const orders = [];
  for (const o of orderDefs) {
    const materialLines = o.mats.map(([code, qty]) => {
      const m = materials.find((x) => x.materialCode === code);
      const consumed = o.status === 'Completed' ? qty : Math.round(qty * (o.prod / o.qty) * 100) / 100;
      return { material: m._id, materialName: m.name, unit: m.unit, requiredQty: qty, consumedQty: consumed };
    });
    const doc = await ProductionOrder.create({
      orderNumber: `PO-${new Date().getFullYear()}-${String(o.no).padStart(4, '0')}`,
      product: prod(o.p),
      productName: o.pname,
      productCode: o.p,
      unit: 'Nos',
      quantity: o.qty,
      producedQuantity: o.prod,
      rejectedQuantity: o.rej,
      startDate: ago(o.start),
      expectedCompletionDate: o.status === 'Completed' ? ago(o.completedDaysAgo) : o.due >= 0 ? ahead(o.due) : ago(Math.abs(o.due)),
      actualCompletionDate: o.completedDaysAgo ? ago(o.completedDaysAgo) : undefined,
      priority: o.priority,
      status: o.status,
      productionManager: user('manager@manufacture.com'),
      department: dept('PROD'),
      machines: o.machine.map(mc),
      materials: materialLines,
      notes: o.status === 'Cancelled' ? 'Cancelled by customer — revised PO expected next quarter.' : 'Standard production run as per routing sheet.',
      createdBy: user('admin@manufacture.com'),
    });
    orders.push(doc);
  }
  await ProductionOrder.updateMany({ 'status': { $in: ['In Progress'] } }, [{ $set: { updatedAt: new Date() } }]);

  /* -------------------------------- Schedules ------------------------------- */
  const scheduleDefs = [
    { order: 6, machine: 'MCH-001', date: -4, shift: 'Shift A (06:00-14:00)', start: '06:00', end: '14:00', planned: 300, produced: 300, status: 'Completed', emps: ['EMP-101', 'EMP-110'] },
    { order: 7, machine: 'MCH-001', date: 0, shift: 'Shift A (06:00-14:00)', start: '06:00', end: '14:00', planned: 400, produced: 260, status: 'In Progress', emps: ['EMP-101', 'EMP-104'] },
    { order: 7, machine: 'MCH-001', date: 1, shift: 'Shift A (06:00-14:00)', start: '06:00', end: '14:00', planned: 400, produced: 0, status: 'Scheduled', emps: ['EMP-101'] },
    { order: 8, machine: 'MCH-005', date: 0, shift: 'Shift B (14:00-22:00)', start: '14:00', end: '22:00', planned: 240, produced: 150, status: 'In Progress', emps: ['EMP-105'] },
    { order: 8, machine: 'MCH-005', date: 2, shift: 'Shift B (14:00-22:00)', start: '14:00', end: '22:00', planned: 240, produced: 0, status: 'Scheduled', emps: ['EMP-105', 'EMP-110'] },
    { order: 9, machine: 'MCH-003', date: -2, shift: 'Shift A (06:00-14:00)', start: '06:00', end: '14:00', planned: 25, produced: 12, status: 'Delayed', emps: ['EMP-104'] },
    { order: 9, machine: 'MCH-003', date: 0, shift: 'Shift C (22:00-06:00)', start: '22:00', end: '06:00', planned: 25, produced: 0, status: 'Scheduled', emps: ['EMP-104', 'EMP-107'] },
    { order: 10, machine: 'MCH-003', date: 3, shift: 'Shift A (06:00-14:00)', start: '06:00', end: '14:00', planned: 500, produced: 0, status: 'Scheduled', emps: ['EMP-104'] },
    { order: 11, machine: 'MCH-005', date: 4, shift: 'Shift A (06:00-14:00)', start: '06:00', end: '14:00', planned: 250, produced: 0, status: 'Scheduled', emps: ['EMP-101'] },
    { order: 12, machine: 'MCH-004', date: 5, shift: 'Shift B (14:00-22:00)', start: '14:00', end: '22:00', planned: 60, produced: 0, status: 'Scheduled', emps: ['EMP-112'] },
  ];

  let schNo = 1;
  for (const s of scheduleDefs) {
    await ProductionSchedule.create({
      scheduleCode: `SCH-${new Date().getFullYear()}-${String(schNo++).padStart(4, '0')}`,
      productionOrder: orders[s.order - 1]._id,
      machine: mc(s.machine),
      employees: s.emps.map(emp),
      scheduleDate: ago(-s.date === 0 ? 0 : -s.date),
      shift: s.shift,
      startTime: s.start,
      endTime: s.end,
      plannedQuantity: s.planned,
      producedQuantity: s.produced,
      status: s.status,
      notes: 'As per weekly production plan',
      createdBy: user('manager@manufacture.com'),
    });
  }

  /* ----------------------------- Quality inspections ------------------------ */
  const parametersTemplate = [
    { name: 'Outer Diameter', unit: 'mm', standardValue: 90, minLimit: 89.9, maxLimit: 90.1 },
    { name: 'Bore Diameter', unit: 'mm', standardValue: 40, minLimit: 39.95, maxLimit: 40.05 },
    { name: 'Weight', unit: 'g', standardValue: 850, minLimit: 840, maxLimit: 860 },
    { name: 'Surface Roughness', unit: 'Ra', standardValue: 1.6, minLimit: 0.8, maxLimit: 2.0 },
    { name: 'Hardness', unit: 'HRC', standardValue: 45, minLimit: 42, maxLimit: 48 },
  ];

  const inspectionDefs = [
    { order: 1, batch: 'BATCH-2024-A1', date: 148, insp: 200, pass: 194, status: 'Passed', inp: 'qc@manufacture.com' },
    { order: 1, batch: 'BATCH-2024-A2', date: 144, insp: 200, pass: 185, status: 'Failed', inp: 'qc@manufacture.com' },
    { order: 2, batch: 'BATCH-2024-B1', date: 130, insp: 300, pass: 295, status: 'Passed', inp: 'inspector2@manufacture.com' },
    { order: 3, batch: 'BATCH-2024-C1', date: 100, insp: 250, pass: 248, status: 'Passed', inp: 'qc@manufacture.com' },
    { order: 4, batch: 'BATCH-2024-D1', date: 70, insp: 60, pass: 55, status: 'Rework Required', inp: 'inspector2@manufacture.com' },
    { order: 5, batch: 'BATCH-2024-E1', date: 50, insp: 180, pass: 176, status: 'Passed', inp: 'qc@manufacture.com' },
    { order: 6, batch: 'BATCH-2024-F1', date: 30, insp: 80, pass: 78, status: 'Passed', inp: 'qc@manufacture.com' },
    { order: 7, batch: 'BATCH-2025-G1', date: 14, insp: 150, pass: 145, status: 'Passed', inp: 'inspector2@manufacture.com' },
    { order: 7, batch: 'BATCH-2025-G2', date: 7, insp: 150, pass: 138, status: 'Failed', inp: 'qc@manufacture.com' },
    { order: 8, batch: 'BATCH-2025-H1', date: 5, insp: 200, pass: 192, status: 'Passed', inp: 'inspector2@manufacture.com' },
    { order: 9, batch: 'BATCH-2025-I1', date: 3, insp: 40, pass: 0, status: 'Pending Inspection', inp: 'qc@manufacture.com' },
    { order: 8, batch: 'BATCH-2025-H2', date: 1, insp: 120, pass: 110, rework: 6, status: 'Rework Required', inp: 'qc@manufacture.com' },
  ];

  let inspNo = 1;
  for (const i of inspectionDefs) {
    const order = orders[i.order - 1];
    const fail = i.status === 'Failed' || i.status === 'Rework Required';
    const parameters = parametersTemplate.map((p, idx) => {
      const drift = fail && idx < 2 ? (p.maxLimit - p.standardValue) * 2.4 : (Math.random() - 0.5) * (p.maxLimit - p.minLimit) * 0.4;
      return { ...p, actualValue: round(p.standardValue + drift) };
    });
    const inspection = new QualityInspection({
      inspectionNumber: `QI-${new Date().getFullYear()}-${String(inspNo++).padStart(4, '0')}`,
      productionOrder: order._id,
      orderNumber: order.orderNumber,
      product: order.product,
      productName: order.productName,
      batchNumber: i.batch.replace('2024', new Date().getFullYear()).replace('2025', new Date().getFullYear()),
      inspectionDate: ago(i.date),
      inspector: user(i.inp),
      inspectorName: users.find((u) => u.email === i.inp).name,
      qualityStandard: order.productName.includes('Gear') ? 'IATF 16949' : 'ISO 9001:2015',
      inspectedQuantity: i.insp,
      passedQuantity: i.pass,
      rejectedQuantity: i.insp - i.pass,
      reworkQuantity: i.rework || 0,
      parameters,
      status: i.status,
      remarks: fail ? 'Dimensional deviation observed — corrective action raised with production.' : 'Batch within specification limits.',
    });
    await inspection.save(); // pre-save hook computes % and status
    if (i.status === 'Passed') {
      await QualityInspection.updateOne({ _id: inspection._id }, { $set: { approvedBy: user('qc@manufacture.com'), approvedAt: ago(i.date) } });
    }
  }

  /* ------------------------------ Defect records ---------------------------- */
  const defectDefs = [
    { order: 2, cat: 'Dimensional Defect', sev: 'Major', qty: 30, days: 128, rework: 'Reworked', status: 'Closed', desc: 'Bracket hole pitch measured 82.4mm against the 80.0 ±0.2mm specification on the 3rd drilling station.', dept: 'PROD', action: 'Drill jig re-aligned and first-off inspection added to the routing sheet.' },
    { order: 4, cat: 'Surface Defect', sev: 'Critical', qty: 8, days: 66, rework: 'Scrapped', status: 'Closed', desc: 'Deep tool marks and scoring on cylinder bore surface, roughness Ra 3.8 against 1.6 limit.', dept: 'PROD', action: 'Honing tool replaced; coolant concentration corrected to 8%.' },
    { order: 7, cat: 'Assembly Defect', sev: 'Major', qty: 12, days: 10, rework: 'In Rework', status: 'In Progress', desc: 'Bearing pre-load out of range — excessive axial play observed during assembly verification.', dept: 'PROD', action: 'Shim thickness reviewed; re-torqueing as per revised SOP.' },
    { order: 8, cat: 'Material Defect', sev: 'Major', qty: 6, days: 6, rework: 'Pending', status: 'Under Analysis', desc: 'Aluminium billet batch showing porosity after machining — suspected supplier casting defect.', dept: 'QA', action: 'Supplier 8D raised; incoming inspection frequency doubled.' },
    { order: 9, cat: 'Functional Defect', sev: 'Critical', qty: 3, days: 2, rework: 'In Rework', status: 'Open', desc: 'Hydraulic cylinder failing pressure hold test at 210 bar — internal seal leak detected.', dept: 'QA', action: 'Seal supplier lot quarantined; re-test planned after reseal.' },
    { order: 7, cat: 'Packaging Defect', sev: 'Minor', qty: 15, days: 4, rework: 'Not Required', status: 'Closed', desc: 'Corrugated boxes delivered with crushed corners affecting branding.', dept: 'PACK', action: 'Packaging supplier warned; stack height guidelines re-issued.' },
  ];

  let defNo = 1;
  for (const d of defectDefs) {
    const order = orders[d.order - 1];
    await DefectRecord.create({
      defectNumber: `DEF-${new Date().getFullYear()}-${String(defNo++).padStart(4, '0')}`,
      productionOrder: order._id,
      orderNumber: order.orderNumber,
      product: order.product,
      productName: order.productName,
      batchNumber: `BATCH-${new Date().getFullYear()}-${String.fromCharCode(64 + d.order)}1`,
      defectCategory: d.cat,
      severity: d.sev,
      description: d.desc,
      quantity: d.qty,
      responsibleDepartment: dept(d.dept),
      rootCause: 'Process parameter drift identified during 5-Why analysis.',
      correctiveAction: d.action,
      reworkStatus: d.rework,
      reworkQuantity: d.rework === 'Reworked' || d.rework === 'In Rework' ? d.qty : 0,
      reportedBy: user('qc@manufacture.com'),
      reportedByName: 'Priya Nair',
      detectedDate: ago(d.days),
      closedAt: d.status === 'Closed' ? ago(d.days - 2) : undefined,
      status: d.status,
    });
  }

  /* ---------------------------- Maintenance records ------------------------- */
  const maintenanceDefs = [
    { machine: 'MCH-001', type: 'Preventive', sched: -24, done: -24, desc: 'Quarterly preventive maintenance — lubrication, belt tension, spindle run-out check.', tech: 'Dinesh Chaudhari', cost: 8400, down: 6, status: 'Completed', parts: ['Spindle belt', 'Lube oil 5L'] },
    { machine: 'MCH-002', type: 'Preventive', sched: -40, done: -40, desc: 'Mould clamping force calibration and hydraulic filter replacement.', tech: 'Dinesh Chaudhari', cost: 12600, down: 8, status: 'Completed', parts: ['Hydraulic filter', 'Seal kit'] },
    { machine: 'MCH-004', type: 'Breakdown', sched: -2, desc: 'Welding torch alignment failure — wire feeder jammed mid-shift.', tech: 'Vijay Salunkhe', cost: 5400, down: 4, status: 'In Progress', parts: ['Wire feeder assembly'] },
    { machine: 'MCH-006', type: 'Breakdown', sched: 0, desc: 'Conveyor belt snapped on packaging line; production diverted to manual packing.', tech: 'Vijay Salunkhe', cost: 18000, down: 9, status: 'In Progress', parts: ['Conveyor belt 3m'] },
    { machine: 'MCH-005', type: 'Preventive', sched: 9, desc: 'Grinding wheel dressing and coolant system flush.', tech: 'Dinesh Chaudhari', cost: 6200, down: 5, status: 'Scheduled', parts: ['Grinding wheel'] },
    { machine: 'MCH-003', type: 'Predictive', sched: 20, desc: 'Hydraulic oil analysis and pump pressure check.', tech: 'Vijay Salunkhe', cost: 4100, down: 3, status: 'Scheduled', parts: [] },
  ];

  let mntNo = 1;
  for (const m of maintenanceDefs) {
    await MaintenanceRecord.create({
      maintenanceCode: `MNT-${new Date().getFullYear()}-${String(mntNo++).padStart(4, '0')}`,
      machine: mc(m.machine),
      machineName: machines.find((x) => x.machineCode === m.machine).name,
      type: m.type,
      scheduledDate: ago(-m.sched === 0 ? 0 : -m.sched),
      completedDate: m.done !== undefined ? ago(-m.done === 0 ? 0 : -m.done) : undefined,
      technician: m.tech,
      description: m.desc,
      partsReplaced: m.parts,
      downtimeHours: m.down,
      cost: m.cost,
      status: m.status,
    });
  }

  /* -------------------------- Employee task allocation ---------------------- */
  const taskPlan = [
    { emp: 'EMP-101', order: 7, task: 'CNC turning of bearing races — 400 nos', status: 'In Progress' },
    { emp: 'EMP-104', order: 9, task: 'Hydraulic press forming of cylinder barrels', status: 'In Progress' },
    { emp: 'EMP-105', order: 8, task: 'Grinding and finishing of heat sinks', status: 'In Progress' },
    { emp: 'EMP-110', order: 7, task: 'Final assembly and torque verification', status: 'Assigned' },
    { emp: 'EMP-107', order: 6, task: 'Machine maintenance support during enclosure run', status: 'Completed' },
    { emp: 'EMP-102', order: 10, task: 'Mould setup for bracket production', status: 'Assigned' },
  ];
  for (const t of taskPlan) {
    const order = orders[t.order - 1];
    await Employee.updateOne(
      { employeeId: t.emp },
      { $push: { assignedTasks: { productionOrder: order._id, orderNumber: order.orderNumber, task: t.task, status: t.status } } }
    );
  }

  /* ------------------------------- Notifications ---------------------------- */
  await Notification.create([
    { title: 'Shift handover completed', message: 'Shift A handover to Shift B completed with 3 open work orders on MCH-001.', type: 'system', severity: 'info', module: 'production', targetRoles: ['Admin', 'Production Manager'], link: '/production' },
    { title: 'Pending QC approval', message: 'Batch BATCH-' + new Date().getFullYear() + '-I1 is awaiting final inspection approval.', type: 'approval', severity: 'warning', module: 'quality', targetRoles: ['Admin', 'Quality Control Inspector'], link: '/quality-control' },
    { title: 'Monthly production target', message: 'Monthly production has reached 92% of the planned target with 5 working days remaining.', type: 'system', severity: 'success', module: 'dashboard', targetRoles: [], link: '/reports' },
  ]);

  // Alert engine → low stock, deadlines, breakdowns
  const alertsCreated = await runSystemChecks();

  console.log('\n  ✔  Seed complete');
  console.log('  ────────────────────────────────────────────────');
  console.log(`  Departments        : ${departments.length}`);
  console.log(`  Users              : ${users.length}`);
  console.log(`  Products           : ${products.length}`);
  console.log(`  Raw materials      : ${materials.length}`);
  console.log(`  Suppliers          : ${suppliers.length}`);
  console.log(`  Machines           : ${machines.length}`);
  console.log(`  Employees          : ${employees.length}`);
  console.log(`  Production orders  : ${orders.length}`);
  console.log(`  Schedules          : ${scheduleDefs.length}`);
  console.log(`  Inspections        : ${inspectionDefs.length}`);
  console.log(`  Defect records     : ${defectDefs.length}`);
  console.log(`  Maintenance records: ${maintenanceDefs.length}`);
  console.log(`  Alerts generated   : ${alertsCreated}`);
  console.log('  ────────────────────────────────────────────────');
  console.log('  Login credentials:');
  console.log('   Admin                  admin@manufacture.com      / Admin@123');
  console.log('   Production Manager     manager@manufacture.com    / Manager@123');
  console.log('   QC Inspector           qc@manufacture.com         / Qc@123');
  console.log('   Inventory Manager      inventory@manufacture.com  / Inventory@123');
  console.log('   Machine Operator       operator@manufacture.com   / Operator@123');
  console.log('  ────────────────────────────────────────────────\n');
}

(async () => {
  try {
    await connectDB(MONGO_URI);
    if (process.argv.includes('--destroy')) await destroy();
    else await seed();
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
})();

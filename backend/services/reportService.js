const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const ProductionOrder = require('../models/ProductionOrder');
const QualityInspection = require('../models/QualityInspection');
const DefectRecord = require('../models/DefectRecord');
const RawMaterial = require('../models/RawMaterial');
const Machine = require('../models/Machine');
const Employee = require('../models/Employee');

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
const num = (n) => Number(n || 0).toLocaleString('en-IN');

function rangeFilter(field, from, to) {
  if (!from && !to) return {};
  const f = {};
  if (from) f.$gte = new Date(from);
  if (to) {
    const t = new Date(to);
    t.setHours(23, 59, 59, 999);
    f.$lte = t;
  }
  return { [field]: f };
}

const REPORTS = {
  'daily-production': { title: 'Daily Production Report', dateField: 'startDate' },
  'weekly-production': { title: 'Weekly Production Report', dateField: 'startDate' },
  'monthly-production': { title: 'Monthly Production Report', dateField: 'startDate' },
  'production-efficiency': { title: 'Production Efficiency Report', dateField: 'startDate' },
  'quality-inspection': { title: 'Quality Inspection Report', dateField: 'inspectionDate' },
  'defect-analysis': { title: 'Defect Analysis Report', dateField: 'detectedDate' },
  'material-consumption': { title: 'Raw Material Consumption Report', dateField: 'createdAt' },
  'machine-utilization': { title: 'Machine Utilization Report', dateField: 'createdAt' },
  'employee-performance': { title: 'Employee Performance Report', dateField: 'joinDate' },
};

async function buildReport(type, { from, to } = {}) {
  if (!REPORTS[type]) {
    const err = new Error(`Unknown report type. Supported: ${Object.keys(REPORTS).join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  const base = REPORTS[type];
  const report = { type, title: base.title, from: from || null, to: to || null, columns: [], rows: [], summary: [] };

  switch (type) {
    case 'daily-production':
    case 'weekly-production':
    case 'monthly-production':
    case 'production-efficiency': {
      const orders = await ProductionOrder.find(rangeFilter(base.dateField, from, to)).sort({ startDate: -1 }).lean();
      report.columns = [
        { key: 'orderNumber', header: 'Order No', width: 16 },
        { key: 'productName', header: 'Product', width: 26 },
        { key: 'quantity', header: 'Planned', width: 10 },
        { key: 'producedQuantity', header: 'Produced', width: 10 },
        { key: 'rejectedQuantity', header: 'Rejected', width: 10 },
        { key: 'efficiency', header: 'Efficiency %', width: 12 },
        { key: 'status', header: 'Status', width: 14 },
        { key: 'startDate', header: 'Start', width: 12 },
        { key: 'expectedCompletionDate', header: 'Due', width: 12 },
      ];
      report.rows = orders.map((o) => ({
        orderNumber: o.orderNumber,
        productName: o.productName,
        quantity: o.quantity,
        producedQuantity: o.producedQuantity,
        rejectedQuantity: o.rejectedQuantity,
        efficiency: o.quantity ? Math.round((o.producedQuantity / o.quantity) * 10000) / 100 : 0,
        status: o.status,
        startDate: fmtDate(o.startDate),
        expectedCompletionDate: fmtDate(o.expectedCompletionDate),
      }));
      const planned = orders.reduce((s, o) => s + o.quantity, 0);
      const produced = orders.reduce((s, o) => s + o.producedQuantity, 0);
      report.summary = [
        { label: 'Orders', value: orders.length },
        { label: 'Planned Units', value: num(planned) },
        { label: 'Produced Units', value: num(produced) },
        { label: 'Efficiency', value: `${planned ? Math.round((produced / planned) * 100) : 0}%` },
      ];
      break;
    }
    case 'quality-inspection': {
      const rows = await QualityInspection.find(rangeFilter(base.dateField, from, to)).sort({ inspectionDate: -1 }).lean();
      report.columns = [
        { key: 'inspectionNumber', header: 'Inspection No', width: 16 },
        { key: 'batchNumber', header: 'Batch', width: 14 },
        { key: 'productName', header: 'Product', width: 24 },
        { key: 'inspectorName', header: 'Inspector', width: 18 },
        { key: 'inspectedQuantity', header: 'Inspected', width: 11 },
        { key: 'passedQuantity', header: 'Passed', width: 10 },
        { key: 'rejectedQuantity', header: 'Rejected', width: 10 },
        { key: 'qualityPassPercentage', header: 'Pass %', width: 10 },
        { key: 'status', header: 'Status', width: 16 },
        { key: 'inspectionDate', header: 'Date', width: 12 },
      ];
      report.rows = rows.map((r) => ({
        inspectionNumber: r.inspectionNumber,
        batchNumber: r.batchNumber,
        productName: r.productName,
        inspectorName: r.inspectorName,
        inspectedQuantity: r.inspectedQuantity,
        passedQuantity: r.passedQuantity,
        rejectedQuantity: r.rejectedQuantity,
        qualityPassPercentage: r.qualityPassPercentage,
        status: r.status,
        inspectionDate: fmtDate(r.inspectionDate),
      }));
      const inspected = rows.reduce((s, r) => s + r.inspectedQuantity, 0);
      const passed = rows.reduce((s, r) => s + r.passedQuantity, 0);
      report.summary = [
        { label: 'Inspections', value: rows.length },
        { label: 'Inspected', value: num(inspected) },
        { label: 'Passed', value: num(passed) },
        { label: 'Pass %', value: `${inspected ? Math.round((passed / inspected) * 100) : 0}%` },
      ];
      break;
    }
    case 'defect-analysis': {
      const rows = await DefectRecord.find(rangeFilter(base.dateField, from, to)).sort({ detectedDate: -1 }).lean();
      report.columns = [
        { key: 'defectNumber', header: 'Defect No', width: 16 },
        { key: 'defectCategory', header: 'Category', width: 20 },
        { key: 'productName', header: 'Product', width: 22 },
        { key: 'batchNumber', header: 'Batch', width: 14 },
        { key: 'quantity', header: 'Qty', width: 8 },
        { key: 'severity', header: 'Severity', width: 11 },
        { key: 'reworkStatus', header: 'Rework', width: 14 },
        { key: 'status', header: 'Status', width: 14 },
        { key: 'detectedDate', header: 'Detected', width: 12 },
      ];
      report.rows = rows.map((r) => ({
        defectNumber: r.defectNumber,
        defectCategory: r.defectCategory,
        productName: r.productName,
        batchNumber: r.batchNumber,
        quantity: r.quantity,
        severity: r.severity,
        reworkStatus: r.reworkStatus,
        status: r.status,
        detectedDate: fmtDate(r.detectedDate),
      }));
      report.summary = [
        { label: 'Defect Records', value: rows.length },
        { label: 'Defective Units', value: num(rows.reduce((s, r) => s + r.quantity, 0)) },
        { label: 'Critical', value: rows.filter((r) => r.severity === 'Critical').length },
        { label: 'Open', value: rows.filter((r) => r.status !== 'Closed').length },
      ];
      break;
    }
    case 'material-consumption': {
      const [materials, consumed] = await Promise.all([
        RawMaterial.find().populate('supplier', 'name').lean(),
        ProductionOrder.aggregate([
          { $unwind: '$materials' },
          { $group: { _id: '$materials.material', consumedQty: { $sum: { $ifNull: ['$materials.consumedQty', 0] } } } },
        ]),
      ]);
      const map = consumed.reduce((acc, c) => ({ ...acc, [String(c._id)]: c.consumedQty }), {});
      report.columns = [
        { key: 'materialCode', header: 'Material ID', width: 15 },
        { key: 'name', header: 'Material', width: 26 },
        { key: 'category', header: 'Category', width: 14 },
        { key: 'availableQuantity', header: 'Available', width: 12 },
        { key: 'minimumStockLevel', header: 'Min Level', width: 11 },
        { key: 'consumedQty', header: 'Consumed', width: 12 },
        { key: 'unit', header: 'Unit', width: 8 },
        { key: 'stockStatus', header: 'Stock Status', width: 14 },
        { key: 'supplier', header: 'Supplier', width: 22 },
      ];
      report.rows = materials.map((m) => ({
        materialCode: m.materialCode,
        name: m.name,
        category: m.category,
        availableQuantity: m.availableQuantity,
        minimumStockLevel: m.minimumStockLevel,
        consumedQty: Math.round((map[String(m._id)] || 0) * 100) / 100,
        unit: m.unit,
        stockStatus: m.availableQuantity <= 0 ? 'Out of Stock' : m.availableQuantity < m.minimumStockLevel ? 'Low Stock' : 'In Stock',
        supplier: m.supplier?.name || '—',
      }));
      report.summary = [
        { label: 'Materials', value: materials.length },
        { label: 'Low Stock', value: materials.filter((m) => m.availableQuantity < m.minimumStockLevel).length },
        { label: 'Total Consumed', value: num(Object.values(map).reduce((s, v) => s + v, 0)) },
      ];
      break;
    }
    case 'machine-utilization': {
      const machines = await Machine.find().sort({ machineCode: 1 }).lean();
      report.columns = [
        { key: 'machineCode', header: 'Machine ID', width: 13 },
        { key: 'name', header: 'Machine', width: 24 },
        { key: 'type', header: 'Type', width: 18 },
        { key: 'status', header: 'Status', width: 16 },
        { key: 'operatingHours', header: 'Op. Hours', width: 11 },
        { key: 'utilizationPercentage', header: 'Utilization %', width: 13 },
        { key: 'nextMaintenanceDate', header: 'Next Maint.', width: 14 },
      ];
      report.rows = machines.map((m) => ({
        machineCode: m.machineCode,
        name: m.name,
        type: m.type,
        status: m.status,
        operatingHours: m.operatingHours,
        utilizationPercentage: m.utilizationPercentage,
        nextMaintenanceDate: fmtDate(m.nextMaintenanceDate),
      }));
      report.summary = [
        { label: 'Machines', value: machines.length },
        { label: 'Running', value: machines.filter((m) => m.status === 'Running').length },
        { label: 'Breakdown', value: machines.filter((m) => m.status === 'Breakdown').length },
        {
          label: 'Avg Utilization',
          value: `${machines.length ? Math.round(machines.reduce((s, m) => s + (m.utilizationPercentage || 0), 0) / machines.length) : 0}%`,
        },
      ];
      break;
    }
    case 'employee-performance': {
      const employees = await Employee.find().populate('department', 'name').lean();
      report.columns = [
        { key: 'employeeId', header: 'Employee ID', width: 13 },
        { key: 'name', header: 'Name', width: 22 },
        { key: 'department', header: 'Department', width: 16 },
        { key: 'role', header: 'Role', width: 20 },
        { key: 'shift', header: 'Shift', width: 20 },
        { key: 'assigned', header: 'Tasks Assigned', width: 15 },
        { key: 'completed', header: 'Tasks Done', width: 12 },
        { key: 'performanceScore', header: 'Score', width: 9 },
        { key: 'status', header: 'Status', width: 12 },
      ];
      report.rows = employees.map((e) => ({
        employeeId: e.employeeId,
        name: e.name,
        department: e.department?.name || '—',
        role: e.role,
        shift: e.shift,
        assigned: (e.assignedTasks || []).length,
        completed: (e.assignedTasks || []).filter((t) => t.status === 'Completed').length,
        performanceScore: e.performanceScore,
        status: e.status,
      }));
      const totalTasks = employees.reduce((s, e) => s + (e.assignedTasks || []).length, 0);
      const doneTasks = employees.reduce((s, e) => s + (e.assignedTasks || []).filter((t) => t.status === 'Completed').length, 0);
      report.summary = [
        { label: 'Employees', value: employees.length },
        { label: 'Tasks Assigned', value: totalTasks },
        { label: 'Completed', value: doneTasks },
        { label: 'Avg Score', value: employees.length ? Math.round(employees.reduce((s, e) => s + e.performanceScore, 0) / employees.length) : 0 },
      ];
      break;
    }
    default:
      break;
  }

  report.generatedAt = new Date().toISOString();
  return report;
}

async function toExcel(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Manufacturing ERP';
  wb.created = new Date();
  const ws = wb.addWorksheet(report.title.slice(0, 31));

  ws.mergeCells(1, 1, 1, report.columns.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = report.title;
  titleCell.font = { size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12203F' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, report.columns.length);
  ws.getCell(2, 1).value = `Period: ${report.from || 'All time'} → ${report.to || 'Today'}   |   Generated: ${new Date(report.generatedAt).toLocaleString('en-IN')}`;
  ws.getCell(2, 1).font = { size: 9, italic: true, color: { argb: 'FF556080' } };

  const headerRow = ws.getRow(4);
  report.columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563A8' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    ws.getColumn(idx + 1).width = col.width || 14;
  });
  headerRow.height = 22;

  report.rows.forEach((row, rIdx) => {
    const excelRow = ws.getRow(5 + rIdx);
    report.columns.forEach((col, cIdx) => {
      const cell = excelRow.getCell(cIdx + 1);
      cell.value = row[col.key];
      cell.font = { size: 10 };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDE3EE' } } };
      if (rIdx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FC' } };
    });
  });

  const summaryStart = 6 + report.rows.length;
  ws.getCell(summaryStart, 1).value = 'Summary';
  ws.getCell(summaryStart, 1).font = { bold: true, size: 11, color: { argb: 'FF12203F' } };
  report.summary.forEach((s, i) => {
    ws.getCell(summaryStart + 1 + i, 1).value = s.label;
    ws.getCell(summaryStart + 1 + i, 1).font = { bold: true, size: 10 };
    ws.getCell(summaryStart + 1 + i, 2).value = s.value;
  });

  return wb.xlsx.writeBuffer();
}

function toPDF(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header band
    doc.rect(0, 0, doc.page.width, 70).fill('#12203F');
    doc.fillColor('#FFFFFF').fontSize(17).font('Helvetica-Bold').text('Manufacturing Production Planning & Quality Control System', 36, 20, { width: doc.page.width - 72 });
    doc.fontSize(9).font('Helvetica').fillColor('#9FB3D1').text(`Generated ${new Date(report.generatedAt).toLocaleString('en-IN')}`, 36, 46);

    doc.fillColor('#12203F').fontSize(14).font('Helvetica-Bold').text(report.title, 36, 88);
    doc.fontSize(9).font('Helvetica').fillColor('#556080')
      .text(`Period: ${report.from || 'All time'} to ${report.to || 'Today'}   |   Records: ${report.rows.length}`, 36, 106);

    const tableTop = 128;
    const usable = doc.page.width - 72;
    const totalWeight = report.columns.reduce((s, c) => s + (c.width || 14), 0);
    const widths = report.columns.map((c) => ((c.width || 14) / totalWeight) * usable);
    const rowH = 18;

    const drawHeader = (y) => {
      doc.rect(36, y, usable, 20).fill('#2563A8');
      doc.fillColor('#FFFFFF').fontSize(7.6).font('Helvetica-Bold');
      let x = 36;
      report.columns.forEach((c, i) => {
        doc.text(String(c.header).toUpperCase(), x + 4, y + 6, { width: widths[i] - 8, ellipsis: true, lineBreak: false });
        x += widths[i];
      });
      return y + 20;
    };

    let y = drawHeader(tableTop);
    doc.font('Helvetica').fontSize(7.4);

    report.rows.forEach((row, idx) => {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = drawHeader(36);
        doc.font('Helvetica').fontSize(7.4);
      }
      if (idx % 2 === 1) doc.rect(36, y, usable, rowH).fill('#F4F7FC');
      doc.fillColor('#1A2438');
      let x = 36;
      report.columns.forEach((c, i) => {
        const raw = row[c.key];
        const val = raw === null || raw === undefined || raw === '' ? '—' : String(raw);
        doc.text(val, x + 4, y + 5, { width: widths[i] - 8, ellipsis: true, lineBreak: false });
        x += widths[i];
      });
      doc.moveTo(36, y + rowH).lineTo(36 + usable, y + rowH).lineWidth(0.4).strokeColor('#E2E8F2').stroke();
      y += rowH;
    });

    y += 16;
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 40;
    }
    doc.rect(36, y, usable, 44).fill('#EEF3FA');
    doc.fillColor('#12203F').fontSize(9).font('Helvetica-Bold').text('SUMMARY', 48, y + 8);
    let sx = 48;
    report.summary.forEach((s) => {
      doc.fontSize(8).font('Helvetica').fillColor('#556080').text(s.label, sx, y + 22, { width: 130 });
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#12203F').text(String(s.value), sx, y + 31, { width: 130 });
      sx += Math.min(150, usable / Math.max(report.summary.length, 1));
    });
    doc.end();
  });
}

module.exports = { REPORTS, buildReport, toExcel, toPDF };

const Employee = require('../models/Employee');
const ProductionOrder = require('../models/ProductionOrder');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildQuery } = require('../utils/queryFeatures');

const POPULATE = [{ path: 'department', select: 'name code' }];

exports.list = asyncHandler(async (req, res) => {
  const { filter, sort, skip, limit, page } = buildQuery(req.query, {
    searchFields: ['name', 'employeeId', 'role', 'email', 'phone'],
    extraFilters: ['status', 'role', 'department', 'shift'],
  });
  const [data, total] = await Promise.all([
    Employee.find(filter).populate(POPULATE).sort(sort).skip(skip).limit(limit).lean(),
    Employee.countDocuments(filter),
  ]);
  const decorated = data.map((e) => ({
    ...e,
    tasksAssigned: (e.assignedTasks || []).length,
    tasksCompleted: (e.assignedTasks || []).filter((t) => t.status === 'Completed').length,
  }));
  res.json({ success: true, data: decorated, meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
});

exports.all = asyncHandler(async (req, res) => {
  const data = await Employee.find({ status: { $ne: 'Inactive' } }).select('employeeId name role shift status department').populate('department', 'name').sort({ name: 1 }).lean();
  res.json({ success: true, data });
});

exports.get = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id).populate(POPULATE);
  if (!employee) throw new ApiError(404, 'Employee not found.');
  res.json({ success: true, data: employee });
});

exports.create = asyncHandler(async (req, res) => {
  const employee = await Employee.create(req.body);
  res.status(201).json({ success: true, message: 'Employee added successfully.', data: await employee.populate(POPULATE) });
});

exports.update = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new ApiError(404, 'Employee not found.');
  Object.entries(req.body).forEach(([k, v]) => {
    if (v !== undefined && k !== 'employeeId') employee[k] = v;
  });
  await employee.save();
  res.json({ success: true, message: 'Employee updated successfully.', data: await employee.populate(POPULATE) });
});

exports.remove = asyncHandler(async (req, res) => {
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) throw new ApiError(404, 'Employee not found.');
  res.json({ success: true, message: 'Employee removed successfully.' });
});

/** POST /api/employees/:id/tasks — assign a production task */
exports.assignTask = asyncHandler(async (req, res) => {
  const { productionOrder, task } = req.body;
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new ApiError(404, 'Employee not found.');

  const order = await ProductionOrder.findById(productionOrder);
  if (!order) throw new ApiError(404, 'Production order not found.');

  employee.assignedTasks.push({ productionOrder: order._id, orderNumber: order.orderNumber, task: task || 'Production task', status: 'Assigned' });
  employee.status = 'On Task';
  await employee.save();

  res.json({ success: true, message: `Task assigned to ${employee.name}.`, data: await employee.populate(POPULATE) });
});

/** PATCH /api/employees/:id/tasks/:taskId { status } */
exports.updateTaskStatus = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new ApiError(404, 'Employee not found.');
  const task = employee.assignedTasks.id(req.params.taskId);
  if (!task) throw new ApiError(404, 'Task not found for this employee.');

  if (req.body.status) task.status = req.body.status;
  const openTasks = employee.assignedTasks.filter((t) => t.status !== 'Completed').length;
  employee.status = openTasks === 0 ? 'Available' : 'On Task';
  const completed = employee.assignedTasks.filter((t) => t.status === 'Completed').length;
  employee.performanceScore = Math.min(100, Math.round((completed / employee.assignedTasks.length) * 100));
  await employee.save();

  res.json({ success: true, message: 'Task status updated.', data: await employee.populate(POPULATE) });
});

exports.stats = asyncHandler(async (req, res) => {
  const byStatus = await Employee.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byDepartment = await Employee.aggregate([
    { $group: { _id: '$department', count: { $sum: 1 }, avgScore: { $avg: '$performanceScore' } } },
    { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
    { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
    { $project: { name: { $ifNull: ['$dept.name', 'Unassigned'] }, count: 1, avgScore: { $round: ['$avgScore', 1] } } },
  ]);
  res.json({ success: true, data: { total: await Employee.countDocuments(), byStatus, byDepartment } });
});

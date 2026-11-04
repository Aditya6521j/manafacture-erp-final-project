const express = require('express');

const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/departments', require('./departmentRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/production-orders', require('./productionOrderRoutes'));
router.use('/schedules', require('./scheduleRoutes'));
router.use('/materials', require('./materialRoutes'));
router.use('/suppliers', require('./supplierRoutes'));
router.use('/inspections', require('./inspectionRoutes'));
router.use('/defects', require('./defectRoutes'));
router.use('/machines', require('./machineRoutes'));
router.use('/maintenance', require('./maintenanceRoutes'));
router.use('/employees', require('./employeeRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/reports', require('./reportRoutes'));

router.get('/', (req, res) =>
  res.json({
    success: true,
    message: 'Manufacturing Production Planning & Quality Control System API',
    version: '1.0.0',
    endpoints: ['/api/auth', '/api/users', '/api/departments', '/api/products', '/api/production-orders', '/api/schedules',
      '/api/materials', '/api/suppliers', '/api/inspections', '/api/defects', '/api/machines', '/api/maintenance',
      '/api/employees', '/api/notifications', '/api/dashboard', '/api/reports'],
  })
);

module.exports = router;

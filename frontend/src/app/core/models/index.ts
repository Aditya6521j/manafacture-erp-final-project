/* ===================== Shared / domain models ===================== */

export type Role = 'Admin' | 'Production Manager' | 'Quality Control Inspector' | 'Inventory Manager' | 'Machine Operator';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  unread?: number;
  conflicts?: { key: string; scheduleIds: string[]; machine?: string }[];
  delayedCount?: number;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  department?: { _id: string; name: string; code?: string } | string | null;
  isActive?: boolean;
  lastLogin?: string;
  permissions?: string[];
  createdAt?: string;
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  description?: string;
  head?: string;
  location?: string;
  headcount?: number;
  isActive?: boolean;
}

export interface Product {
  _id: string;
  productCode: string;
  name: string;
  category: string;
  unit: string;
  specification?: string;
  drawingNumber?: string;
  standardCycleTimeMin?: number;
  unitPrice?: number;
  qualityStandard?: string;
  isActive?: boolean;
}

export interface OrderMaterialLine {
  material: string | { _id: string; name: string; materialCode: string; unit: string; availableQuantity?: number };
  materialName?: string;
  unit?: string;
  requiredQty: number;
  consumedQty?: number;
}

export type ProductionStatus = 'Planned' | 'Approved' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface ProductionOrder {
  _id: string;
  orderNumber: string;
  product: Product | string;
  productName: string;
  productCode?: string;
  quantity: number;
  producedQuantity: number;
  rejectedQuantity: number;
  unit?: string;
  startDate: string;
  expectedCompletionDate: string;
  actualCompletionDate?: string;
  priority: Priority;
  status: ProductionStatus;
  productionManager?: User | string;
  department?: Department | string;
  machines?: Machine[];
  materials?: OrderMaterialLine[];
  notes?: string;
  progressPercentage?: number;
  isDelayed?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type MachineStatus = 'Running' | 'Idle' | 'Under Maintenance' | 'Breakdown';

export interface Machine {
  _id: string;
  machineCode: string;
  name: string;
  type: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  capacityPerHour?: number;
  location?: string;
  status: MachineStatus;
  operatingHours?: number;
  utilizationPercentage?: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  assignedOrder?: ProductionOrder | string | null;
  breakdownReason?: string;
  isActive?: boolean;
  maintenanceHistory?: MaintenanceRecord[];
}

export interface ProductionSchedule {
  _id: string;
  scheduleCode: string;
  productionOrder: ProductionOrder | string;
  machine: Machine | string;
  employees: Employee[];
  scheduleDate: string;
  shift: string;
  startTime: string;
  endTime: string;
  plannedQuantity: number;
  producedQuantity: number;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Delayed' | 'Cancelled';
  notes?: string;
}

export interface Supplier {
  _id: string;
  supplierCode: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  rating?: number;
  isActive?: boolean;
  materialsSupplied?: { _id: string; name: string; materialCode: string }[];
}

export interface RawMaterial {
  _id: string;
  materialCode: string;
  name: string;
  category: string;
  unit: string;
  availableQuantity: number;
  minimumStockLevel: number;
  requiredQuantity: number;
  unitPrice: number;
  supplier?: Supplier | string;
  warehouseLocation?: string;
  lastRestockedAt?: string;
  stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock';
  isLowStock?: boolean;
  shortage?: number;
}

export interface InspectionParameter {
  name: string;
  unit?: string;
  standardValue?: number | null;
  minLimit: number | null;
  maxLimit: number | null;
  actualValue: number | null;
  result?: 'Pass' | 'Fail';
}

export type QualityStatus = 'Passed' | 'Failed' | 'Pending Inspection' | 'Rework Required';

export interface QualityInspection {
  _id: string;
  inspectionNumber: string;
  productionOrder: ProductionOrder | string;
  orderNumber?: string;
  product?: Product | string;
  productName?: string;
  batchNumber: string;
  inspectionDate: string;
  inspector?: User | string;
  inspectorName?: string;
  qualityStandard?: string;
  inspectedQuantity: number;
  passedQuantity: number;
  rejectedQuantity: number;
  reworkQuantity?: number;
  parameters: InspectionParameter[];
  qualityPassPercentage: number;
  defectPercentage: number;
  status: QualityStatus;
  remarks?: string;
  approvedBy?: User | string;
  approvedAt?: string;
}

export type DefectCategory =
  | 'Dimensional Defect'
  | 'Surface Defect'
  | 'Material Defect'
  | 'Assembly Defect'
  | 'Functional Defect'
  | 'Packaging Defect';

export interface DefectRecord {
  _id: string;
  defectNumber: string;
  productionOrder?: ProductionOrder | string;
  orderNumber?: string;
  productName?: string;
  batchNumber?: string;
  defectCategory: DefectCategory;
  severity: 'Minor' | 'Major' | 'Critical';
  description: string;
  quantity: number;
  images?: string[];
  responsibleDepartment?: Department | string;
  rootCause?: string;
  correctiveAction?: string;
  reworkStatus: 'Pending' | 'In Rework' | 'Reworked' | 'Scrapped' | 'Not Required';
  reworkQuantity?: number;
  reportedByName?: string;
  detectedDate: string;
  closedAt?: string;
  status: 'Open' | 'Under Analysis' | 'In Progress' | 'Closed';
}

export interface EmployeeTask {
  productionOrder?: string;
  orderNumber?: string;
  task?: string;
  status: 'Assigned' | 'In Progress' | 'Completed';
  assignedAt?: string;
}

export interface Employee {
  _id: string;
  employeeId: string;
  name: string;
  email?: string;
  phone?: string;
  department?: Department | string;
  role: string;
  shift: string;
  skillSet?: string[];
  status: 'Available' | 'On Task' | 'On Leave' | 'Inactive';
  assignedTasks?: EmployeeTask[];
  joinDate?: string;
  hourlyRate?: number;
  performanceScore?: number;
  tasksAssigned?: number;
  tasksCompleted?: number;
}

export interface MaintenanceRecord {
  _id: string;
  maintenanceCode: string;
  machine: Machine | string;
  machineName?: string;
  type: 'Preventive' | 'Breakdown' | 'Corrective' | 'Predictive';
  scheduledDate: string;
  completedDate?: string;
  technician?: string;
  description: string;
  partsReplaced?: string[];
  downtimeHours?: number;
  cost?: number;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
}

export type NotificationType =
  | 'low_stock'
  | 'deadline'
  | 'delayed'
  | 'breakdown'
  | 'quality_failure'
  | 'approval'
  | 'maintenance'
  | 'system';

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  type: NotificationType;
  severity: 'info' | 'warning' | 'critical' | 'success';
  module?: string;
  link?: string;
  isRead?: boolean;
  createdAt: string;
}

/* ===================== Dashboard / analytics ===================== */
export interface DashboardStats {
  totalProductionOrders: number;
  completedProductionOrders: number;
  pendingProductionOrders: number;
  inProgressOrders: number;
  totalProductsManufactured: number;
  defectiveProducts: number;
  qualityPassPercentage: number;
  defectPercentage: number;
  totalInspected: number;
  availableRawMaterials: number;
  lowStockMaterials: number;
  stockValue: number;
  totalMachines: number;
  activeMachines: number;
  machinesUnderMaintenance: number;
  machinesBreakdown: number;
  idleMachines: number;
  totalEmployees: number;
  availableEmployees: number;
}

export interface MonthlyProductionPoint {
  label: string;
  target: number;
  actual: number;
  orders: number;
  completed: number;
}

export interface QualityTrendPoint {
  label: string;
  passPercentage: number;
  defectPercentage: number;
  inspected: number;
}

export interface DashboardOverview {
  stats: DashboardStats;
  monthlyProduction: MonthlyProductionPoint[];
  quality: { trend: QualityTrendPoint[]; byStatus: Record<string, number> };
  defects: { byCategory: { category: string; quantity: number; incidents: number }[]; trend: { label: string; quantity: number; incidents: number }[] };
  machines: { machineCode: string; name: string; status: MachineStatus; utilizationPercentage: number; operatingHours: number }[];
  materials: { material: string; consumed: number }[];
  activities: { id: string; icon: string; title: string; detail: string; status: string; timestamp: string; link: string }[];
  pendingTasks: {
    production: { id: string; title: string; due: string; status: string; priority: Priority; progress: number; overdue: boolean }[];
    approvals: { id: string; title: string; due: string }[];
    maintenance: { id: string; title: string; due: string; status: string }[];
  };
  notifications: AppNotification[];
  role: Role;
  user: { name: string; role: Role };
}

export interface ReportColumn {
  key: string;
  header: string;
  width?: number;
}

export interface ReportData {
  type: string;
  title: string;
  from: string | null;
  to: string | null;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary: { label: string; value: string | number }[];
  generatedAt: string;
}

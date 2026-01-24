
export interface InvoiceItem {
  slNo: number;
  description: string;
  boxNo: string;
  qty: number;
  weight?: number; // Added to track individual box weight
}

export interface ItemMaster {
  id: string;
  name: string;
}

export type ShipmentStatus = 
  | 'Received'
  | 'Departed from Branch'
  | 'Received at HO'
  | 'Loaded into Container'
  | 'In transit'
  | 'Arrived at destination'
  | 'Out for delivery'
  | 'Delivered';

export interface StatusHistoryItem {
  status: ShipmentStatus;
  timestamp: string; // ISO string with date and time
  updatedBy?: string;
}

export interface InvoiceData {
  invoiceNo: string;
  date: string;
  shipmentType: string;
  status?: ShipmentStatus; // Added status
  statusHistory?: StatusHistoryItem[]; // Track history of status changes
  shipper: {
    name: string;
    idNo: string;
    tel: string;
    vatnos: string; // Shipper VAT
    pcs: number;
    weight: number;
  };
  consignee: {
    name: string;
    address: string;
    post: string;
    pin: string;
    country: string;
    district: string;
    state: string;
    tel: string;
    tel2: string;
  };
  cargoItems: InvoiceItem[];
  financials: {
    total: number;
    billCharges: number;
    vat: number; // percentage usually, or amount
    vatAmount: number;
    netTotal: number;
  };
}

export interface SavedCustomer {
  shipper: {
    name: string;
    idNo: string;
    tel: string;
    vatnos: string;
  };
  consignee: {
    name: string;
    address: string;
    post: string;
    pin: string;
    country: string;
    district: string;
    state: string;
    tel: string;
    tel2: string;
  };
}

export type ViewState = 'LOGIN' | 'DASHBOARD' | 'INVOICES' | 'CREATE_INVOICE' | 'PREVIEW_INVOICE' | 'SETTINGS' | 'MODIFY_STATUS' | 'BRANCH_MANAGEMENT' | 'CUSTOMERS' | 'CUSTOMER_DETAIL' | 'FINANCE';

export interface ShipmentType {
  name: string;
  value: number;
}

export interface AppSettings {
  companyName: string;
  companyArabicName: string;
  invoicePrefix?: string; // New field for invoice prefix
  invoiceStartNumber?: number; // New field for starting number
  location?: string; // New separate location field
  addressLine1: string;
  addressLine2: string;
  addressLine1Arabic?: string;
  addressLine2Arabic?: string;
  phone1: string;
  phone2: string;
  vatnoc: string; // Company VAT
  isVatEnabled?: boolean; // Toggle for VAT calculation
  logoUrl?: string;
  brandColor?: string; // Custom brand color for invoice
  shipmentTypes: ShipmentType[];
  // Terms and Conditions
  tcHeader?: string;
  tcEnglish?: string;
  tcArabic?: string;
}

// --- Finance Types ---
export type TransactionType = 'INCOME' | 'EXPENSE';

export interface FinancialAccount {
  id: string;
  name: string;
  type: 'REVENUE' | 'EXPENSE' | 'ASSET' | 'LIABILITY'; 
  isSystem?: boolean; // If true, cannot be deleted (e.g., Sales, General Expenses)
}

export interface FinancialTransaction {
  id: string;
  date: string;
  accountId: string; // which bucket does this belong to
  amount: number;
  type: TransactionType;
  description: string;
  referenceId?: string; // e.g. Invoice Number
  timestamp: string;
}

export interface Company {
  id: string;
  parentId?: string; // ID of the parent company if this is a branch
  // Auth
  username: string;
  password: string;
  expiryDate: string; // YYYY-MM-DD
  
  // Branding & Settings
  settings: AppSettings;

  // Data
  invoices: InvoiceData[];
  
  // Finance Module
  financialAccounts: FinancialAccount[];
  financialTransactions: FinancialTransaction[];
}

export interface User {
  id: string;
  username: string;
  role: 'SUPER_ADMIN' | 'COMPANY_ADMIN';
}


export interface InvoiceItem {
  slNo: number;
  description: string;
  boxNo: string;
  qty: number;
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

export interface InvoiceData {
  invoiceNo: string;
  date: string;
  shipmentType: string;
  status?: ShipmentStatus; // Added status
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

export type ViewState = 'LOGIN' | 'DASHBOARD' | 'CREATE_INVOICE' | 'PREVIEW_INVOICE' | 'SETTINGS' | 'MODIFY_STATUS';

export interface ShipmentType {
  name: string;
  value: number;
}

export interface AppSettings {
  companyName: string;
  companyArabicName: string;
  addressLine1: string;
  addressLine2: string;
  addressLine1Arabic?: string;
  addressLine2Arabic?: string;
  phone1: string;
  phone2: string;
  vatnoc: string; // Company VAT
  isVatEnabled?: boolean; // Toggle for VAT calculation
  logoUrl?: string;
  shipmentTypes: ShipmentType[];
}

export interface Company {
  id: string;
  // Auth
  username: string;
  password: string;
  expiryDate: string; // YYYY-MM-DD
  
  // Branding & Settings
  settings: AppSettings;

  // Data
  invoices: InvoiceData[];
}

export interface User {
  id: string;
  username: string;
  role: 'SUPER_ADMIN' | 'COMPANY_ADMIN';
}
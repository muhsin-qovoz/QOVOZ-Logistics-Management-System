
import { Company, InvoiceData, AppSettings } from '../types';

const STORAGE_KEY = 'qovoz_companies';

// Helper for date formatting
export const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-GB'); // dd/mm/yyyy
};

// Helper for 1 year from now
export const getOneYearFromNow = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
};

const generateMockInvoices = (vatnos: string): InvoiceData[] => {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const threeDaysAgo = new Date(today); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const lastMonth = new Date(today); lastMonth.setMonth(lastMonth.getMonth() - 1);

  const baseInvoice: InvoiceData = {
    invoiceNo: '502217',
    date: formatDate(today),
    shipmentType: 'IND SEA',
    status: 'Received',
    shipper: {
      name: 'ABID ALI ANSARI',
      idNo: '2577948892',
      tel: '+966549934347',
      vatnos: vatnos, // Correctly placed inside shipper
      pcs: 1,
      weight: 30.000,
    },
    consignee: {
      name: 'CHAND ALI',
      address: 'C/O JAKIRALI, RANKIN PURWA',
      post: 'AILO',
      pin: '271871',
      country: 'INDIA',
      district: 'BAHRAICH',
      state: 'UTTAR PRADESH',
      tel: '+919336038580',
      tel2: ''
    },
    cargoItems: [
      { slNo: 1, description: 'DTES', boxNo: 'B1', qty: 5 },
      { slNo: 2, description: 'WATCH', boxNo: 'B1', qty: 3 },
    ],
    financials: {
      total: 180.00,
      billCharges: 40.00,
      vat: 0.00,
      vatAmount: 0.00,
      netTotal: 220.00
    }
  };

  return [
    { ...baseInvoice, invoiceNo: '502217', date: formatDate(today), financials: { ...baseInvoice.financials, netTotal: 220 }, status: 'Received' },
    { ...baseInvoice, invoiceNo: '502216', date: formatDate(yesterday), consignee: { ...baseInvoice.consignee, name: 'Mohammed Rafiq', tel: '+966500000001' }, financials: { ...baseInvoice.financials, netTotal: 150 }, status: 'Departed from Branch' },
    { ...baseInvoice, invoiceNo: '502215', date: formatDate(threeDaysAgo), consignee: { ...baseInvoice.consignee, name: 'Abdul Rahman', tel: '+966500000002' }, financials: { ...baseInvoice.financials, netTotal: 300 }, status: 'In transit' },
    { ...baseInvoice, invoiceNo: '502210', date: formatDate(lastMonth), consignee: { ...baseInvoice.consignee, name: 'John Doe', tel: '+966500000003' }, financials: { ...baseInvoice.financials, netTotal: 450 }, status: 'Delivered' },
  ];
};

export const INITIAL_COMPANIES: Company[] = [
  {
    id: '1',
    username: 'test',
    password: 'test',
    expiryDate: '2030-12-31',
    settings: {
      companyName: 'TEST CARGO',
      companyArabicName: 'جلف كارجو',
      addressLine1: 'KERALA MARKET,KHUBAIB',
      addressLine2: 'BURAIDAH',
      addressLine1Arabic: 'سوق كيرالا شارع خبيب',
      addressLine2Arabic: 'بريدة',
      phone1: '0550844081',
      phone2: '0509015156',
      vatnoc: '310434479300003', // Company VAT
      isVatEnabled: true, // Enabled for test company
      logoUrl: '',
      shipmentTypes: [
          { name: 'IND SEA', value: 6 },
          { name: 'IND AIR', value: 12 },
          { name: 'PAK SEA', value: 5 }
      ]
    },
    invoices: generateMockInvoices('310434479300003')
  }
];

export const getStoredCompanies = (): Company[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load companies from local storage", e);
      return INITIAL_COMPANIES;
    }
  }
  return INITIAL_COMPANIES;
};

export const saveStoredCompanies = (companies: Company[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
};

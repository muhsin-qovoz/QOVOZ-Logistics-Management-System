
import { Company, InvoiceData, AppSettings, StatusHistoryItem } from '../types';

const STORAGE_KEY = 'qovoz_companies_v10'; // Updated to v10 for invoice settings

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

export const DEFAULT_TC_HEADER = "ACCEPT THE GOODS ONLY AFTER CHECKING AND CONFIRMING THEM ON DELIVERY.";
export const DEFAULT_TC_ENGLISH = "NO GUARANTEE FOR GLASS/BREAKABLE ITEMS. COMPANY NOT RESPONSIBLE FOR ITEMS RECEIVED IN DAMAGED CONDITION. COMPLAINTS WILL NOT BE ACCEPTED AFTER 2 DAYS FROM THE DATE OF DELIVERY. COMPANY NOT RESPONSIBLE FOR OCTROI CHARGES OR ANY OTHER CHARGES LEVIED LOCALLY. IN CASE OF CLAIM (LOSS), PROOF OF DOCUMENTS SHOULD BE PRODUCED. SETTLEMENT WILL BE MADE (20 SAR/KGS) PER COMPANY RULES. COMPANY WILL NOT TAKE RESPONSIBILITY FOR NATURAL CALAMITY AND DELAY IN CUSTOMS CLEARANCE.";
export const DEFAULT_TC_ARABIC = "الشروط: 1. لا توجد مطالب عند الشركة الناشئة للخسائر الناتجة عن الحوادث الطبيعية أو تأخير التخليص الجمركي. 2. لا تتحمل الشركة مسؤولية أي خسارة ناتجة عن سوء الاستخدام أو الأضرار غير المسؤولة أو المسؤوليات المترتبة على أي رسوم ومعاملات تفرض من قبل السلطات الجمركية. 3. الشركة غير مسؤولة عن أي مسؤوليات قانونية ناشئة عن المستندات المفقودة أو التالفة. 4. يتحمل المستلم أو المشتري جميع الرسوم الإضافية، بما في ذلك رسوم التخزين والغرامات المفروضة من قبل الجمارك.";
export const DEFAULT_BRAND_COLOR = "#7f1d1d"; // Tailwind red-900

const generateMockInvoices = (
    startId: number, 
    prefix: string, 
    vatnos: string,
    customerName: string,
    city: string,
    cargoDesc: string
): InvoiceData[] => {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  
  const initialHistory: StatusHistoryItem[] = [
      { status: 'Received', timestamp: new Date().toISOString() }
  ];

  const baseInvoice: InvoiceData = {
    invoiceNo: `${prefix}${startId}`,
    date: formatDate(today),
    shipmentType: 'IND SEA',
    status: 'Received',
    statusHistory: initialHistory,
    shipper: {
      name: customerName,
      idNo: '2577948892',
      tel: '+966549934347',
      vatnos: vatnos, 
      pcs: 2,
      weight: 45.500,
    },
    consignee: {
      name: `${customerName} INDIA`,
      address: '123 MARKET ROAD',
      post: `${city} CENTER`,
      pin: '673001',
      country: 'INDIA',
      district: 'KERALA',
      state: 'KERALA',
      tel: '+919336038580',
      tel2: ''
    },
    cargoItems: [
      { slNo: 1, description: cargoDesc, boxNo: 'B1', qty: 15 },
      { slNo: 2, description: 'FOOD STUFF', boxNo: 'B2', qty: 5 },
    ],
    financials: {
      total: 200.00,
      billCharges: 20.00,
      vat: 0.00,
      vatAmount: 0.00,
      netTotal: 220.00
    }
  };

  return [
    { ...baseInvoice, invoiceNo: `${prefix}${startId}`, date: formatDate(today) },
    { 
        ...baseInvoice, 
        invoiceNo: `${prefix}${startId + 1}`, 
        date: formatDate(yesterday), 
        shipper: { ...baseInvoice.shipper, name: `${customerName} TRADING`, weight: 120.00 },
        cargoItems: [{ slNo: 1, description: 'ELECTRONICS', boxNo: 'E1', qty: 2 }],
        financials: { total: 500, billCharges: 20, vat: 0, vatAmount: 0, netTotal: 520 },
        status: 'Departed from Branch',
        statusHistory: [
            { status: 'Received', timestamp: yesterday.toISOString() },
            { status: 'Departed from Branch', timestamp: today.toISOString() }
        ]
    },
  ];
};

export const INITIAL_COMPANIES: Company[] = [
  // ---------------------------------------------------------
  // 1. Parent Company (Test Cargo HQ)
  // Credentials: username: 'test', password: 'test'
  // ---------------------------------------------------------
  {
    id: '1',
    username: 'test',
    password: 'test',
    expiryDate: '2030-12-31',
    settings: {
      companyName: 'TEST CARGO HQ',
      companyArabicName: 'المقر الرئيسي للشحن',
      invoicePrefix: 'HQ-',
      invoiceStartNumber: 1000,
      location: 'RIYADH',
      addressLine1: 'KING FAHD ROAD',
      addressLine2: 'RIYADH',
      addressLine1Arabic: 'طريق الملك فهد',
      addressLine2Arabic: 'الرياض',
      phone1: '011-222-2222',
      phone2: '050-000-0001',
      vatnoc: '300000000000001', 
      isVatEnabled: true,
      brandColor: "#1e3a8a", // Blue
      logoUrl: '', 
      shipmentTypes: [{ name: 'IND SEA', value: 6 }, { name: 'IND AIR', value: 12 }],
      tcHeader: DEFAULT_TC_HEADER,
      tcEnglish: DEFAULT_TC_ENGLISH,
      tcArabic: DEFAULT_TC_ARABIC
    },
    invoices: generateMockInvoices(1000, 'HQ-', '300000000000001', 'AL RAJHI TRADING', 'RIYADH', 'TEXTILES')
  },
  
  // ---------------------------------------------------------
  // 2. Sub-Branch 1 (Dammam)
  // Credentials: username: 'test1', password: 'test1'
  // ---------------------------------------------------------
  {
    id: '2',
    parentId: '1', // Linked to Test Cargo HQ
    username: 'test1',
    password: 'test1',
    expiryDate: '2030-12-31',
    settings: {
      companyName: 'TEST BRANCH 1', // Cleaned Name
      companyArabicName: 'فرع الدمام',
      invoicePrefix: 'DAM-',
      invoiceStartNumber: 2000,
      location: 'DAMMAM',
      addressLine1: 'DAMMAM PORT ROAD',
      addressLine2: 'DAMMAM',
      addressLine1Arabic: 'طريق ميناء الدمام',
      addressLine2Arabic: 'الدمام',
      phone1: '013-333-3333',
      phone2: '050-000-0002',
      vatnoc: '300000000000002', 
      isVatEnabled: true,
      brandColor: "#047857", // Green
      shipmentTypes: [{ name: 'IND SEA', value: 5.5 }, { name: 'IND AIR', value: 11.5 }],
      tcHeader: DEFAULT_TC_HEADER,
      tcEnglish: DEFAULT_TC_ENGLISH,
      tcArabic: DEFAULT_TC_ARABIC
    },
    invoices: generateMockInvoices(2000, 'DAM-', '300000000000002', 'EASTERN SUPPLIES LLC', 'DAMMAM', 'INDUSTRIAL PARTS')
  },

  // ---------------------------------------------------------
  // 3. Sub-Branch 2 (Jeddah)
  // Credentials: username: 'test2', password: 'test2'
  // ---------------------------------------------------------
  {
    id: '3',
    parentId: '1', // Linked to Test Cargo HQ
    username: 'test2',
    password: 'test2',
    expiryDate: '2030-12-31',
    settings: {
      companyName: 'TEST BRANCH 2', // Cleaned Name
      companyArabicName: 'فرع جدة',
      invoicePrefix: 'JED-',
      invoiceStartNumber: 3000,
      location: 'JEDDAH',
      addressLine1: 'PALESTINE STREET',
      addressLine2: 'JEDDAH',
      addressLine1Arabic: 'شارع فلسطين',
      addressLine2Arabic: 'جدة',
      phone1: '012-444-4444',
      phone2: '050-000-0003',
      vatnoc: '300000000000003', 
      isVatEnabled: true,
      brandColor: "#b91c1c", // Red
      shipmentTypes: [{ name: 'IND SEA', value: 6.5 }, { name: 'IND AIR', value: 13 }],
      tcHeader: DEFAULT_TC_HEADER,
      tcEnglish: DEFAULT_TC_ENGLISH,
      tcArabic: DEFAULT_TC_ARABIC
    },
    invoices: generateMockInvoices(3000, 'JED-', '300000000000003', 'RED SEA MARKETS', 'JEDDAH', 'GIFT ITEMS')
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


import { Company, InvoiceData, AppSettings, StatusHistoryItem } from '../types';

const STORAGE_KEY = 'qovoz_companies_v4'; // Updated to v4 for brandColor support

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

const generateMockInvoices = (vatnos: string): InvoiceData[] => {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const threeDaysAgo = new Date(today); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const lastMonth = new Date(today); lastMonth.setMonth(lastMonth.getMonth() - 1);

  const initialHistory: StatusHistoryItem[] = [
      { status: 'Received', timestamp: new Date().toISOString() }
  ];

  const baseInvoice: InvoiceData = {
    invoiceNo: '502217',
    date: formatDate(today),
    shipmentType: 'IND SEA',
    status: 'Received',
    statusHistory: initialHistory,
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
    { 
        ...baseInvoice, 
        invoiceNo: '502216', 
        date: formatDate(yesterday), 
        consignee: { ...baseInvoice.consignee, name: 'Mohammed Rafiq', tel: '+966500000001' }, 
        financials: { ...baseInvoice.financials, netTotal: 150 }, 
        status: 'Departed from Branch',
        statusHistory: [...initialHistory, { status: 'Departed from Branch', timestamp: new Date().toISOString() }]
    },
    { 
        ...baseInvoice, 
        invoiceNo: '502215', 
        date: formatDate(threeDaysAgo), 
        consignee: { ...baseInvoice.consignee, name: 'Abdul Rahman', tel: '+966500000002' }, 
        financials: { ...baseInvoice.financials, netTotal: 300 }, 
        status: 'In transit',
        statusHistory: [...initialHistory, { status: 'In transit', timestamp: new Date().toISOString() }]
    },
    { 
        ...baseInvoice, 
        invoiceNo: '502210', 
        date: formatDate(lastMonth), 
        consignee: { ...baseInvoice.consignee, name: 'John Doe', tel: '+966500000003' }, 
        financials: { ...baseInvoice.financials, netTotal: 450 }, 
        status: 'Delivered',
        statusHistory: [...initialHistory, { status: 'Delivered', timestamp: new Date().toISOString() }]
    },
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
      brandColor: DEFAULT_BRAND_COLOR,
      // "TEST CARGO" Logo with Box Icon (Blue/Grey Theme)
      logoUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNjAgMTEwIiB3aWR0aD0iMjYwIiBoZWlnaHQ9IjExMCI+CiAgPCEtLSBJY29uIC0tPgogIDxwYXRoIGQ9Ik0zMCAzMCBMNzAgMTUgTExMTAgMzAgTExMTAgODAgTDcwIDk1IEwzMCA4MCBaIiBmaWxsPSJub25lIiBzdHJva2U9IiMxZTNhOGEiIHN0cm9rZS13aWR0aD0iMyIvPgogIDxwYXRoIGQ9Ik0zMCAzMCBMNzAgNDUgTExMTAgMzAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFlM2E4YSIgc3Ryb2tlLXdpZHRoPSIzIi8+CiAgPHBhdGggZD0iTTcwIDQ1IEw3MCA5NSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWUzYThhIiBzdHJva2Utd2lkdGg9IjMiLz4KICAKICA8IS0tIFRleHQgLS0+CiAgPHRleHQgeD0iMTMwIiB5PSI2MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXdlaWdodD0iOTAwIiBmb250LXNpemU9IjQwIiBmaWxsPSIjMWUzYThhIj5URVNUPC90ZXh0PgogIDx0ZXh0IHg9IjEzMCIgeT0iOTAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiIGZvbnQtc2l6ZT0iMjgiIGZpbGw9IiM2YjcyODAiIGxldHRlci1zcGFjaW5nPSIyIj5DQVJHTzwvdGV4dD4KPC9zdmc+',
      shipmentTypes: [
          { name: 'IND SEA', value: 6 },
          { name: 'IND AIR', value: 12 },
          { name: 'PAK SEA', value: 5 }
      ],
      tcHeader: DEFAULT_TC_HEADER,
      tcEnglish: DEFAULT_TC_ENGLISH,
      tcArabic: DEFAULT_TC_ARABIC
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

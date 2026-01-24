import { Company, InvoiceData, FinancialTransaction, FinancialAccount, ItemMaster } from '../types';

export const DEFAULT_TC_HEADER = "Terms and Conditions";
export const DEFAULT_TC_ENGLISH = "All business is undertaken subject to the Standard Trading Conditions of the Company, which are available upon request.";
export const DEFAULT_TC_ARABIC = "تخضع جميع الأعمال لشروط التداول القياسية للشركة، والتي تتوفر عند الطلب.";
export const DEFAULT_BRAND_COLOR = "#1e3a8a"; // blue-900

export const DEFAULT_ACCOUNTS: FinancialAccount[] = [
    { id: 'acc_sales', name: 'Sales Revenue', type: 'REVENUE', isSystem: true },
    { id: 'acc_cost_goods', name: 'Cost of Goods Sold', type: 'EXPENSE', isSystem: true },
    { id: 'acc_transport', name: 'Transportation', type: 'EXPENSE' },
    { id: 'acc_salary', name: 'Salaries & Wages', type: 'EXPENSE' },
    { id: 'acc_utilities', name: 'Utilities', type: 'EXPENSE' },
    { id: 'acc_rent', name: 'Rent', type: 'EXPENSE' },
    { id: 'acc_misc', name: 'Miscellaneous', type: 'EXPENSE' }
];

export const DEFAULT_ITEMS: ItemMaster[] = [
    { id: 'itm_1', name: 'CLOTHES' },
    { id: 'itm_2', name: 'ELECTRONICS' },
    { id: 'itm_3', name: 'FOOD STUFF' },
    { id: 'itm_4', name: 'COSMETICS' },
    { id: 'itm_5', name: 'HOUSEHOLD ITEMS' },
    { id: 'itm_6', name: 'BOOKS' },
    { id: 'itm_7', name: 'TOYS' }
];

const STORAGE_KEY = 'qovoz_companies_v1';

export const formatDate = (date: Date): string => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

export const getOneYearFromNow = (): string => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
};

export const generateMockTransactions = (invoices: InvoiceData[]): FinancialTransaction[] => {
    return invoices.map(inv => ({
        id: `tx_${inv.invoiceNo}`,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        accountId: 'acc_sales',
        type: 'INCOME',
        amount: inv.financials.netTotal,
        description: `Invoice Generation: ${inv.invoiceNo}`,
        referenceId: inv.invoiceNo,
        paymentMode: inv.paymentMode || 'CASH'
    }));
};

// --- MOCK DATA ---
const MOCK_INVOICES: InvoiceData[] = [
    {
        invoiceNo: 'INV-1001',
        date: formatDate(new Date()),
        shipmentType: 'AIR CARGO',
        status: 'Received',
        paymentMode: 'CASH',
        shipper: { name: 'Abdul Rahman', idNo: '1010101010', tel: '0501234567', vatnos: '', pcs: 2, weight: 25 },
        consignee: { name: 'Mohammed Ali', address: '123 Street', post: 'Riyadh', pin: '11564', country: 'Saudi Arabia', district: 'Olaya', state: 'Riyadh', tel: '0551234567', tel2: '' },
        cargoItems: [
            { slNo: 1, description: 'CLOTHES', boxNo: 'B1', qty: 20, weight: 15 },
            { slNo: 2, description: 'SHOES', boxNo: 'B2', qty: 5, weight: 10 }
        ],
        financials: { total: 375, billCharges: 40, vat: 15, vatAmount: 62.25, netTotal: 477.25 },
        statusHistory: [{ status: 'Received', timestamp: new Date().toISOString() }]
    },
    {
        invoiceNo: 'INV-1002',
        date: formatDate(new Date(Date.now() - 86400000)), // Yesterday
        shipmentType: 'SEA CARGO',
        status: 'Delivered',
        paymentMode: 'BANK',
        shipper: { name: 'Sarah Jones', idNo: '2020202020', tel: '0509876543', vatnos: '300123456700003', pcs: 5, weight: 100 },
        consignee: { name: 'Family Store', address: 'Main Road', post: 'Jeddah', pin: '21411', country: 'Saudi Arabia', district: 'Al Balad', state: 'Makkah', tel: '0569876543', tel2: '' },
        cargoItems: [
            { slNo: 1, description: 'ELECTRONICS', boxNo: 'S1', qty: 10, weight: 20 },
            { slNo: 2, description: 'KITCHENWARE', boxNo: 'S2', qty: 15, weight: 20 },
            { slNo: 3, description: 'BOOKS', boxNo: 'S3', qty: 50, weight: 20 },
            { slNo: 4, description: 'TOYS', boxNo: 'S4', qty: 20, weight: 20 },
            { slNo: 5, description: 'TOOLS', boxNo: 'S5', qty: 5, weight: 20 }
        ],
        financials: { total: 500, billCharges: 40, vat: 15, vatAmount: 81, netTotal: 621 },
        statusHistory: [
            { status: 'Received', timestamp: new Date(Date.now() - 172800000).toISOString() },
            { status: 'In transit', timestamp: new Date(Date.now() - 86400000).toISOString() },
            { status: 'Delivered', timestamp: new Date().toISOString() }
        ]
    }
];

export const getStoredCompanies = (): Company[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const companies = JSON.parse(stored);
            // Migration: Ensure items array exists for existing data
            return companies.map((c: Company) => ({
                ...c,
                items: c.items || DEFAULT_ITEMS
            }));
        } catch (e) {
            console.error("Failed to parse companies", e);
        }
    }
    // Return a default admin company with MOCK DATA if empty
    return [{
        id: 'hq_1',
        username: 'admin',
        password: 'password',
        expiryDate: '2030-01-01',
        settings: {
            companyName: 'My Logistics HQ',
            companyArabicName: 'المقر الرئيسي للخدمات اللوجستية',
            addressLine1: '123 Logistics Way',
            addressLine2: 'Business District',
            phone1: '0500000000',
            phone2: '0555555555',
            vatnoc: '300000000000003',
            isVatEnabled: true,
            brandColor: DEFAULT_BRAND_COLOR,
            shipmentTypes: [{ name: 'AIR CARGO', value: 15 }, { name: 'SEA CARGO', value: 5 }],
            tcHeader: DEFAULT_TC_HEADER,
            tcEnglish: DEFAULT_TC_ENGLISH,
            tcArabic: DEFAULT_TC_ARABIC,
            invoicePrefix: 'INV-',
            invoiceStartNumber: 1003,
            location: 'Riyadh'
        },
        invoices: MOCK_INVOICES,
        financialAccounts: DEFAULT_ACCOUNTS,
        financialTransactions: generateMockTransactions(MOCK_INVOICES),
        items: DEFAULT_ITEMS
    }];
};

export const saveStoredCompanies = (companies: Company[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
};
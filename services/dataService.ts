
import { Company, InvoiceData, FinancialTransaction, FinancialAccount, ItemMaster, InvoiceItem } from '../types';

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

// Changed key to force a reset of data
const STORAGE_KEY = 'qovoz_companies_v2_comprehensive';

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
    return invoices.map(inv => {
        let txs: FinancialTransaction[] = [];
        const date = new Date().toISOString().split('T')[0];
        const timestamp = new Date().toISOString();

        if (inv.paymentMode === 'SPLIT' && inv.splitDetails) {
            if (inv.splitDetails.cash > 0) {
                txs.push({
                    id: `tx_${inv.invoiceNo}_cash`,
                    date, timestamp, accountId: 'acc_sales', type: 'INCOME',
                    amount: inv.splitDetails.cash,
                    description: `Invoice ${inv.invoiceNo} (Cash Split)`,
                    referenceId: inv.invoiceNo,
                    paymentMode: 'CASH'
                });
            }
            if (inv.splitDetails.bank > 0) {
                txs.push({
                    id: `tx_${inv.invoiceNo}_bank`,
                    date, timestamp, accountId: 'acc_sales', type: 'INCOME',
                    amount: inv.splitDetails.bank,
                    description: `Invoice ${inv.invoiceNo} (Bank Split)`,
                    referenceId: inv.invoiceNo,
                    paymentMode: 'BANK'
                });
            }
        } else {
             txs.push({
                id: `tx_${inv.invoiceNo}`,
                date, timestamp, accountId: 'acc_sales', type: 'INCOME',
                amount: inv.financials.netTotal,
                description: `Invoice Generation: ${inv.invoiceNo}`,
                referenceId: inv.invoiceNo,
                paymentMode: (inv.paymentMode === 'CASH' || inv.paymentMode === 'BANK') ? inv.paymentMode : 'CASH'
            });
        }
        return txs;
    }).flat();
};

// --- DATA GENERATORS ---

const NAMES = ['Ahmed Al-Fagih', 'Sarah Johnson', 'Mohammed Ali', 'Fatima Syed', 'Global Trading Est', 'Quick Ship Ltd', 'Riyadh Retailers'];
const LOCATIONS = ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina', 'Tabuk'];
const SHIPMENT_TYPES = [{ name: 'AIR CARGO', value: 15 }, { name: 'SEA CARGO', value: 5 }, { name: 'LAND CARGO', value: 3 }];

const generateInvoice = (
    index: number, 
    prefix: string, 
    startNo: number, 
    vatEnabled: boolean, 
    location: string
): InvoiceData => {
    const invNo = `${prefix}${startNo + index}`;
    const shipperName = NAMES[index % NAMES.length];
    const consigneeName = NAMES[(index + 3) % NAMES.length];
    const weight = Math.floor(Math.random() * 50) + 10;
    const pcs = Math.floor(Math.random() * 5) + 1;
    const type = SHIPMENT_TYPES[index % SHIPMENT_TYPES.length];
    const date = new Date();
    date.setDate(date.getDate() - (index * 2)); // Spread dates out

    const total = weight * type.value;
    const billCharges = pcs * 20;
    const subTotal = total + billCharges;
    const vatRate = vatEnabled ? 0.15 : 0;
    const vatAmount = subTotal * vatRate;
    const netTotal = subTotal + vatAmount;

    const paymentMode = index % 3 === 0 ? 'BANK' : (index % 3 === 1 ? 'SPLIT' : 'CASH');
    let splitDetails = { cash: 0, bank: 0 };
    if (paymentMode === 'SPLIT') {
        const cash = Math.floor(netTotal / 2);
        splitDetails = { cash, bank: netTotal - cash };
    }

    const items: InvoiceItem[] = Array.from({length: pcs}).map((_, i) => ({
        slNo: i + 1,
        description: DEFAULT_ITEMS[i % DEFAULT_ITEMS.length].name,
        boxNo: `B${i+1}`,
        qty: Math.floor(Math.random() * 10) + 1,
        weight: parseFloat((weight / pcs).toFixed(2))
    }));

    return {
        invoiceNo: invNo,
        date: formatDate(date),
        shipmentType: type.name,
        status: index === 0 ? 'Delivered' : 'Received',
        statusHistory: [{ status: 'Received', timestamp: date.toISOString() }],
        paymentMode: paymentMode,
        splitDetails: paymentMode === 'SPLIT' ? splitDetails : undefined,
        shipper: {
            name: shipperName,
            idNo: `10${Math.floor(Math.random() * 100000000)}`,
            tel: `05${Math.floor(Math.random() * 100000000)}`,
            vatnos: vatEnabled ? `300${Math.floor(Math.random() * 100000000)}` : '',
            pcs,
            weight
        },
        consignee: {
            name: consigneeName,
            address: `${Math.floor(Math.random() * 100)} Street`,
            post: location,
            pin: '10000',
            country: 'Saudi Arabia',
            district: 'Central',
            state: 'State',
            tel: `05${Math.floor(Math.random() * 100000000)}`,
            tel2: ''
        },
        cargoItems: items,
        financials: {
            total,
            billCharges,
            vat: vatRate * 100,
            vatAmount,
            netTotal
        }
    };
};

const createCompany = (
    id: string, 
    name: string, 
    username: string, 
    parentId: string | undefined, 
    vatEnabled: boolean, 
    location: string,
    invoicePrefix: string = 'INV-'
): Company => {
    const invoices = Array.from({length: 5}).map((_, i) => generateInvoice(i, invoicePrefix, 1000, vatEnabled, location));
    
    // Generate Invoice Transactions
    const invoiceTransactions = generateMockTransactions(invoices);
    
    // Generate Random Expense Transactions
    const expenseTransactions: FinancialTransaction[] = Array.from({length: 3}).map((_, i) => ({
        id: `exp_${id}_${i}`,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        accountId: i % 2 === 0 ? 'acc_rent' : 'acc_utilities',
        type: 'EXPENSE',
        amount: Math.floor(Math.random() * 500) + 100,
        description: i % 2 === 0 ? 'Monthly Rent' : 'Utility Bill',
        paymentMode: 'CASH'
    }));

    return {
        id,
        parentId,
        username,
        password: username, // Password same as username for mock
        expiryDate: getOneYearFromNow(),
        settings: {
            companyName: name,
            companyArabicName: name === 'Test Cargo' ? 'تيست كارغو' : (name === 'New Cargo' ? 'نيو كارغو' : 'أدمن كارغو'),
            addressLine1: 'King Fahd Road',
            addressLine2: 'Olaya District',
            addressLine1Arabic: 'طريق الملك فهد',
            addressLine2Arabic: 'حي العليا',
            phone1: '0112345678',
            phone2: '0551234567',
            vatnoc: vatEnabled ? '300011122233303' : '',
            isVatEnabled: vatEnabled,
            logoUrl: '',
            brandColor: DEFAULT_BRAND_COLOR,
            shipmentTypes: SHIPMENT_TYPES,
            tcHeader: DEFAULT_TC_HEADER,
            tcEnglish: DEFAULT_TC_ENGLISH,
            tcArabic: DEFAULT_TC_ARABIC,
            invoicePrefix,
            invoiceStartNumber: 1005,
            location
        },
        invoices,
        financialAccounts: DEFAULT_ACCOUNTS,
        financialTransactions: [...invoiceTransactions, ...expenseTransactions],
        items: DEFAULT_ITEMS
    };
};

const generateComprehensiveMockData = (): Company[] => {
    const companies: Company[] = [];

    // --- DATA SET 1: Test Cargo (Multi-Branch, VAT Enabled) ---
    // HQ
    companies.push(createCompany('comp_test_hq', 'Test Cargo', 'test', undefined, true, 'Riyadh HQ', 'HQ-'));
    // Branch 1
    companies.push(createCompany('comp_test_b1', 'Test Cargo B1', 'test1', 'comp_test_hq', true, 'Jeddah', 'JD-'));
    // Branch 2
    companies.push(createCompany('comp_test_b2', 'Test Cargo B2', 'test2', 'comp_test_hq', true, 'Dammam', 'DM-'));

    // --- DATA SET 2: New Cargo (Single, Non-VAT) ---
    companies.push(createCompany('comp_new', 'New Cargo', 'new', undefined, false, 'Main Branch', 'NC-'));

    // --- DATA SET 3: Admin Cargo (Multi-Branch, Tax-Disabled as per header requirement for variety) ---
    // HQ
    companies.push(createCompany('comp_admin_hq', 'Admin Cargo', 'admin', undefined, false, 'Riyadh Main', 'AD-'));
    // Branch 1
    companies.push(createCompany('comp_admin_b1', 'Admin Cargo B1', 'admin1', 'comp_admin_hq', false, 'Mecca', 'MC-'));
    // Branch 2
    companies.push(createCompany('comp_admin_b2', 'Admin Cargo B2', 'admin2', 'comp_admin_hq', false, 'Medina', 'MD-'));

    return companies;
};

export const getStoredCompanies = (): Company[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const companies = JSON.parse(stored);
            return companies.map((c: Company) => ({
                ...c,
                items: c.items || DEFAULT_ITEMS
            }));
        } catch (e) {
            console.error("Failed to parse companies", e);
        }
    }
    
    // If empty or new key, generate fresh comprehensive mock data
    const freshData = generateComprehensiveMockData();
    saveStoredCompanies(freshData);
    return freshData;
};

export const saveStoredCompanies = (companies: Company[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
};

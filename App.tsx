import React, { useState, useMemo, useEffect } from 'react';
import { ViewState, InvoiceData, Company, AppSettings, ShipmentStatus, FinancialAccount, FinancialTransaction, ItemMaster, ShipmentStatusSetting, InvoiceItem, ShipmentType, StatusHistoryItem } from './types';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import { fetchCompanies, persistAllCompanies, formatDate, getOneYearFromNow, DEFAULT_TC_HEADER, DEFAULT_TC_ENGLISH, DEFAULT_TC_ARABIC, DEFAULT_BRAND_COLOR, DEFAULT_ACCOUNTS, DEFAULT_ITEMS, DEFAULT_SHIPMENT_STATUS_SETTINGS } from './services/dataService';

// Extended Invoice Type for Dashboard Display
type DashboardInvoice = InvoiceData & {
    _companyId: string;
    _locationName: string;
    _companyName: string;
    _isHeadOffice: boolean;
};

// Aggregated Customer Type
type AggregatedCustomer = {
    key: string;
    name: string;
    idNo: string;
    mobile: string;
    vatNo: string;
    location: string;
    companyId: string; // Used for filtering
    totalShipments: number;
};

// Modal Component for Status History
const StatusHistoryModal = ({ invoice, onClose }: { invoice: InvoiceData, onClose: () => void }) => {
    if (!invoice) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white p-6 rounded shadow-lg w-96 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="font-bold text-lg text-gray-800">Status History</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-600 font-bold text-xl">&times;</button>
                </div>
                <div className="mb-4 text-sm bg-gray-50 p-2 rounded">
                    <p><strong>Invoice #:</strong> <span className="font-mono">{invoice.invoiceNo}</span></p>
                    <p><strong>Shipper:</strong> {invoice.shipper.name}</p>
                </div>
                <div className="space-y-4 relative border-l-2 border-blue-200 ml-2 pl-6 py-2">
                    {(invoice.statusHistory || []).slice().reverse().map((item, idx) => (
                        <div key={idx} className="relative">
                            <div className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white ${idx === 0 ? 'bg-blue-600' : 'bg-gray-400'}`}></div>
                            <p className="font-bold text-sm text-gray-800">{item.status}</p>
                            <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</p>
                            {item.remark && <p className="text-xs text-blue-600 mt-1 italic font-medium">"{item.remark}"</p>}
                        </div>
                    ))}
                    {(!invoice.statusHistory || invoice.statusHistory.length === 0) && (
                        <div className="relative">
                            <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full bg-gray-400 border-2 border-white"></div>
                            <p className="font-bold text-sm text-gray-800">{invoice.status || 'Received'}</p>
                            <p className="text-xs text-gray-500 italic">Initial Record</p>
                        </div>
                    )}
                </div>
                <button onClick={onClose} className="mt-6 w-full bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300 font-medium">Close</button>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    // --- State ---

    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load initial data from Supabase
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            const data = await fetchCompanies();
            setCompanies(data);
            setIsLoading(false);
        };
        loadData();
    }, []);

    // Save to Supabase whenever companies change (Debounced naturally by user action frequency)
    useEffect(() => {
        if (!isLoading) {
            persistAllCompanies(companies);
        }
    }, [companies, isLoading]);



    // Session
    const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // Navigation
    const [view, setView] = useState<ViewState>('LOGIN');
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Login Form
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Dashboard State
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'LAST_MONTH' | 'CUSTOM'>('TODAY');
    const [dashboardLocationFilter, setDashboardLocationFilter] = useState<string>('ALL'); // Filter by Company ID or ALL
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [currentInvoice, setCurrentInvoice] = useState<InvoiceData | null>(null);

    // Status History Modal State
    const [viewingHistoryInvoice, setViewingHistoryInvoice] = useState<InvoiceData | null>(null);

    // Customer Management State
    const [selectedCustomer, setSelectedCustomer] = useState<AggregatedCustomer | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<AggregatedCustomer | null>(null);
    const [editCustomerForm, setEditCustomerForm] = useState({ name: '', mobile: '', idNo: '' });

    // Finance State
    const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
    const [newTransaction, setNewTransaction] = useState<Partial<FinancialTransaction>>({
        type: 'EXPENSE',
        amount: 0,
        description: '',
        accountId: '',
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'CASH'
    });

    // Items State
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);
    const [itemFormName, setItemFormName] = useState('');

    // Shipment Types State
    const [isShipmentTypeModalOpen, setIsShipmentTypeModalOpen] = useState(false);
    const [editingShipmentType, setEditingShipmentType] = useState<{ index: number; type: ShipmentType } | null>(null);
    const [shipmentTypeFormName, setShipmentTypeFormName] = useState('');
    const [shipmentTypeFormValue, setShipmentTypeFormValue] = useState('');

    // Session Persistence: Restore
    useEffect(() => {
        const savedCompanyId = localStorage.getItem('qovoz_activeCompanyId');
        const savedIsSuperAdmin = localStorage.getItem('qovoz_isSuperAdmin') === 'true';
        const savedView = localStorage.getItem('qovoz_view') as ViewState | null;
        const savedLocationFilter = localStorage.getItem('qovoz_dashboardLocationFilter');

        if (savedIsSuperAdmin) setIsSuperAdmin(true);
        if (savedCompanyId) setActiveCompanyId(savedCompanyId);
        if (savedLocationFilter) setDashboardLocationFilter(savedLocationFilter);

        if (savedView && savedView !== 'LOGIN') {
            // Check if we have enough context to restore the view
            if (savedIsSuperAdmin || savedCompanyId) {
                setView(savedView);
            }
        }
    }, []);

    // Session Persistence: Save
    useEffect(() => {
        if (activeCompanyId) {
            localStorage.setItem('qovoz_activeCompanyId', activeCompanyId);
        } else {
            localStorage.removeItem('qovoz_activeCompanyId');
        }
        localStorage.setItem('qovoz_isSuperAdmin', isSuperAdmin.toString());
        localStorage.setItem('qovoz_view', view);
        localStorage.setItem('qovoz_dashboardLocationFilter', (dashboardLocationFilter || 'ALL').toString());
    }, [activeCompanyId, isSuperAdmin, view, dashboardLocationFilter]);

    // Branch Management State
    const [branchManagementMode, setBranchManagementMode] = useState<'LIST' | 'EDIT'>('LIST');

    // Create/Edit Company Form State
    const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
    const [newCompany, setNewCompany] = useState<Omit<Partial<Company>, 'settings'> & { settings: Partial<AppSettings> }>({
        expiryDate: getOneYearFromNow(),
        parentId: undefined,
        settings: {
            shipmentTypes: [],
            isVatEnabled: false, // Disabled by default
            tcHeader: DEFAULT_TC_HEADER,
            tcEnglish: DEFAULT_TC_ENGLISH,
            tcArabic: DEFAULT_TC_ARABIC,
            brandColor: DEFAULT_BRAND_COLOR,
            invoicePrefix: '',
            invoiceStartNumber: 1000,
            location: '',
            shipmentStatusSettings: DEFAULT_SHIPMENT_STATUS_SETTINGS
        }
    });

    // Admin Search & Filter State
    const [adminSearchQuery, setAdminSearchQuery] = useState('');
    const [adminFilter, setAdminFilter] = useState<'ALL' | 'EXPIRING' | 'EXPIRED'>('ALL');

    // Branch Management State Helpers for Form
    const [isBranch, setIsBranch] = useState(false);
    const [selectedParentId, setSelectedParentId] = useState<string>('');

    // Temp state for adding shipment types
    const [tempShipmentName, setTempShipmentName] = useState('');
    const [tempShipmentValue, setTempShipmentValue] = useState('');
    const [tempStatusName, setTempStatusName] = useState('');

    // DnD State for Shipment Statuses
    const [draggedStatusIndex, setDraggedStatusIndex] = useState<number | null>(null);

    // Bulk Status Change State
    const [selectedInvoiceNos, setSelectedInvoiceNos] = useState<string[]>([]);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [targetBulkStatus, setTargetBulkStatus] = useState<string>('');
    const [bulkStatusRemark, setBulkStatusRemark] = useState('');

    // --- Routing / History Logic ---

    // Helper to update view and push to history
    const updateView = (newView: ViewState, addToHistory = true) => {
        setView(newView);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (addToHistory) {
            const url = new URL(window.location.href);
            url.searchParams.set('view', newView);
            window.history.pushState({ view: newView }, '', url);
        }
    };

    // Listen for Browser Back/Forward buttons
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (event.state && event.state.view) {
                // Restore view from history state
                setView(event.state.view);
            } else {
                // Fallback: Check URL or default to Dashboard/Login based on auth
                const params = new URLSearchParams(window.location.search);
                const viewParam = params.get('view') as ViewState | null;

                if (viewParam) {
                    setView(viewParam);
                } else if (activeCompanyId) {
                    setView('DASHBOARD');
                } else {
                    setView('LOGIN');
                }
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [activeCompanyId]);


    // --- Helpers ---

    const activeCompany = useMemo(() =>
        companies.find(c => c.id === activeCompanyId),
        [companies, activeCompanyId]);

    // Determine the "Family" of companies the logged-in user can see
    const relatedCompanies = useMemo(() => {
        if (isSuperAdmin) return companies;
        if (!activeCompany) return [];

        // If I am HQ (no parent), get me and my children (branches)
        if (!activeCompany.parentId) {
            return companies.filter(c => c.id === activeCompany.id || c.parentId === activeCompany.id);
        }

        // If I am a Branch, show the whole network (My Parent + Me + My Siblings)
        return companies.filter(c =>
            c.id === activeCompany.parentId || // My Parent
            c.parentId === activeCompany.parentId || // My Siblings (including me)
            c.id === activeCompany.id // Fallback for myself
        );
    }, [companies, activeCompany, isSuperAdmin]);

    // Filter Companies for Super Admin Dashboard
    const filteredAdminCompanies = useMemo(() => {
        const now = new Date();
        // Set to beginning of day to avoid time issues
        now.setHours(0, 0, 0, 0);

        const thirtyDaysFromNow = new Date(now);
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        return companies.filter(c => {
            const expDate = new Date(c.expiryDate);

            // 1. Search Query
            const searchLower = adminSearchQuery.toLowerCase();
            const matchesSearch = (
                c.settings.companyName.toLowerCase().includes(searchLower) ||
                c.username.toLowerCase().includes(searchLower) ||
                (c.settings.location || '').toLowerCase().includes(searchLower)
            );

            if (!matchesSearch) return false;

            // 2. Filter Tab
            if (adminFilter === 'EXPIRED') {
                return expDate < now;
            }
            if (adminFilter === 'EXPIRING') {
                // Expiring in next 30 days AND not already expired
                return expDate >= now && expDate <= thirtyDaysFromNow;
            }

            // ALL
            return true;
        }).sort((a, b) => {
            // Sort by expiry date ascending (urgent first)
            return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        });
    }, [companies, adminSearchQuery, adminFilter]);

    const getStatusBadgeStyles = (status: string) => {
        const s = (status || 'Received').toLowerCase();
        if (s === 'delivered') return 'bg-green-100 text-green-700 border border-green-200';
        if (s === 'received') return 'bg-blue-100 text-blue-700 border border-blue-200';
        if (s === 'in transit') return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
        if (s === 'out for delivery') return 'bg-orange-100 text-orange-700 border border-orange-200';
        if (s === 'departed from branch') return 'bg-blue-50 text-blue-600 border border-blue-100';
        if (s === 'received at ho') return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
        if (s === 'loaded into container') return 'bg-slate-100 text-slate-700 border border-slate-200';
        if (s === 'arrived at destination') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    };

    // Aggregate invoices from all related companies
    const allNetworkInvoices = useMemo<DashboardInvoice[]>(() => {
        return relatedCompanies.flatMap(c =>
            c.invoices.map(inv => ({
                ...inv,
                _companyId: c.id,
                _locationName: c.settings.location || c.settings.addressLine2 || c.settings.companyName,
                _companyName: c.settings.companyName,
                _isHeadOffice: !c.parentId
            }))
        );
    }, [relatedCompanies]);

    const activeInvoices = activeCompany?.invoices || [];

    // --- Customer Aggregation ---
    const customers = useMemo(() => {
        const map = new Map<string, AggregatedCustomer>();

        // Determine source invoices based on location filter
        let sourceInvoices = allNetworkInvoices;
        if (dashboardLocationFilter !== 'ALL') {
            sourceInvoices = sourceInvoices.filter(inv => inv._companyId === dashboardLocationFilter);
        }

        sourceInvoices.forEach(inv => {
            const shipper = inv.shipper;
            if (!shipper.name) return;

            // Use a consistent key generation strategy
            const identityKey = shipper.idNo && shipper.idNo.length > 3
                ? `ID:${shipper.idNo}`
                : `NM:${shipper.name.trim().toLowerCase()}|${shipper.tel}`;

            // Key includes companyId to separate customers by branch
            const key = `${identityKey}_${inv._companyId}`;

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    name: shipper.name,
                    idNo: shipper.idNo,
                    mobile: shipper.tel,
                    vatNo: shipper.vatnos,
                    location: inv._locationName,
                    companyId: inv._companyId,
                    totalShipments: 0
                });
            }

            const existing = map.get(key)!;
            existing.totalShipments++;
        });

        let result = Array.from(map.values());

        // Search filter for customers view
        if (view === 'CUSTOMERS' && searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.mobile.includes(q) ||
                c.idNo.includes(q)
            );
        }

        return result;
    }, [allNetworkInvoices, dashboardLocationFilter, searchQuery, view]);

    // --- Derived State for Dashboard ---
    const filteredInvoices = useMemo(() => {
        let result = allNetworkInvoices;

        // 1. Location Filter
        if (dashboardLocationFilter !== 'ALL') {
            result = result.filter(inv => inv._companyId === dashboardLocationFilter);
        }

        // 2. Search Query
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(inv =>
                inv.invoiceNo.toLowerCase().includes(q) ||
                inv.shipper.name.toLowerCase().includes(q) ||
                inv.shipper.tel.includes(q)
            );
        }

        // 3. Date Filter
        const checkDate = (dateStr: string) => {
            const [day, month, year] = dateStr.split('/').map(Number);
            const invDate = new Date(year, month - 1, day);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            invDate.setHours(0, 0, 0, 0);

            if (dateRange === 'TODAY') return invDate.getTime() === today.getTime();
            if (dateRange === 'WEEK') {
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                return invDate >= weekAgo && invDate <= today;
            }
            if (dateRange === 'MONTH') {
                const monthAgo = new Date(today);
                monthAgo.setDate(today.getDate() - 30);
                return invDate >= monthAgo && invDate <= today;
            }
            if (dateRange === 'LAST_MONTH') {
                const startLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                return invDate >= startLastMonth && invDate <= endLastMonth;
            }
            if (dateRange === 'CUSTOM' && customStart && customEnd) {
                const start = new Date(customStart);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customEnd);
                end.setHours(23, 59, 59, 999);
                return invDate >= start && invDate <= end;
            }
            return true;
        };

        result = result.filter(inv => checkDate(inv.date));

        // Sort by Date Descending
        return result.sort((a, b) => {
            const [da, ma, ya] = a.date.split('/').map(Number);
            const [db, mb, yb] = b.date.split('/').map(Number);
            return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
        });
    }, [allNetworkInvoices, dashboardLocationFilter, searchQuery, dateRange, customStart, customEnd]);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredInvoices.forEach(inv => {
            const status = inv.status || 'Received';
            counts[status] = (counts[status] || 0) + 1;
        });
        return counts;
    }, [filteredInvoices]);

    const allTimeStatusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        allNetworkInvoices.forEach(inv => {
            if (dashboardLocationFilter !== 'ALL' && inv._companyId !== dashboardLocationFilter) return;
            const status = inv.status || 'Received';
            counts[status] = (counts[status] || 0) + 1;
        });
        return counts;
    }, [allNetworkInvoices, dashboardLocationFilter]);

    const stats = useMemo(() => {
        const totalShipments = filteredInvoices.length;
        const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.financials.netTotal, 0);

        let transactions: FinancialTransaction[] = [];
        if (dashboardLocationFilter === 'ALL') {
            transactions = relatedCompanies.flatMap(c => c.financialTransactions);
        } else {
            const target = relatedCompanies.find(c => c.id === dashboardLocationFilter);
            transactions = target ? target.financialTransactions : [];
        }

        // Filter transactions by date range
        const filteredTransactions = transactions.filter(tx => {
            // Check if it's an income transaction from an invoice (linked via referenceId)
            // If it is, we use the invoice's date filtering which is already accurate.
            // But for manual transactions and consistent filtering, we need to check the tx.date.

            const [year, month, day] = tx.date.split('-').map(Number);
            const txDate = new Date(year, month - 1, day);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            txDate.setHours(0, 0, 0, 0);

            if (dateRange === 'TODAY') return txDate.getTime() === today.getTime();
            if (dateRange === 'WEEK') {
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                return txDate >= weekAgo && txDate <= today;
            }
            if (dateRange === 'MONTH') {
                const monthAgo = new Date(today);
                monthAgo.setDate(today.getDate() - 30);
                return txDate >= monthAgo && txDate <= today;
            }
            if (dateRange === 'LAST_MONTH') {
                const startLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                return txDate >= startLastMonth && txDate <= endLastMonth;
            }
            if (dateRange === 'CUSTOM' && customStart && customEnd) {
                const start = new Date(customStart);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customEnd);
                end.setHours(23, 59, 59, 999);
                return txDate >= start && txDate <= end;
            }
            return true;
        });

        let cashInHand = 0;
        let bankBalance = 0;
        let totalExpenses = 0;

        filteredTransactions.forEach(tx => {
            const val = tx.type === 'INCOME' ? tx.amount : -tx.amount;
            if (tx.type === 'EXPENSE') {
                totalExpenses += tx.amount;
            }
            if (tx.paymentMode === 'BANK') {
                bankBalance += val;
            } else {
                cashInHand += val;
            }
        });

        return { totalShipments, totalRevenue, totalExpenses, cashInHand, bankBalance };
    }, [filteredInvoices, relatedCompanies, dashboardLocationFilter, dateRange, customStart, customEnd]);

    const allTimeStats = useMemo(() => {
        let companiesToStats = relatedCompanies;
        if (dashboardLocationFilter !== 'ALL') {
            companiesToStats = relatedCompanies.filter(c => c.id === dashboardLocationFilter);
        }
        const transactions = companiesToStats.flatMap(c => c.financialTransactions);
        let cashInHand = 0;
        let bankBalance = 0;

        transactions.forEach(tx => {
            const val = tx.type === 'INCOME' ? tx.amount : -tx.amount;
            if (tx.paymentMode === 'BANK') {
                bankBalance += val;
            } else {
                cashInHand += val;
            }
        });

        return { cashInHand, bankBalance };
    }, [relatedCompanies, dashboardLocationFilter]);

    const latest10Invoices = useMemo(() => {
        let source = allNetworkInvoices;
        if (dashboardLocationFilter !== 'ALL') {
            source = allNetworkInvoices.filter(inv => inv._companyId === dashboardLocationFilter);
        }
        return [...source].sort((a, b) => {
            const [da, ma, ya] = a.date.split('/').map(Number);
            const [db, mb, yb] = b.date.split('/').map(Number);
            return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
        }).slice(0, 10);
    }, [allNetworkInvoices, dashboardLocationFilter]);

    const getRangeLabel = () => {
        if (dateRange === 'TODAY') return 'Today';
        if (dateRange === 'WEEK') return 'Last 7 Days';
        if (dateRange === 'MONTH') return 'Last 30 Days';
        if (dateRange === 'LAST_MONTH') return 'Last Month';
        if (dateRange === 'CUSTOM') return `${customStart} to ${customEnd}`;
        return '';
    };


    // --- Handlers ---

    const renderHeader = () => {
        if (!activeCompany && !isSuperAdmin) return null;
        return (
            <nav className="bg-blue-900 text-white p-4 flex justify-between items-center shadow-lg sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsMenuOpen(true)} className="hover:bg-blue-800 p-1 rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold">
                        {isSuperAdmin
                            ? (activeCompany ? `ADMIN: ${activeCompany.settings.companyName}` : 'SUPER ADMIN PANEL')
                            : `${activeCompany?.settings.companyName} ${activeCompany?.settings.location ? `(${activeCompany.settings.location})` : ''}`}
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <span className="hidden md:inline text-sm opacity-80">Logged in as {isSuperAdmin ? 'Super Admin' : activeCompany?.username}</span>
                    <button onClick={handleLogout} className="bg-red-600 px-3 py-1 rounded hover:bg-red-500 text-sm">Logout</button>
                </div>
            </nav>
        );
    };

    const renderSidebar = () => {
        if (!isMenuOpen || (!activeCompany && !isSuperAdmin)) return null;
        return (
            <div className="fixed inset-0 z-50 flex">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setIsMenuOpen(false)}></div>

                {/* Sidebar Content */}
                <div className="relative bg-white w-64 h-full shadow-2xl flex flex-col animate-slide-in-left">
                    <div className="p-4 bg-blue-900 text-white flex justify-between items-center">
                        <h2 className="font-bold text-lg">Menu</h2>
                        <button onClick={() => setIsMenuOpen(false)} className="text-white hover:text-red-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto">
                        {isSuperAdmin && (
                            <button onClick={() => handleNavClick('SETTINGS')} className={`px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 ${view === 'SETTINGS' ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-900' : 'text-gray-700'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                </svg>
                                Admin Dashboard
                            </button>
                        )}

                        {activeCompany && (
                            <>
                                <button onClick={() => handleNavClick('DASHBOARD')} className={`px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 ${view === 'DASHBOARD' ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-900' : 'text-gray-700'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                    </svg>
                                    Dashboard
                                </button>

                                <button onClick={() => handleNavClick('INVOICES')} className={`px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 ${view === 'INVOICES' ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-900' : 'text-gray-700'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                    </svg>
                                    Invoices
                                </button>

                                <button onClick={() => handleNavClick('BULK_STATUS_CHANGE')} className={`px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 ${view === 'BULK_STATUS_CHANGE' ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-900' : 'text-gray-700'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                    </svg>
                                    Modify Status
                                </button>

                                <button onClick={() => handleNavClick('CUSTOMERS')} className={`px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 ${view === 'CUSTOMERS' ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-900' : 'text-gray-700'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                    </svg>
                                    Customers
                                </button>

                                <button onClick={() => handleNavClick('ITEMS')} className={`px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 ${view === 'ITEMS' ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-900' : 'text-gray-700'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                                    </svg>
                                    Items
                                </button>


                                <button onClick={() => handleNavClick('SHIPMENT_TYPES')} className={`px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 ${view === 'SHIPMENT_TYPES' ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-900' : 'text-gray-700'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z" clipRule="evenodd" />
                                    </svg>
                                    Shipment Types
                                </button>

                                <button onClick={() => handleNavClick('FINANCE')} className={`px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 ${view === 'FINANCE' ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-900' : 'text-gray-700'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.312-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.312.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                    </svg>
                                    Financial Accounts
                                </button>

                                <button onClick={() => handleNavClick('BRANCH_MANAGEMENT')} className={`px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 ${view === 'BRANCH_MANAGEMENT' ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-900' : 'text-gray-700'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 8v7a1 1 0 100 2h14a1 1 0 100-2V8a1 1 0 00.496-1.868l-7-4zM6 9a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm3 1a1 1 0 012 0v3a1 1 0 11-2 0v-3zm5-1a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Branch Management
                                </button>
                            </>
                        )}

                        <div className="border-t my-2"></div>

                        <button onClick={handleLogout} className="px-4 py-3 text-left hover:bg-red-50 text-red-600 flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                            </svg>
                            Logout
                        </button>
                    </div>

                    <div className="p-4 bg-gray-50 text-xs text-gray-500 border-t">
                        <p>{isSuperAdmin ? 'Super Admin Access' : `${activeCompany?.settings.companyName} (${activeCompany?.settings.location || 'HQ'})`}</p>
                        {activeCompany && <p className="mt-1">User: {activeCompany.username}</p>}
                    </div>
                </div>
            </div>
        );
    };

    const renderFilterBar = () => {
        // ... existing renderFilterBar code ...
        const isBranchUser = activeCompany?.parentId;

        return (
            <div className="bg-white p-4 rounded shadow mb-6 flex flex-col xl:flex-row gap-4 items-center">
                {view !== 'DASHBOARD' && (
                    <div className="relative w-full xl:w-1/3">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <svg className="h-5 w-5 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder={view === 'CUSTOMERS' ? "Search customer name, mobile, id..." : "Search invoice #, name, mobile..."}
                            className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400 transition-all shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-2 items-center w-full xl:w-auto">
                    <select
                        className={`border border-gray-300 rounded px-3 py-2 bg-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-auto ${isBranchUser ? 'opacity-60 cursor-not-allowed' : ''}`}
                        value={dashboardLocationFilter}
                        onChange={(e) => setDashboardLocationFilter(e.target.value)}
                        disabled={!!isBranchUser}
                    >
                        {!isBranchUser && <option value="ALL">All Locations</option>}
                        {relatedCompanies.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.settings.companyName} ({c.settings.location || c.settings.addressLine2 || 'Main'})
                            </option>
                        ))}
                    </select>

                    {view !== 'CUSTOMERS' && view !== 'ITEMS' && (
                        <>
                            <div className="bg-gray-200 p-1 rounded-lg flex items-center gap-1 self-start sm:self-auto overflow-x-auto max-w-full">
                                {(['TODAY', 'WEEK', 'MONTH', 'LAST_MONTH', 'CUSTOM'] as const).map(r => {
                                    let label = '';
                                    switch (r) {
                                        case 'TODAY': label = 'Today'; break;
                                        case 'WEEK': label = 'Week'; break;
                                        case 'MONTH': label = 'Month'; break;
                                        case 'LAST_MONTH': label = 'Last Month'; break;
                                        case 'CUSTOM': label = 'Custom'; break;
                                    }
                                    const isActive = dateRange === r;
                                    return (
                                        <button
                                            key={r}
                                            onClick={() => setDateRange(r)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${isActive
                                                ? 'bg-white text-blue-900 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-300/50'
                                                }`}
                                        >
                                            {label}
                                        </button>
                                    )
                                })}
                            </div>

                            {dateRange === 'CUSTOM' && (
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="date"
                                        className="border border-gray-300 rounded px-2 py-2 text-sm bg-gray-300 text-black placeholder-black"
                                        value={customStart}
                                        onChange={(e) => setCustomStart(e.target.value)}
                                    />
                                    <span className="text-gray-500">-</span>
                                    <input
                                        type="date"
                                        className="border border-gray-300 rounded px-2 py-2 text-sm bg-gray-300 text-black placeholder-black"
                                        value={customEnd}
                                        onChange={(e) => setCustomEnd(e.target.value)}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        )
    };

    // ... rest of handlers ...
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');

        // 1. Check Super Admin
        if (username === 'qovoz' && password === '123') {
            setIsSuperAdmin(true);
            setActiveCompanyId(null);
            updateView('SETTINGS'); // Admin goes straight to company creation
            return;
        }

        // 2. Check Companies
        const company = companies.find(c => c.username === username && c.password === password);
        if (company) {
            // Check Expiration
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expDate = new Date(company.expiryDate);

            if (today > expDate) {
                setLoginError('Account has expired. Please contact support.');
                return;
            }

            setActiveCompanyId(company.id);
            setIsSuperAdmin(false);

            // Initialize Dashboard Filter logic
            if (company.parentId) {
                // If logging in as a branch, force filter to own location
                setDashboardLocationFilter(company.id);
            } else {
                // If logging in as HQ, show ALL by default
                setDashboardLocationFilter('ALL');
            }

            updateView('DASHBOARD');
        } else {
            setLoginError('Invalid Username/Password');
        }
    };

    const handleLogout = () => {
        setActiveCompanyId(null);
        setIsSuperAdmin(false);
        updateView('LOGIN');
        setUsername('');
        setPassword('');
        setLoginError('');
        setIsMenuOpen(false);
        // Clear bulk selections on logout
        setSelectedInvoiceNos([]);
        setIsBulkModalOpen(false);
    };

    const handleNavClick = (newView: ViewState) => {
        updateView(newView);
        setIsMenuOpen(false);
        setSearchQuery('');
        setSelectedCustomer(null);

        // Reset modes
        setBranchManagementMode('LIST');

        if (newView === 'CREATE_INVOICE') {
            handleCreateInvoice();
        }

        // Clear bulk selections when navigating away from Modify Status
        if (newView !== 'BULK_STATUS_CHANGE') {
            setSelectedInvoiceNos([]);
            setIsBulkModalOpen(false);
        }
    };

    const addShipmentType = () => {
        if (!tempShipmentName || !tempShipmentValue) return;

        const newType = { name: tempShipmentName, value: parseFloat(tempShipmentValue) };
        const currentTypes = newCompany.settings?.shipmentTypes || [];

        setNewCompany({
            ...newCompany,
            settings: {
                ...newCompany.settings,
                shipmentTypes: [...currentTypes, newType]
            }
        });
        setTempShipmentName('');
        setTempShipmentValue('');
    };

    const removeShipmentType = (index: number) => {
        const currentTypes = newCompany.settings?.shipmentTypes || [];
        const updated = currentTypes.filter((_, i) => i !== index);
        setNewCompany({
            ...newCompany,
            settings: {
                ...newCompany.settings,
                shipmentTypes: updated
            }
        });
    };

    // DnD Handlers for Shipment Status
    const handleStatusDragStart = (e: React.DragEvent, index: number) => {
        setDraggedStatusIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleStatusDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleStatusDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedStatusIndex === null || draggedStatusIndex === dropIndex) return;

        const currentSettings = newCompany.settings.shipmentStatusSettings || DEFAULT_SHIPMENT_STATUS_SETTINGS;
        const updatedList = [...currentSettings];

        const [draggedItem] = updatedList.splice(draggedStatusIndex, 1);
        updatedList.splice(dropIndex, 0, draggedItem);

        const reorderedList = updatedList.map((item, idx) => ({ ...item, order: idx }));

        setNewCompany(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                shipmentStatusSettings: reorderedList
            }
        }));
        setDraggedStatusIndex(null);
    };

    const handleStatusNameChange = (index: number, newName: string) => {
        const currentSettings = newCompany.settings.shipmentStatusSettings || DEFAULT_SHIPMENT_STATUS_SETTINGS;
        const updatedList = [...currentSettings];
        updatedList[index] = { ...updatedList[index], name: newName };

        setNewCompany(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                shipmentStatusSettings: updatedList
            }
        }));
    };

    const addShipmentStatus = () => {
        if (!tempStatusName) return;
        const currentStatuses = newCompany.settings?.shipmentStatusSettings || DEFAULT_SHIPMENT_STATUS_SETTINGS;
        const newStatus: ShipmentStatusSetting = {
            id: `sts_${Date.now()}`,
            name: tempStatusName,
            order: currentStatuses.length
        };
        setNewCompany(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                shipmentStatusSettings: [...currentStatuses, newStatus]
            }
        }));
        setTempStatusName('');
    };

    const removeShipmentStatus = (index: number) => {
        const currentStatuses = newCompany.settings?.shipmentStatusSettings || DEFAULT_SHIPMENT_STATUS_SETTINGS;
        const updated = currentStatuses.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
        setNewCompany(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                shipmentStatusSettings: updated
            }
        }));
    };

    const handleSaveCompany = () => {
        if (!newCompany.username || !newCompany.password || !newCompany.settings?.companyName) {
            alert("Please fill in required fields (Company Name, Username, Password)");
            return;
        }

        const parentIdToSave = isBranch && selectedParentId ? selectedParentId : undefined;

        if (editingCompanyId) {
            // Update Existing
            setCompanies(prev => prev.map(c => {
                if (c.id === editingCompanyId) {
                    return {
                        ...c,
                        username: newCompany.username!,
                        password: newCompany.password!,
                        expiryDate: newCompany.expiryDate || c.expiryDate,
                        parentId: parentIdToSave,
                        settings: {
                            ...c.settings,
                            ...newCompany.settings,
                            companyName: newCompany.settings?.companyName || c.settings.companyName,
                            companyArabicName: newCompany.settings?.companyArabicName || c.settings.companyArabicName,
                            invoicePrefix: newCompany.settings?.invoicePrefix || c.settings.invoicePrefix,
                            invoiceStartNumber: newCompany.settings?.invoiceStartNumber || c.settings.invoiceStartNumber,
                            location: newCompany.settings?.location || c.settings.location,
                            addressLine1: newCompany.settings?.addressLine1 || c.settings.addressLine1,
                            addressLine2: newCompany.settings?.addressLine2 || c.settings.addressLine2,
                            addressLine1Arabic: newCompany.settings?.addressLine1Arabic || c.settings.addressLine1Arabic,
                            addressLine2Arabic: newCompany.settings?.addressLine2Arabic || c.settings.addressLine2Arabic,
                            phone1: newCompany.settings?.phone1 || c.settings.phone1,
                            phone2: newCompany.settings?.phone2 || c.settings.phone2,
                            vatnoc: newCompany.settings?.vatnoc || c.settings.vatnoc,
                            isVatEnabled: newCompany.settings?.isVatEnabled ?? c.settings.isVatEnabled,
                            logoUrl: newCompany.settings?.logoUrl || c.settings.logoUrl,
                            brandColor: newCompany.settings?.brandColor || c.settings.brandColor,
                            shipmentTypes: newCompany.settings?.shipmentTypes || c.settings.shipmentTypes,
                            tcHeader: newCompany.settings?.tcHeader || c.settings.tcHeader,
                            tcEnglish: newCompany.settings?.tcEnglish || c.settings.tcEnglish,
                            tcArabic: newCompany.settings?.tcArabic || c.settings.tcArabic,
                            shipmentStatusSettings: newCompany.settings?.shipmentStatusSettings || c.settings.shipmentStatusSettings
                        }
                    };
                }
                return c;
            }));
            alert("Company Updated Successfully!");
        } else {
            // Create New
            const companyToAdd: Company = {
                id: Date.now().toString(),
                username: newCompany.username!,
                password: newCompany.password!,
                expiryDate: newCompany.expiryDate || getOneYearFromNow(),
                parentId: parentIdToSave,
                settings: {
                    companyName: newCompany.settings.companyName || '',
                    companyArabicName: newCompany.settings.companyArabicName || '',
                    invoicePrefix: newCompany.settings.invoicePrefix || '',
                    invoiceStartNumber: newCompany.settings.invoiceStartNumber || 1000,
                    location: newCompany.settings.location || '',
                    addressLine1: newCompany.settings.addressLine1 || '',
                    addressLine2: newCompany.settings.addressLine2 || '',
                    addressLine1Arabic: newCompany.settings.addressLine1Arabic || '',
                    addressLine2Arabic: newCompany.settings.addressLine2Arabic || '',
                    phone1: newCompany.settings.phone1 || '',
                    phone2: newCompany.settings.phone2 || '',
                    vatnoc: newCompany.settings.vatnoc || '',
                    isVatEnabled: newCompany.settings.isVatEnabled || false,
                    logoUrl: newCompany.settings.logoUrl || '',
                    brandColor: newCompany.settings.brandColor || DEFAULT_BRAND_COLOR,
                    shipmentTypes: newCompany.settings.shipmentTypes || [],
                    tcHeader: newCompany.settings.tcHeader || DEFAULT_TC_HEADER,
                    tcEnglish: newCompany.settings.tcEnglish || DEFAULT_TC_ENGLISH,
                    tcArabic: newCompany.settings.tcArabic || DEFAULT_TC_ARABIC,
                    shipmentStatusSettings: newCompany.settings.shipmentStatusSettings || DEFAULT_SHIPMENT_STATUS_SETTINGS
                },
                invoices: [],
                financialAccounts: DEFAULT_ACCOUNTS,
                financialTransactions: [],
                items: DEFAULT_ITEMS
            };
            setCompanies([...companies, companyToAdd]);
            alert("Company Created Successfully!");
        }

        // Reset Form
        setNewCompany({ expiryDate: getOneYearFromNow(), parentId: undefined, settings: { shipmentTypes: [], isVatEnabled: false, tcHeader: DEFAULT_TC_HEADER, tcEnglish: DEFAULT_TC_ENGLISH, tcArabic: DEFAULT_TC_ARABIC, brandColor: DEFAULT_BRAND_COLOR, invoicePrefix: '', invoiceStartNumber: 1000, location: '', shipmentStatusSettings: DEFAULT_SHIPMENT_STATUS_SETTINGS } });
        setEditingCompanyId(null);
        setIsBranch(false);
        setSelectedParentId('');
        setTempShipmentName('');
        setTempShipmentValue('');

        if (branchManagementMode === 'EDIT') {
            setBranchManagementMode('LIST');
        }

        if (view === 'ADMIN_COMPANY_FORM') {
            updateView('SETTINGS');
        }

        if (view === 'ADMIN_COMPANY_FORM') {
            updateView('SETTINGS');
        }
    };


    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Max 500KB
        if (file.size > 500 * 1024) {
            alert("Logo file is too large! Please use an image under 500KB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setNewCompany(prev => ({
                ...prev,
                settings: {
                    ...prev.settings,
                    logoUrl: base64
                }
            }));
        };
        reader.readAsDataURL(file);
    };


    const handleEditCompany = (company: Company) => {
        setEditingCompanyId(company.id);
        // Branch logic
        if (company.parentId) {
            setIsBranch(true);
            setSelectedParentId(company.parentId);
        } else {
            setIsBranch(false);
            setSelectedParentId('');
        }

        setNewCompany({
            username: company.username,
            password: company.password,
            expiryDate: company.expiryDate,
            parentId: company.parentId,
            settings: {
                ...company.settings,
                tcHeader: company.settings.tcHeader || DEFAULT_TC_HEADER,
                tcEnglish: company.settings.tcEnglish || DEFAULT_TC_ENGLISH,
                tcArabic: company.settings.tcArabic || DEFAULT_TC_ARABIC,
                brandColor: company.settings.brandColor || DEFAULT_BRAND_COLOR,
                invoicePrefix: company.settings.invoicePrefix || '',
                invoiceStartNumber: company.settings.invoiceStartNumber || 1000,
                location: company.settings.location || '',
                shipmentStatusSettings: company.settings.shipmentStatusSettings || DEFAULT_SHIPMENT_STATUS_SETTINGS
            }
        });
        // Scroll to top to see form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingCompanyId(null);
        setNewCompany({ expiryDate: getOneYearFromNow(), parentId: undefined, settings: { shipmentTypes: [], isVatEnabled: false, tcHeader: DEFAULT_TC_HEADER, tcEnglish: DEFAULT_TC_ENGLISH, tcArabic: DEFAULT_TC_ARABIC, brandColor: DEFAULT_BRAND_COLOR, invoicePrefix: '', invoiceStartNumber: 1000, location: '', shipmentStatusSettings: DEFAULT_SHIPMENT_STATUS_SETTINGS } });
        setTempShipmentName('');
        setTempShipmentValue('');
        setIsBranch(false);
        setSelectedParentId('');

        if (branchManagementMode === 'EDIT') {
            setBranchManagementMode('LIST');
        }
    };

    // ... (Create Invoice, Edit Invoice, Invoice Submit, Customer Logic ...)

    const handleCreateInvoice = () => {
        if (!activeCompany) return;

        // Default values if settings are missing
        const prefix = activeCompany.settings.invoicePrefix || '';
        const startNum = activeCompany.settings.invoiceStartNumber || 1000;

        let nextNum = startNum;

        if (activeInvoices.length > 0) {
            const lastInvoiceNo = activeInvoices[0].invoiceNo;
            const numberPart = lastInvoiceNo.replace(prefix, '');
            const parsed = parseInt(numberPart, 10);

            if (!isNaN(parsed)) {
                nextNum = parsed + 1;
            } else {
                const match = lastInvoiceNo.match(/(\d+)$/);
                if (match) {
                    nextNum = parseInt(match[1], 10) + 1;
                }
            }
        }

        const nextInvoiceNo = `${prefix}${nextNum}`;

        const template: InvoiceData = {
            invoiceNo: nextInvoiceNo,
            date: formatDate(new Date()),
            shipmentType: activeCompany.settings.shipmentTypes[0]?.name || '',
            status: 'Received',
            statusHistory: [{ status: 'Received', timestamp: new Date().toISOString() }],
            shipper: { name: '', idNo: '', tel: '', vatnos: '', pcs: 0, weight: 0 },
            consignee: { name: '', address: '', post: '', pin: '', country: '', district: '', state: '', tel: '', tel2: '' },
            cargoItems: [],
            financials: { total: 0, billCharges: 0, vat: 0, vatAmount: 0, netTotal: 0 }
        };

        setCurrentInvoice(template);
        updateView('CREATE_INVOICE');
    };

    const handleEditInvoice = (invoice: InvoiceData) => {
        setCurrentInvoice(invoice);
        updateView('CREATE_INVOICE');
    };

    const handleInvoiceSubmit = (data: InvoiceData) => {
        let foundAndUpdated = false;

        // Helper to generate new items
        const getUpdatedItems = (existingItems: ItemMaster[] | undefined, cargoItems: InvoiceItem[]) => {
            const currentItems = existingItems || [];
            const existingNames = new Set(currentItems.map(i => i.name.toUpperCase()));
            const newItemsToAdd: ItemMaster[] = [];

            cargoItems.forEach(item => {
                const name = item.description.trim().toUpperCase();
                // Basic validation: ignore if too short or empty
                if (name && name.length > 0 && !existingNames.has(name)) {
                    newItemsToAdd.push({
                        id: `itm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        name: name
                    });
                    existingNames.add(name);
                }
            });
            return [...currentItems, ...newItemsToAdd];
        };

        setCompanies(prev => {
            // 1. Try to find and update existing invoice in ANY company
            const nextCompanies = prev.map(c => {
                const existingIndex = c.invoices.findIndex(inv => inv.invoiceNo === data.invoiceNo);
                if (existingIndex >= 0) {
                    foundAndUpdated = true;
                    const updatedInvoices = [...c.invoices];
                    updatedInvoices[existingIndex] = data;

                    // --- FINANCE LINKING (Re-write) ---
                    let updatedTransactions = (c.financialTransactions || []).filter(t => t.referenceId !== data.invoiceNo);

                    const timestamp = new Date().toISOString();
                    const date = new Date().toISOString().split('T')[0];

                    if (data.paymentMode === 'SPLIT' && data.splitDetails) {
                        if (data.splitDetails.cash > 0) {
                            updatedTransactions.push({
                                id: `tx_${data.invoiceNo}_cash_${Date.now()}`,
                                date, timestamp, accountId: 'acc_sales', type: 'INCOME',
                                amount: data.splitDetails.cash,
                                description: `Invoice ${data.invoiceNo} (Cash Split)`,
                                referenceId: data.invoiceNo,
                                paymentMode: 'CASH'
                            });
                        }
                        if (data.splitDetails.bank > 0) {
                            updatedTransactions.push({
                                id: `tx_${data.invoiceNo}_bank_${Date.now()}`,
                                date, timestamp, accountId: 'acc_sales', type: 'INCOME',
                                amount: data.splitDetails.bank,
                                description: `Invoice ${data.invoiceNo} (Bank Split)`,
                                referenceId: data.invoiceNo,
                                paymentMode: 'BANK'
                            });
                        }
                    } else {
                        updatedTransactions.push({
                            id: `tx_${data.invoiceNo}_${Date.now()}`,
                            date, timestamp, accountId: 'acc_sales', type: 'INCOME',
                            amount: data.financials.netTotal,
                            description: `Invoice ${data.invoiceNo}`,
                            referenceId: data.invoiceNo,
                            paymentMode: (data.paymentMode as 'CASH' | 'BANK') || 'CASH'
                        });
                    }

                    return {
                        ...c,
                        invoices: updatedInvoices,
                        financialTransactions: updatedTransactions,
                        items: getUpdatedItems(c.items, data.cargoItems)
                    };
                }
                return c;
            });

            if (foundAndUpdated) {
                return nextCompanies;
            }

            // 2. If new, add to active company
            if (activeCompanyId) {
                return prev.map(c => {
                    if (c.id === activeCompanyId) {
                        const timestamp = new Date().toISOString();
                        const date = new Date().toISOString().split('T')[0];
                        let newTransactions: FinancialTransaction[] = [];

                        if (data.paymentMode === 'SPLIT' && data.splitDetails) {
                            if (data.splitDetails.cash > 0) {
                                newTransactions.push({
                                    id: `tx_${data.invoiceNo}_cash_${Date.now()}`,
                                    date,
                                    timestamp,
                                    accountId: 'acc_sales',
                                    type: 'INCOME',
                                    amount: data.splitDetails.cash,
                                    description: `Invoice ${data.invoiceNo} (Cash Split)`,
                                    referenceId: data.invoiceNo,
                                    paymentMode: 'CASH'
                                });
                            }
                            if (data.splitDetails.bank > 0) {
                                newTransactions.push({
                                    id: `tx_${data.invoiceNo}_bank_${Date.now()}`,
                                    date,
                                    timestamp,
                                    accountId: 'acc_sales',
                                    type: 'INCOME',
                                    amount: data.splitDetails.bank,
                                    description: `Invoice ${data.invoiceNo} (Bank Split)`,
                                    referenceId: data.invoiceNo,
                                    paymentMode: 'BANK'
                                });
                            }
                        } else {
                            newTransactions.push({
                                id: `tx_${data.invoiceNo}_${Date.now()}`,
                                date,
                                timestamp,
                                accountId: 'acc_sales',
                                type: 'INCOME',
                                amount: data.financials.netTotal,
                                description: `Invoice ${data.invoiceNo}`,
                                referenceId: data.invoiceNo,
                                paymentMode: (data.paymentMode as 'CASH' | 'BANK') || 'CASH'
                            });
                        }

                        return {
                            ...c,
                            invoices: [data, ...c.invoices],
                            financialTransactions: [...newTransactions, ...(c.financialTransactions || [])],
                            items: getUpdatedItems(c.items, data.cargoItems)
                        };
                    }
                    return c;
                });
            }

            return prev;
        });

        setCurrentInvoice(data);
        updateView('PREVIEW_INVOICE');
    };

    // Customer Edit Logic
    const handleEditCustomerClick = (e: React.MouseEvent, customer: AggregatedCustomer) => {
        e.stopPropagation(); // Prevent row click
        setEditingCustomer(customer);
        setEditCustomerForm({
            name: customer.name,
            mobile: customer.mobile,
            idNo: customer.idNo
        });
    };

    const handleSaveCustomerDetails = () => {
        if (!editingCustomer) return;

        if (!window.confirm(`This will update the details for ${editingCustomer.totalShipments} invoices belonging to this customer. Continue?`)) {
            return;
        }

        setCompanies(prev => prev.map(company => {
            if (company.id !== editingCustomer.companyId) return company;

            const updatedInvoices = company.invoices.map(inv => {
                const shipper = inv.shipper;
                const identityKey = shipper.idNo && shipper.idNo.length > 3 ? `ID:${shipper.idNo}` : `NM:${shipper.name.trim().toLowerCase()}|${shipper.tel}`;
                const key = `${identityKey}_${company.id}`;

                if (key === editingCustomer.key) {
                    return {
                        ...inv,
                        shipper: {
                            ...inv.shipper,
                            name: editCustomerForm.name,
                            tel: editCustomerForm.mobile,
                            idNo: editCustomerForm.idNo
                        }
                    };
                }
                return inv;
            });

            return { ...company, invoices: updatedInvoices };
        }));

        setEditingCustomer(null);
        alert("Customer details updated successfully.");
    };

    // --- Finance Handlers ---
    const handleSaveTransaction = () => {
        if (!newTransaction.amount || !newTransaction.accountId || !newTransaction.description) {
            alert("Please fill all fields");
            return;
        }

        if (!activeCompanyId) return;

        setCompanies(prev => prev.map(c => {
            if (c.id === activeCompanyId) {
                const tx: FinancialTransaction = {
                    id: `tx_manual_${Date.now()}`,
                    date: newTransaction.date || new Date().toISOString().split('T')[0],
                    timestamp: new Date().toISOString(),
                    accountId: newTransaction.accountId!,
                    amount: parseFloat(newTransaction.amount!.toString()),
                    type: newTransaction.type as 'INCOME' | 'EXPENSE',
                    description: newTransaction.description!,
                    paymentMode: newTransaction.paymentMode || 'CASH'
                };
                return { ...c, financialTransactions: [tx, ...(c.financialTransactions || [])] };
            }
            return c;
        }));

        setIsAddTransactionOpen(false);
        setNewTransaction({ type: 'EXPENSE', amount: 0, description: '', accountId: '', date: new Date().toISOString().split('T')[0], paymentMode: 'CASH' });
    };

    // --- Item Management Handlers ---
    const handleSaveItem = () => {
        if (!itemFormName.trim()) {
            alert("Item name cannot be empty");
            return;
        }

        setCompanies(prev => prev.map(c => {
            if (c.id === activeCompanyId) {
                const items = c.items || [];
                if (editingItem) {
                    // Edit
                    const updatedItems = items.map(i => i.id === editingItem.id ? { ...i, name: itemFormName.toUpperCase() } : i);
                    return { ...c, items: updatedItems };
                } else {
                    // Create
                    if (items.some(i => i.name.toUpperCase() === itemFormName.trim().toUpperCase())) {
                        alert("Item with this name already exists");
                        return c;
                    }
                    const newItem: ItemMaster = {
                        id: `itm_${Date.now()}`,
                        name: itemFormName.toUpperCase()
                    };
                    return { ...c, items: [...items, newItem] };
                }
            }
            return c;
        }));

        setIsItemModalOpen(false);
        setItemFormName('');
        setEditingItem(null);
    };

    // --- Shipment Type Management Handlers ---
    const handleSaveShipmentType = () => {
        if (!shipmentTypeFormName.trim() || !shipmentTypeFormValue) {
            alert("Name and Value are required");
            return;
        }

        const newType = { name: shipmentTypeFormName.toUpperCase(), value: parseFloat(shipmentTypeFormValue) };

        setCompanies(prev => prev.map(c => {
            if (c.id === activeCompanyId) {
                const currentTypes = c.settings.shipmentTypes || [];
                if (editingShipmentType) {
                    // Edit
                    const updated = currentTypes.map((t, i) => i === editingShipmentType.index ? newType : t);
                    return { ...c, settings: { ...c.settings, shipmentTypes: updated } };
                } else {
                    // Create
                    if (currentTypes.some((t: ShipmentType) => t.name.toUpperCase() === newType.name.toUpperCase())) {
                        alert("Shipment type with this name already exists");
                        return c;
                    }
                    return { ...c, settings: { ...c.settings, shipmentTypes: [...currentTypes, newType] } };
                }
            }
            return c;
        }));

        setIsShipmentTypeModalOpen(false);
        setEditingShipmentType(null);
        setShipmentTypeFormName('');
        setShipmentTypeFormValue('');
    };

    const handleDeleteShipmentType = (index: number) => {
        if (!confirm("Are you sure you want to delete this shipment type?")) return;

        setCompanies(prev => prev.map(c => {
            if (c.id === activeCompanyId) {
                const currentTypes = c.settings.shipmentTypes || [];
                const updated = currentTypes.filter((_, i) => i !== index);
                return { ...c, settings: { ...c.settings, shipmentTypes: updated } };
            }
            return c;
        }));
    };
    const handleDeleteItem = (itemId: string) => {
        if (!window.confirm("Are you sure you want to delete this item?")) return;

        setCompanies(prev => prev.map(c => {
            if (c.id === activeCompanyId) {
                return { ...c, items: (c.items || []).filter(i => i.id !== itemId) };
            }
            return c;
        }));
    };

    const handleBranchEditClick = (company: Company) => {
        handleEditCompany(company);
        setBranchManagementMode('EDIT');
    };

    // --- Render Functions ---

    const renderHistoryModal = () => (
        viewingHistoryInvoice && (
            <StatusHistoryModal
                invoice={viewingHistoryInvoice}
                onClose={() => setViewingHistoryInvoice(null)}
            />
        )
    );

    const renderItems = () => (
        <div className="min-h-screen bg-gray-50">
            {renderHeader()}
            {renderSidebar()}
            <main className="max-w-4xl mx-auto p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Item Master</h2>
                    <button
                        onClick={() => { setEditingItem(null); setItemFormName(''); setIsItemModalOpen(true); }}
                        className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-bold"
                    >
                        + Add New Item
                    </button>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                    <div className="relative w-full">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder="Search items..."
                            className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400 transition-all shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="bg-white rounded shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                                <tr>
                                    <th className="p-4">Item Name</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(activeCompany?.items || [])
                                    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map((item) => (
                                        <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="p-4 font-bold text-gray-700">{item.name}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => { setEditingItem(item); setItemFormName(item.name); setIsItemModalOpen(true); }}
                                                    className="text-blue-600 hover:text-blue-800 font-bold mr-4 text-sm"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    className="text-red-500 hover:text-red-700 font-bold text-sm"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                {(activeCompany?.items || []).filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                    <tr><td colSpan={2} className="p-6 text-center text-gray-500">No items found matching your criteria.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {isItemModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded shadow-lg w-96">
                        <h3 className="font-bold text-lg mb-4">{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
                        <input
                            className="w-full border p-2 rounded mb-4"
                            placeholder="Item Name"
                            value={itemFormName}
                            onChange={e => setItemFormName(e.target.value)}
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsItemModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={handleSaveItem} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderShipmentTypes = () => (
        <div className="min-h-screen bg-gray-50">
            {renderHeader()}
            {renderSidebar()}
            <main className="max-w-4xl mx-auto p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Shipment Types</h2>
                    <button
                        onClick={() => { setEditingShipmentType(null); setShipmentTypeFormName(''); setShipmentTypeFormValue(''); setIsShipmentTypeModalOpen(true); }}
                        className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-bold"
                    >
                        + Add New Type
                    </button>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                    <div className="relative w-full">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder="Search shipment types..."
                            className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400 transition-all shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="bg-white rounded shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                                <tr>
                                    <th className="p-4">Type Name</th>
                                    <th className="p-4">Rate (SAR)</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(activeCompany?.settings.shipmentTypes || [])
                                    .filter(type => type.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map((type, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="p-4 font-bold text-gray-700">{type.name}</td>
                                            <td className="p-4 font-mono text-blue-600">{type.value.toFixed(2)}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => { setEditingShipmentType({ index: idx, type }); setShipmentTypeFormName(type.name); setShipmentTypeFormValue(type.value.toString()); setIsShipmentTypeModalOpen(true); }}
                                                    className="text-blue-600 hover:text-blue-800 font-bold mr-4 text-sm"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteShipmentType(idx)}
                                                    className="text-red-500 hover:text-red-700 font-bold text-sm"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                {(activeCompany?.settings.shipmentTypes || []).filter(type => type.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                    <tr><td colSpan={3} className="p-6 text-center text-gray-500">No shipment types found matching your criteria.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {isShipmentTypeModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded shadow-lg w-96">
                        <h3 className="font-bold text-lg mb-4">{editingShipmentType ? 'Edit Shipment Type' : 'Add New Shipment Type'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Type Name</label>
                                <input
                                    className="w-full border p-2 rounded"
                                    placeholder="e.g. AIR CARGO"
                                    value={shipmentTypeFormName}
                                    onChange={e => setShipmentTypeFormName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Rate (per unit)</label>
                                <input
                                    className="w-full border p-2 rounded"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={shipmentTypeFormValue}
                                    onChange={e => setShipmentTypeFormValue(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setIsShipmentTypeModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={handleSaveShipmentType} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderCustomers = () => (
        <div className="min-h-screen bg-gray-50">
            {renderHeader()}
            {renderSidebar()}
            <main className="max-w-7xl mx-auto p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Customers</h2>
                {renderFilterBar()}
                <div className="bg-white rounded shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 text-gray-600 font-bold">
                                <tr>
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Mobile</th>
                                    <th className="p-4">ID No</th>
                                    <th className="p-4">Location</th>
                                    <th className="p-4 text-center">Shipments</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((c) => (
                                    <tr key={c.key} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedCustomer(c); updateView('CUSTOMER_DETAIL'); }}>
                                        <td className="p-4 font-bold text-blue-900">{c.name}</td>
                                        <td className="p-4">{c.mobile}</td>
                                        <td className="p-4 font-mono">{c.idNo}</td>
                                        <td className="p-4 text-xs text-gray-500">{c.location}</td>
                                        <td className="p-4 text-center font-bold">{c.totalShipments}</td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={(e) => handleEditCustomerClick(e, c)}
                                                className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-100 font-bold text-xs"
                                            >
                                                Edit Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Edit Customer Modal */}
                {editingCustomer && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded shadow-lg w-96">
                            <h3 className="font-bold text-lg mb-4 text-blue-900">Edit Customer Details</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Name</label>
                                    <input className="w-full border p-2 rounded" value={editCustomerForm.name} onChange={e => setEditCustomerForm({ ...editCustomerForm, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Mobile</label>
                                    <input className="w-full border p-2 rounded" value={editCustomerForm.mobile} onChange={e => setEditCustomerForm({ ...editCustomerForm, mobile: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">ID No</label>
                                    <input className="w-full border p-2 rounded" value={editCustomerForm.idNo} onChange={e => setEditCustomerForm({ ...editCustomerForm, idNo: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button onClick={() => setEditingCustomer(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                <button onClick={handleSaveCustomerDetails} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Update All Records</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );

    const renderCustomerDetail = () => {
        if (!selectedCustomer) return null;
        const customerInvoices = allNetworkInvoices.filter(inv => {
            const shipper = inv.shipper;
            const identityKey = shipper.idNo && shipper.idNo.length > 3 ? `ID:${shipper.idNo}` : `NM:${shipper.name.trim().toLowerCase()}|${shipper.tel}`;
            const key = `${identityKey}_${inv._companyId}`;
            return key === selectedCustomer.key;
        });

        return (
            <div className="min-h-screen bg-gray-50">
                {renderHeader()}
                {renderSidebar()}
                <main className="max-w-6xl mx-auto p-6">
                    <div className="flex items-center gap-4 mb-6">
                        <button onClick={() => updateView('CUSTOMERS')} className="text-gray-500 hover:text-gray-700">&larr; Back</button>
                        <h2 className="text-2xl font-bold text-gray-800">{selectedCustomer.name}</h2>
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">{selectedCustomer.location}</span>
                    </div>

                    <div className="bg-white p-6 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold">Mobile</span>
                            <div className="text-lg font-medium">{selectedCustomer.mobile}</div>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold">ID Number</span>
                            <div className="text-lg font-mono">{selectedCustomer.idNo}</div>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold">Total Shipments</span>
                            <div className="text-lg font-bold text-blue-900">{selectedCustomer.totalShipments}</div>
                        </div>
                    </div>

                    <div className="bg-white rounded shadow overflow-hidden">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-bold text-gray-700">Shipment History</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Invoice #</th>
                                        <th className="p-4">Consignee</th>
                                        <th className="p-4">Amount</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customerInvoices.map((inv, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="p-4">{inv.date}</td>
                                            <td className="p-4 font-mono font-bold text-blue-800">{inv.invoiceNo}</td>
                                            <td className="p-4">{inv.consignee.name}</td>
                                            <td className="p-4 font-bold">SAR {inv.financials.netTotal.toFixed(2)}</td>
                                            <td className="p-4"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{inv.status}</span></td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => { setCurrentInvoice(inv); updateView('PREVIEW_INVOICE'); }} className="text-blue-600 font-bold hover:underline">View</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        );
    };

    const handleBulkStatusUpdate = () => {
        if (!activeCompanyId || selectedInvoiceNos.length === 0 || !targetBulkStatus) return;

        setCompanies((prev: Company[]) => prev.map((c: Company) => {
            if (c.id === activeCompanyId) {
                const updatedInvoices = c.invoices.map((inv: InvoiceData) => {
                    if (selectedInvoiceNos.includes(inv.invoiceNo)) {
                        const newHistoryItem: StatusHistoryItem = {
                            status: targetBulkStatus,
                            timestamp: new Date().toISOString(),
                            remark: bulkStatusRemark || 'Bulk updated'
                        };
                        return {
                            ...inv,
                            status: targetBulkStatus,
                            statusHistory: [...(inv.statusHistory || []), newHistoryItem]
                        };
                    }
                    return inv;
                });
                return { ...c, invoices: updatedInvoices };
            }
            return c;
        }));

        setIsBulkModalOpen(false);
        setSelectedInvoiceNos([]);
        setBulkStatusRemark('');
        updateView('INVOICES');
    };

    const renderBulkStatusModal = () => {
        if (!isBulkModalOpen) return null;

        const currentSettings = activeCompany?.settings.shipmentStatusSettings || DEFAULT_SHIPMENT_STATUS_SETTINGS;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
                    <div className="bg-blue-900 p-6 text-white bg-gradient-to-br from-blue-900 to-blue-800 text-center">
                        <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                            🔄 Modify Status
                        </h3>
                        <p className="text-blue-200 text-[10px] mt-1 uppercase tracking-widest font-bold">Confirmation Required</p>
                    </div>

                    <div className="p-8 space-y-6">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block text-center">Updating {selectedInvoiceNos.length} Items</label>
                            <div className="max-h-24 overflow-y-auto mb-4 bg-gray-50 p-2 rounded border border-gray-100 flex flex-wrap gap-2 justify-center">
                                {selectedInvoiceNos.map((no: string) => (
                                    <span key={no} className="bg-white border border-gray-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-blue-900 shadow-sm">{no}</span>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">New Status</label>
                            <select
                                value={targetBulkStatus}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTargetBulkStatus(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-900 focus:bg-white transition-all font-bold text-gray-700 appearance-none text-sm"
                            >
                                {currentSettings.map((s: ShipmentStatusSetting) => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Remark (Optional)</label>
                            <textarea
                                value={bulkStatusRemark}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBulkStatusRemark(e.target.value)}
                                placeholder="Enter reason or details..."
                                className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-900 focus:bg-white transition-all h-24 text-sm font-medium"
                            />
                        </div>

                        <div className="flex gap-4 pt-2">
                            <button
                                onClick={() => setIsBulkModalOpen(false)}
                                className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-400 hover:bg-gray-100 transition-colors uppercase tracking-widest text-[10px]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkStatusUpdate}
                                className="flex-1 bg-blue-900 text-white px-6 py-3 rounded-xl shadow-xl hover:bg-blue-800 transition-all font-bold uppercase tracking-widest text-[10px]"
                            >
                                Confirm Update
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderBulkStatusChangeView = () => (
        <div className="min-h-screen bg-gray-50">
            {renderHeader()}
            {renderSidebar()}
            {renderBulkStatusModal()}
            <main className="max-w-7xl mx-auto p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Modify Status</h2>
                        <p className="text-xs text-gray-500 font-medium">Batch process shipments and update trackers.</p>
                    </div>
                    <div className="flex gap-3">
                        {selectedInvoiceNos.length > 0 && (
                            <button
                                onClick={() => {
                                    setTargetBulkStatus(activeCompany?.settings.shipmentStatusSettings?.[0]?.name || 'Received');
                                    setBulkStatusRemark('');
                                    setIsBulkModalOpen(true);
                                }}
                                className="bg-blue-900 text-white px-5 py-2.5 rounded-xl shadow-lg hover:bg-blue-800 font-bold transition-all transform hover:scale-105 flex items-center gap-2"
                            >
                                <span>Update {selectedInvoiceNos.length} Items</span>
                                <span className="text-blue-300">→</span>
                            </button>
                        )}
                        <button onClick={() => updateView('DASHBOARD')} className="bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl shadow-sm hover:bg-gray-50 font-bold transition-all">Back</button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                    {renderFilterBar()}
                </div>

                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-600 text-sm">
                                <tr>
                                    <th className="p-4 w-12 text-center border-b">
                                        <input
                                            type="checkbox"
                                            checked={selectedInvoiceNos.length === filteredInvoices.length && filteredInvoices.length > 0}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                if (e.target.checked) {
                                                    setSelectedInvoiceNos(filteredInvoices.map((inv: DashboardInvoice) => inv.invoiceNo));
                                                } else {
                                                    setSelectedInvoiceNos([]);
                                                }
                                            }}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-900 focus:ring-blue-900"
                                        />
                                    </th>
                                    <th className="p-4 border-b">Date</th>
                                    <th className="p-4 border-b">Invoice #</th>
                                    <th className="p-4 border-b">Shipper</th>
                                    <th className="p-4 border-b text-right">Net Total</th>
                                    <th className="p-4 border-b">Current Status</th>
                                    <th className="p-4 border-b">Last Update</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredInvoices.map((inv) => (
                                    <tr key={inv.invoiceNo} className={`hover:bg-blue-50/50 transition-colors ${selectedInvoiceNos.includes(inv.invoiceNo) ? 'bg-blue-50/50' : ''}`}>
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedInvoiceNos.includes(inv.invoiceNo)}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    if (e.target.checked) {
                                                        setSelectedInvoiceNos([...selectedInvoiceNos, inv.invoiceNo]);
                                                    } else {
                                                        setSelectedInvoiceNos(selectedInvoiceNos.filter((no: string) => no !== inv.invoiceNo));
                                                    }
                                                }}
                                                className="h-4 w-4 rounded border-gray-300 text-blue-900 focus:ring-blue-900"
                                            />
                                        </td>
                                        <td className="p-4 border-b text-gray-500">{inv.date}</td>
                                        <td className="p-4 border-b font-mono font-bold text-blue-900">{inv.invoiceNo}</td>
                                        <td className="p-4 border-b">
                                            <div className="font-bold text-gray-800">{inv.shipper.name}</div>
                                            <div className="text-[10px] text-gray-400 font-mono tracking-tighter">{inv.shipper.tel}</div>
                                        </td>
                                        <td className="p-4 border-b text-right font-bold text-gray-900">SAR {inv.financials.netTotal.toFixed(2)}</td>
                                        <td className="p-4 border-b">
                                            <span className={`px-2 py-0.5 rounded-[4px] text-[9px] uppercase font-black tracking-widest ${getStatusBadgeStyles(inv.status || 'Received')}`}>
                                                {inv.status || 'Received'}
                                            </span>
                                        </td>
                                        <td className="p-4 border-b">
                                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                                                {(inv.statusHistory && inv.statusHistory.length > 0) ? inv.statusHistory[inv.statusHistory.length - 1].timestamp.split('T')[0] : 'N/A'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredInvoices.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-gray-400 font-medium italic">
                                            <div className="text-4xl mb-2 opacity-20">📂</div>
                                            No invoices found for the current filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );

    const renderFinanceView = () => (
        <div className="min-h-screen bg-gray-50">
            {renderHeader()}
            {renderSidebar()}
            <main className="max-w-7xl mx-auto p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Financial Accounts</h2>
                    <button onClick={() => setIsAddTransactionOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 font-bold">
                        + Add Expense / Revenue
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Summary Cards */}
                    <div className="bg-white p-6 rounded shadow border-l-4 border-green-500">
                        <span className="text-gray-500 text-sm font-bold uppercase">Total Revenue</span>
                        <div className="text-2xl font-bold text-green-700 mt-1">SAR {stats.totalRevenue.toFixed(2)}</div>
                    </div>
                    <div className="bg-white p-6 rounded shadow border-l-4 border-red-500">
                        <span className="text-gray-500 text-sm font-bold uppercase">Total Expenses</span>
                        <div className="text-2xl font-bold text-red-700 mt-1">
                            SAR {stats.totalExpenses.toFixed(2)}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded shadow border-l-4 border-blue-500">
                        <span className="text-gray-500 text-sm font-bold uppercase">Net Profit</span>
                        <div className="text-2xl font-bold text-blue-900 mt-1">
                            SAR {(stats.totalRevenue - stats.totalExpenses).toFixed(2)}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded shadow overflow-hidden">
                    <div className="px-6 py-4 border-b flex justify-between items-center">
                        <h3 className="font-bold text-gray-700">Recent Transactions</h3>
                        <div className="text-sm text-gray-500">
                            Cash: <span className="font-bold text-black">{stats.cashInHand.toFixed(2)}</span> | Bank: <span className="font-bold text-black">{stats.bankBalance.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 text-gray-600 font-bold">
                                <tr>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Description</th>
                                    <th className="p-4">Account</th>
                                    <th className="p-4">Mode</th>
                                    <th className="p-4 text-right">Amount (SAR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(activeCompany?.financialTransactions || []).slice(0, 50).map((tx) => (
                                    <tr key={tx.id} className="border-b hover:bg-gray-50">
                                        <td className="p-4">{tx.date}</td>
                                        <td className="p-4 font-medium">{tx.description}</td>
                                        <td className="p-4 text-gray-500 text-xs uppercase">
                                            {(activeCompany?.financialAccounts.find(a => a.id === tx.accountId)?.name) || tx.accountId}
                                        </td>
                                        <td className="p-4"><span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs">{tx.paymentMode || 'CASH'}</span></td>
                                        <td className={`p-4 text-right font-bold ${tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {isAddTransactionOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded shadow-lg w-96">
                        <h3 className="font-bold text-lg mb-4">Add Transaction</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500">Type</label>
                                <div className="flex gap-2 mt-1">
                                    <button onClick={() => setNewTransaction({ ...newTransaction, type: 'INCOME' })} className={`flex-1 py-1 rounded border ${newTransaction.type === 'INCOME' ? 'bg-green-100 border-green-500 text-green-700 font-bold' : 'bg-gray-50'}`}>Income</button>
                                    <button onClick={() => setNewTransaction({ ...newTransaction, type: 'EXPENSE' })} className={`flex-1 py-1 rounded border ${newTransaction.type === 'EXPENSE' ? 'bg-red-100 border-red-500 text-red-700 font-bold' : 'bg-gray-50'}`}>Expense</button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">Date</label>
                                <input type="date" className="w-full border p-2 rounded" value={newTransaction.date} onChange={e => setNewTransaction({ ...newTransaction, date: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">Account</label>
                                <select className="w-full border p-2 rounded" value={newTransaction.accountId} onChange={e => setNewTransaction({ ...newTransaction, accountId: e.target.value })}>
                                    <option value="">Select Account</option>
                                    {activeCompany?.financialAccounts.filter(a => newTransaction.type === 'INCOME' ? a.type === 'REVENUE' : a.type === 'EXPENSE').map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">Amount</label>
                                <input type="number" className="w-full border p-2 rounded" value={newTransaction.amount} onChange={e => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">Description</label>
                                <input type="text" className="w-full border p-2 rounded" value={newTransaction.description} onChange={e => setNewTransaction({ ...newTransaction, description: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">Payment Mode</label>
                                <select className="w-full border p-2 rounded" value={newTransaction.paymentMode} onChange={e => setNewTransaction({ ...newTransaction, paymentMode: e.target.value as any })}>
                                    <option value="CASH">Cash</option>
                                    <option value="BANK">Bank Transfer / Card</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setIsAddTransactionOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={handleSaveTransaction} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Save Transaction</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderCompanyForm = () => {
        return (
            <div className="bg-white p-6 rounded shadow border-t-4 border-blue-900 animate-fade-in">
                <div className="flex justify-between items-center mb-6 border-b pb-2">
                    <h3 className="text-xl font-bold text-gray-800">
                        {editingCompanyId ? `Edit Branch: ${newCompany.settings.companyName}` : 'Create New Branch'}
                    </h3>
                    <button onClick={handleCancelEdit} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded font-bold">Cancel</button>
                </div>

                <div className="space-y-6">
                    {/* Section 1: Authentication */}
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 text-center tracking-widest">Login Security</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Username</label>
                                <input
                                    className={`w-full border p-2 rounded font-mono text-xs ${editingCompanyId ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                                    type="text"
                                    value={newCompany.username || ''}
                                    onChange={e => !editingCompanyId && setNewCompany({ ...newCompany, username: e.target.value })}
                                    readOnly={!!editingCompanyId}
                                    placeholder="Enter username"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Password</label>
                                <input className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none transition-all" type="text" value={newCompany.password || ''} onChange={e => setNewCompany({ ...newCompany, password: e.target.value })} placeholder="Enter password" />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Branding (Logo & Color) */}
                    <div className="bg-white p-4 rounded border border-gray-100 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 text-center tracking-widest">Branding & Identity</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Company logo</label>
                                <p className="text-[10px] text-gray-400 mb-2 uppercase font-medium">Recommended: 400x400px • Max 500KB</p>
                                <div className="flex items-center gap-3">
                                    {newCompany.settings?.logoUrl && (
                                        <div className="w-16 h-16 border-2 border-blue-50 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                            <img src={newCompany.settings.logoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                                        </div>
                                    )}
                                    <label className="flex-1 border-2 border-dashed border-blue-100 rounded-xl p-4 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all text-center group">
                                        <div className="flex flex-col items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mb-1 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest">
                                                {newCompany.settings?.logoUrl ? 'Change logo' : 'Upload PNG/JPG'}
                                            </span>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                        />
                                    </label>
                                    {newCompany.settings?.logoUrl && (
                                        <button
                                            onClick={() => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, logoUrl: '' } })}
                                            className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm"
                                            title="Remove Logo"
                                        >×</button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Brand Theme Color</label>
                                <p className="text-[10px] text-gray-400 mb-2 uppercase font-medium">Applied to Invoices & Buttons</p>
                                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <input
                                        className="h-10 w-20 border-0 rounded cursor-pointer bg-transparent"
                                        type="color"
                                        value={newCompany.settings?.brandColor || DEFAULT_BRAND_COLOR}
                                        onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, brandColor: e.target.value } })}
                                    />
                                    <div className="flex-1">
                                        <div className="text-[10px] font-mono font-bold text-gray-500 uppercase">{newCompany.settings?.brandColor || DEFAULT_BRAND_COLOR}</div>
                                        <div className="text-[9px] text-gray-400">Selected hex code</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {view === 'ADMIN_COMPANY_FORM' && (
                        <>
                            {/* Section 3: Company Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Company Name (English)</label>
                                    <input className="w-full border p-2 rounded" type="text" value={newCompany.settings?.companyName || ''} onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, companyName: e.target.value } })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Company Name (Arabic)</label>
                                    <input className="w-full border p-2 rounded text-right" type="text" value={newCompany.settings?.companyArabicName || ''} onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, companyArabicName: e.target.value } })} />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Location Name (e.g. Riyadh Branch)</label>
                                    <input className="w-full border p-2 rounded" type="text" value={newCompany.settings?.location || ''} onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, location: e.target.value } })} placeholder="City or Branch Name" />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Address Line 1</label>
                                    <input className="w-full border p-2 rounded mb-2" type="text" value={newCompany.settings?.addressLine1 || ''} onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, addressLine1: e.target.value } })} placeholder="English Address" />
                                    <input className="w-full border p-2 rounded text-right" type="text" value={newCompany.settings?.addressLine1Arabic || ''} onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, addressLine1Arabic: e.target.value } })} placeholder="العنوان بالعربي" />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Phone 1</label>
                                    <input className="w-full border p-2 rounded" type="text" value={newCompany.settings?.phone1 || ''} onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, phone1: e.target.value } })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Phone 2</label>
                                    <input className="w-full border p-2 rounded" type="text" value={newCompany.settings?.phone2 || ''} onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, phone2: e.target.value } })} />
                                </div>
                            </div>

                            {/* Section 4: Invoice Configuration */}
                            <div className="bg-blue-50 p-4 rounded border border-blue-100">
                                <h3 className="text-sm font-bold text-blue-800 uppercase mb-3 text-center tracking-widest">Invoice Configuration</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Prefix (e.g. RUH-)</label>
                                        <input className="w-full border p-2 rounded" type="text" value={newCompany.settings?.invoicePrefix || ''} onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, invoicePrefix: e.target.value } })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Start Number</label>
                                        <input className="w-full border p-2 rounded" type="number" value={newCompany.settings?.invoiceStartNumber || 1000} onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, invoiceStartNumber: parseInt(e.target.value) } })} />
                                    </div>
                                    <div className="bg-white p-2 rounded border border-blue-200">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Legacy Brand Color</label>
                                        <input className="w-full h-8 border rounded cursor-pointer" type="color" value={newCompany.settings?.brandColor || DEFAULT_BRAND_COLOR} onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, brandColor: e.target.value } })} />
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">VAT / Tax Number</label>
                                        <input className="w-full border p-2 rounded" type="text" value={newCompany.settings?.vatnoc || ''} onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, vatnoc: e.target.value } })} />
                                    </div>
                                    <div className="flex items-center pt-5">
                                        <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 border rounded shadow-sm">
                                            <input type="checkbox" checked={newCompany.settings?.isVatEnabled || false} onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, isVatEnabled: e.target.checked } })} className="w-4 h-4 text-blue-600" />
                                            <span className="text-sm font-bold text-gray-700">Enable VAT (15%)</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Section 5: Shipment Types */}
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 text-center tracking-widest">Shipment Types</h3>
                                <div className="flex gap-2 mb-3">
                                    <input className="flex-1 border p-2 rounded text-sm" placeholder="Type Name (e.g. AIR CARGO)" value={tempShipmentName} onChange={e => setTempShipmentName(e.target.value)} />
                                    <input className="w-24 border p-2 rounded text-sm" type="number" placeholder="Rate" value={tempShipmentValue} onChange={e => setTempShipmentValue(e.target.value)} />
                                    <button onClick={addShipmentType} className="bg-green-600 text-white px-4 rounded font-bold hover:bg-green-700">+</button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(newCompany.settings?.shipmentTypes || []).map((type, idx) => (
                                        <span key={idx} className="bg-white border border-gray-300 px-3 py-1 rounded-full text-sm flex items-center gap-2 shadow-sm">
                                            <span className="font-bold text-gray-700">{type.name}</span>
                                            <span className="text-blue-600 font-mono">{type.value}</span>
                                            <button onClick={() => removeShipmentType(idx)} className="text-red-500 hover:text-red-700 font-bold ml-1">&times;</button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Section 6: Legal Terms (Footer) */}
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 text-center tracking-widest">Legal Terms (Footer)</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">T&C Header</label>
                                        <input
                                            className="w-full border p-2 rounded text-sm"
                                            type="text"
                                            value={newCompany.settings?.tcHeader || ''}
                                            onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, tcHeader: e.target.value } })}
                                            placeholder="e.g. Terms and Conditions Apply"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">English Terms</label>
                                            <textarea
                                                className="w-full border p-2 rounded text-xs h-24"
                                                value={newCompany.settings?.tcEnglish || ''}
                                                onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, tcEnglish: e.target.value } })}
                                                placeholder="Terms in English..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1 text-right">Arabic Terms</label>
                                            <textarea
                                                className="w-full border p-2 rounded text-xs h-24 text-right"
                                                dir="rtl"
                                                value={newCompany.settings?.tcArabic || ''}
                                                onChange={e => setNewCompany({ ...newCompany, settings: { ...newCompany.settings, tcArabic: e.target.value } })}
                                                placeholder="الشروط والأحكام بالعربية..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 7: Status Workflow Management */}
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 text-center tracking-widest">Status Workflow Management</h3>
                                <p className="text-[10px] text-gray-400 mb-4 text-center uppercase tracking-widest font-bold">Add, Remove or Drag to Reorder Statuses</p>

                                <div className="flex gap-2 mb-4">
                                    <input
                                        className="flex-1 border p-2 rounded text-sm"
                                        placeholder="New Status Name (e.g. AT WAREHOUSE)"
                                        value={tempStatusName}
                                        onChange={e => setTempStatusName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addShipmentStatus()}
                                    />
                                    <button onClick={addShipmentStatus} className="bg-blue-600 text-white px-6 rounded font-bold hover:bg-blue-700 shadow-sm">+</button>
                                </div>

                                <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                    {(newCompany.settings?.shipmentStatusSettings || DEFAULT_SHIPMENT_STATUS_SETTINGS).map((status, idx) => (
                                        <div
                                            key={status.id}
                                            draggable
                                            onDragStart={(e) => handleStatusDragStart(e, idx)}
                                            onDragOver={(e) => handleStatusDragOver(e, idx)}
                                            onDrop={(e) => handleStatusDrop(e, idx)}
                                            className={`bg-white border rounded-xl p-3 flex items-center gap-3 group transition-all hover:border-blue-300 hover:shadow-sm cursor-move ${draggedStatusIndex === idx ? 'opacity-50 ring-2 ring-blue-500' : ''}`}
                                        >
                                            <div className="text-gray-300 group-hover:text-blue-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <div className="bg-blue-50 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-600 shrink-0">
                                                {idx + 1}
                                            </div>
                                            <input
                                                className="flex-1 font-bold text-gray-700 border-none p-0 focus:ring-0 text-sm bg-transparent"
                                                value={status.name}
                                                onChange={(e) => handleStatusNameChange(idx, e.target.value)}
                                            />
                                            <button
                                                onClick={() => removeShipmentStatus(idx)}
                                                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                title="Delete Status"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    <button onClick={handleSaveCompany} className="w-full bg-blue-800 text-white font-bold py-3 rounded hover:bg-blue-700 transition shadow-lg">
                        Save Changes
                    </button>
                </div>
            </div>
        )
    };

    const renderSuperAdminDashboard = () => {
        return (
            <div className="min-h-screen bg-gray-50">
                {renderHeader()}
                {renderSidebar()}
                <main className="max-w-7xl mx-auto p-4 md:p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h2 className="text-2xl font-bold text-gray-800">Super Admin Dashboard</h2>
                        <button
                            onClick={() => {
                                setEditingCompanyId(null);
                                setNewCompany({ expiryDate: getOneYearFromNow(), parentId: undefined, settings: { shipmentTypes: [], isVatEnabled: false, tcHeader: DEFAULT_TC_HEADER, tcEnglish: DEFAULT_TC_ENGLISH, tcArabic: DEFAULT_TC_ARABIC, brandColor: DEFAULT_BRAND_COLOR, invoicePrefix: '', invoiceStartNumber: 1000, location: '', shipmentStatusSettings: DEFAULT_SHIPMENT_STATUS_SETTINGS } });
                                updateView('ADMIN_COMPANY_FORM');
                            }}
                            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2 font-bold"
                        >
                            + Create New Company
                        </button>
                    </div>

                    {/* Search & Filter Bar */}
                    <div className="bg-white p-4 rounded shadow mb-6 flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-1 w-full">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Search company name, username, location..."
                                className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400 transition-all shadow-sm"
                                value={adminSearchQuery}
                                onChange={(e) => setAdminSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            {(['ALL', 'EXPIRING', 'EXPIRED'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setAdminFilter(f)}
                                    className={`px-4 py-2 rounded text-xs font-bold transition-all ${adminFilter === f
                                        ? 'bg-blue-900 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAdminCompanies.map(company => (
                            <div key={company.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition group relative">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900">{company.settings.companyName}</h3>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider">{company.settings.location || 'Main Office'}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${new Date(company.expiryDate) < new Date() ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                        {new Date(company.expiryDate) < new Date() ? 'Expired' : 'Active'}
                                    </span>
                                </div>

                                <div className="space-y-2 mb-6">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Username:</span>
                                        <span className="font-mono">{company.username}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Invoices:</span>
                                        <span className="font-bold">{company.invoices.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm border-t pt-2">
                                        <span className="text-gray-500">Expiry:</span>
                                        <span className={`font-medium ${new Date(company.expiryDate) < new Date() ? 'text-red-600' : 'text-gray-700'}`}>
                                            {new Date(company.expiryDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2 border-t pt-4">
                                    <button
                                        onClick={() => {
                                            handleEditCompany(company);
                                            updateView('ADMIN_COMPANY_FORM');
                                        }}
                                        className="flex-1 bg-gray-100 hover:bg-blue-600 hover:text-white py-2 rounded text-xs font-bold transition-all text-gray-600"
                                    >
                                        Edit Settings
                                    </button>
                                    <button
                                        onClick={() => {
                                            setActiveCompanyId(company.id);
                                            updateView('DASHBOARD');
                                        }}
                                        className="flex-1 bg-blue-900 text-white py-2 rounded text-xs font-bold hover:bg-blue-800 transition-all"
                                    >
                                        Login as User
                                    </button>
                                </div>
                            </div>
                        ))}
                        {filteredAdminCompanies.length === 0 && (
                            <div className="col-span-full py-12 text-center bg-white rounded border border-dashed text-gray-400">
                                No companies found matching your criteria.
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    };

    const renderBranchManagement = () => {
        // Determine HQ and Branches
        const hq = relatedCompanies.find(c => !c.parentId);
        const branches = relatedCompanies.filter(c => c.parentId === hq?.id);
        const isHQAdmin = activeCompany && !activeCompany.parentId;

        return (
            <div className="min-h-screen bg-gray-50 uppercase">
                {renderHeader()}
                {renderSidebar()}
                <main className="max-w-7xl mx-auto p-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Branch Management</h2>

                    {branchManagementMode === 'EDIT' ? (
                        renderCompanyForm()
                    ) : (
                        <div className="space-y-8 animate-fade-in">
                            {/* Head Office Section */}
                            {hq && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-wide">HEAD OFFICE</h3>
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center relative group">
                                        <div>
                                            <h4 className="text-xl font-black text-gray-900 uppercase">{hq.settings.companyName} ({hq.settings.location || 'HQ'})</h4>
                                            <p className="text-sm text-gray-500 mt-1 uppercase font-semibold">{hq.settings.addressLine1} {hq.settings.addressLine2 ? `, ${hq.settings.addressLine2}` : ''}</p>
                                            <p className="text-sm text-gray-500 mt-1 uppercase">Phone: {hq.settings.phone1}</p>
                                        </div>
                                        <div className="mt-4 md:mt-0 flex flex-col items-end gap-2">
                                            <div className="flex gap-2">
                                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">HEADQUARTERS</span>
                                                <span className={`${activeCompany?.id === hq.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider`}>
                                                    {activeCompany?.id === hq.id ? 'Active (You)' : 'Active'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 lowercase italic">User: {hq.username}</p>
                                        </div>

                                        <button
                                            onClick={() => handleBranchEditClick(hq)}
                                            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 hover:bg-gray-200 p-2 rounded text-gray-600"
                                            title="Edit Settings"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Network Branches Section */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-wide">NETWORK BRANCHES ({branches.length})</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {branches.map(branch => {
                                        const isActive = activeCompany?.id === branch.id;
                                        return (
                                            <div key={branch.id} className={`bg-white rounded-lg shadow-sm border p-6 flex flex-col h-full relative group hover:shadow-md transition ${isActive ? 'border-green-500 ring-4 ring-green-50/50' : 'border-gray-100'}`}>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="text-lg font-bold text-gray-900 uppercase leading-tight">{branch.settings.companyName} ({branch.settings.location})</h4>
                                                        {isActive && (
                                                            <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                                                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                                                You
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-500 font-bold uppercase mb-4 tracking-tight">{branch.settings.location}</p>
                                                    <p className="text-sm text-gray-500 flex items-center gap-2 font-medium">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                        </svg>
                                                        {branch.settings.phone1}
                                                    </p>
                                                </div>

                                                <div className="mt-6 border-t pt-4 flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 lowercase italic">Used By: <span className="font-mono font-bold text-gray-700">{branch.username}</span></span>
                                                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-[10px] font-black uppercase border border-gray-200">Branch</span>
                                                </div>

                                                {(isHQAdmin || isActive) && (
                                                    <button
                                                        onClick={() => handleBranchEditClick(branch)}
                                                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 hover:bg-gray-200 p-2 rounded text-gray-600 shadow-sm"
                                                        title="Edit Settings"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {branches.length === 0 && (
                                        <div className="col-span-full py-12 text-center bg-white rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm font-bold uppercase tracking-widest">
                                            No Network Branches Found
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 flex-col gap-4">
                <div className="w-12 h-12 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-600 font-medium">Connecting to System...</p>
            </div>
        );
    }

    if (view === 'ITEMS' && activeCompany) {
        return renderItems();
    }

    if (view === 'CUSTOMERS' && activeCompany) {
        return renderCustomers();
    }

    if (view === 'CUSTOMER_DETAIL' && activeCompany) {
        return renderCustomerDetail();
    }

    if (view === 'FINANCE' && activeCompany) {
        return renderFinanceView();
    }

    if (view === 'BRANCH_MANAGEMENT' && activeCompany) {
        return renderBranchManagement();
    }

    if (view === 'SHIPMENT_TYPES' && activeCompany) {
        return renderShipmentTypes();
    }

    if (view === 'BULK_STATUS_CHANGE' && activeCompany) {
        return renderBulkStatusChangeView();
    }

    if (view === 'DASHBOARD' && activeCompany) {
        // Dynamically load statuses
        const companyStatuses = activeCompany.settings.shipmentStatusSettings || DEFAULT_SHIPMENT_STATUS_SETTINGS;
        // Ensure they are sorted by 'order'
        companyStatuses.sort((a, b) => a.order - b.order);

        return (
            <div className="min-h-screen bg-gray-50">
                {renderHeader()}
                {renderSidebar()}
                {renderHistoryModal()}

                <main className="max-w-7xl mx-auto p-4 md:p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={handleCreateInvoice}
                                className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2 justify-center flex-1 md:flex-none"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                New Invoice
                            </button>
                        </div>
                    </div>

                    {renderFilterBar()}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white p-6 rounded shadow-sm border-l-4 border-blue-500">
                            <div className="text-gray-500 text-sm">Shipments ({getRangeLabel()})</div>
                            <div className="text-3xl font-bold text-gray-800">{stats.totalShipments}</div>
                        </div>
                        <div className="bg-white p-6 rounded shadow-sm border-l-4 border-green-500">
                            <div className="text-gray-500 text-sm">Revenue ({getRangeLabel()})</div>
                            <div className="text-3xl font-bold text-gray-800">SAR {stats.totalRevenue.toFixed(2)}</div>
                        </div>
                        <div className="bg-white p-6 rounded shadow-sm border-l-4 border-purple-500">
                            <div className="text-gray-500 text-sm">Cash in Hand</div>
                            <div className="text-3xl font-bold text-gray-800">SAR {allTimeStats.cashInHand.toFixed(2)}</div>
                        </div>
                        <div className="bg-white p-6 rounded shadow-sm border-l-4 border-teal-500">
                            <div className="text-gray-500 text-sm">Bank Balance</div>
                            <div className="text-3xl font-bold text-gray-800">SAR {allTimeStats.bankBalance.toFixed(2)}</div>
                        </div>
                    </div>

                    <h3 className="font-bold text-gray-700 mb-4 text-lg">Shipment Status Overview</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {companyStatuses.map(statusSetting => (
                            <div key={statusSetting.id} className="bg-white p-4 rounded shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center hover:shadow-md transition">
                                <div className="text-2xl font-bold text-blue-900">{allTimeStatusCounts[statusSetting.name] || 0}</div>
                                <div className="text-xs text-gray-500 font-medium">{statusSetting.name}</div>
                            </div>
                        ))}
                    </div>

                    <h3 className="font-bold text-gray-700 mb-4 text-lg">Recent Activity (Last 10 Shipments)</h3>
                    <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-100">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="p-3">Invoice #</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Customer</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Amount</th>
                                        <th className="p-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {latest10Invoices.map((inv, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="p-3 font-mono font-bold text-blue-800">{inv.invoiceNo}</td>
                                            <td className="p-3 text-gray-600">{inv.date}</td>
                                            <td className="p-3 font-medium text-gray-900">{inv.shipper.name || 'Unknown'}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-[4px] text-[9px] uppercase font-black tracking-widest ${getStatusBadgeStyles(inv.status || 'Received')}`}>
                                                    {inv.status || 'Received'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-bold text-gray-700">SAR {inv.financials.netTotal.toFixed(2)}</td>
                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={() => {
                                                        setCurrentInvoice(inv);
                                                        updateView('PREVIEW_INVOICE');
                                                    }}
                                                    className="text-gray-500 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-all group"
                                                    title="Print Invoice"
                                                >
                                                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {latest10Invoices.length === 0 && (
                                        <tr><td colSpan={6} className="p-4 text-center text-gray-400">No activity found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {latest10Invoices.length > 0 && (
                            <div className="p-3 bg-gray-50 text-center border-t">
                                <button onClick={() => updateView('INVOICES')} className="text-blue-600 text-xs font-bold hover:underline">View All Invoices &rarr;</button>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    // ... rest of invoice and login views ...
    // Reuse existing render logic for other views
    if (view === 'INVOICES' && activeCompany) {
        // Copy the exact return from the original file for INVOICES
        return (
            <div className="min-h-screen bg-gray-50">
                {renderHeader()}
                {renderSidebar()}
                {renderHistoryModal()}

                <main className="max-w-7xl mx-auto p-4 md:p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h2 className="text-2xl font-bold text-gray-800">Invoices</h2>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={handleCreateInvoice}
                                className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2 justify-center flex-1 md:flex-none"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                New Invoice
                            </button>
                        </div>
                    </div>

                    {renderFilterBar()}

                    <div className="bg-white rounded shadow overflow-hidden">
                        <div className="px-6 py-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-700">Invoices List</h3>
                            <span className="text-xs text-gray-500">Showing {filteredInvoices.length} results</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-600 text-sm">
                                        <th className="p-4 border-b">Invoice #</th>
                                        <th className="p-4 border-b">Location</th>
                                        <th className="p-4 border-b">Date</th>
                                        <th className="p-4 border-b">Shipper Name</th>
                                        <th className="p-4 border-b">Mobile</th>
                                        <th className="p-4 border-b">Amount</th>
                                        <th className="p-4 border-b">Status</th>
                                        <th className="p-4 border-b">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm text-gray-700">
                                    {filteredInvoices.length > 0 ? (
                                        filteredInvoices.map((inv, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="p-4 border-b font-mono font-bold text-blue-900">{inv.invoiceNo}</td>
                                                <td className="p-4 border-b text-xs text-gray-500">
                                                    {inv._locationName}
                                                </td>
                                                <td className="p-4 border-b">{inv.date}</td>
                                                <td className="p-4 border-b font-medium">{inv.shipper.name}</td>
                                                <td className="p-4 border-b text-gray-500">{inv.shipper.tel}</td>
                                                <td className="p-4 border-b font-bold">SAR {inv.financials.netTotal.toFixed(2)}</td>
                                                <td className="p-4 border-b">
                                                    <button
                                                        onClick={() => setViewingHistoryInvoice(inv)}
                                                        className={`px-3 py-1 rounded-[4px] text-[10px] uppercase font-bold hover:opacity-80 transition shadow-sm ${getStatusBadgeStyles(inv.status || 'Received')}`}
                                                        title="Click to view history"
                                                    >
                                                        {inv.status || 'Received'}
                                                    </button>
                                                </td>
                                                <td className="p-4 border-b">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleEditInvoice(inv)}
                                                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition"
                                                            title="Edit"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setCurrentInvoice(inv);
                                                                updateView('PREVIEW_INVOICE');
                                                            }}
                                                            className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-100 transition"
                                                            title="Print / View"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-gray-500">
                                                No invoices found matching your criteria.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (view === 'CREATE_INVOICE' && currentInvoice) {
        return (
            <div className="min-h-screen bg-gray-100 pb-12">
                <nav className="bg-blue-900 text-gray-200 p-4 shadow-lg mb-4">
                    <div className="max-w-6xl mx-auto flex items-center gap-4">
                        <button onClick={() => updateView('DASHBOARD')} className="hover:text-white">&larr; Back</button>
                        <h1 className="text-lg font-bold">Create Invoice</h1>
                    </div>
                </nav>
                <InvoiceForm
                    initialData={currentInvoice}
                    onSubmit={handleInvoiceSubmit}
                    onCancel={() => updateView('DASHBOARD')}
                    shipmentTypes={activeCompany?.settings.shipmentTypes || []}
                    history={allNetworkInvoices}
                    isVatEnabled={activeCompany?.settings.isVatEnabled || false}
                    savedItems={activeCompany?.items || []}
                    savedCustomers={[]}
                />
            </div>
        );
    }

    if (view === 'PREVIEW_INVOICE' && currentInvoice && activeCompany) {
        const ownerCompany = companies.find(c => c.invoices.some(inv => inv.invoiceNo === currentInvoice.invoiceNo)) || activeCompany;

        return (
            <InvoicePreview
                data={currentInvoice}
                settings={ownerCompany.settings}
                onBack={() => updateView('DASHBOARD')}
            />
        );
    }

    if (view === 'SETTINGS' && isSuperAdmin) {
        return renderSuperAdminDashboard();
    }

    if (view === 'ADMIN_COMPANY_FORM' && isSuperAdmin) {
        return (
            <div className="min-h-screen bg-gray-50">
                {renderHeader()}
                {renderSidebar()}
                <main className="max-w-4xl mx-auto p-6">
                    <div className="mb-6 flex items-center gap-4">
                        <button onClick={() => updateView('SETTINGS')} className="text-gray-500 hover:text-black font-bold text-sm flex items-center gap-1">
                            &larr; Back to Dashboard
                        </button>
                    </div>
                    {renderCompanyForm()}
                </main>
            </div>
        );
    }



    if (view === 'LOGIN') {
        return (
            <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-sm">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-black text-blue-900 tracking-tighter uppercase mb-1">Qovoz</h1>
                        <p className="text-gray-500 text-xs tracking-widest uppercase">Logistics Management System</p>
                    </div>

                    {loginError && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-6">
                            <p className="text-red-700 text-xs font-bold">{loginError}</p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-gray-700 text-xs font-bold mb-1 uppercase tracking-wide">Username</label>
                            <input
                                type="text"
                                className="w-full border border-gray-300 bg-gray-50 p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 text-xs font-bold mb-1 uppercase tracking-wide">Password</label>
                            <input
                                type="password"
                                className="w-full border border-gray-300 bg-gray-50 p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                            />
                        </div>

                        <button type="submit" className="w-full bg-blue-900 text-white font-bold py-3 rounded hover:bg-blue-800 transition shadow-lg uppercase tracking-wider">
                            Login
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return null;
};

export default App;
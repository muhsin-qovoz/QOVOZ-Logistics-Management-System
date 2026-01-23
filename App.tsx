
import React, { useState, useMemo, useEffect } from 'react';
import { ViewState, InvoiceData, Company, AppSettings, ShipmentStatus } from './types';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import { getStoredCompanies, saveStoredCompanies, formatDate, getOneYearFromNow, DEFAULT_TC_HEADER, DEFAULT_TC_ENGLISH, DEFAULT_TC_ARABIC, DEFAULT_BRAND_COLOR } from './services/dataService';

const SHIPMENT_STATUSES: ShipmentStatus[] = [
  'Received',
  'Departed from Branch',
  'Received at HO',
  'Loaded into Container',
  'In transit',
  'Arrived at destination',
  'Out for delivery',
  'Delivered'
];

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
  
  // "Backend" Database with LocalStorage persistence via Data Service
  const [companies, setCompanies] = useState<Company[]>(() => getStoredCompanies());

  // Save to local storage whenever companies change
  useEffect(() => {
    saveStoredCompanies(companies);
  }, [companies]);

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

  // Bulk Status Update State
  const [selectedInvoiceNos, setSelectedInvoiceNos] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ShipmentStatus>('Received');

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
        location: ''
    }
  });
  
  // Branch Management State Helpers for Form
  const [isBranch, setIsBranch] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string>('');

  // Temp state for adding shipment types
  const [tempShipmentName, setTempShipmentName] = useState('');
  const [tempShipmentValue, setTempShipmentValue] = useState('');

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

  // --- Handlers ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    // 1. Check Super Admin
    if (username === 'qovoz' && password === '123') {
      setIsSuperAdmin(true);
      setActiveCompanyId(null);
      setView('SETTINGS'); // Admin goes straight to company creation
      return;
    }

    // 2. Check Companies
    const company = companies.find(c => c.username === username && c.password === password);
    if (company) {
      // Check Expiration
      const today = new Date();
      today.setHours(0,0,0,0);
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

      setView('DASHBOARD');
    } else {
      setLoginError('Invalid Username/Password');
    }
  };

  const handleLogout = () => {
    setActiveCompanyId(null);
    setIsSuperAdmin(false);
    setView('LOGIN');
    setUsername('');
    setPassword('');
    setLoginError('');
    setIsMenuOpen(false);
  };

  const handleNavClick = (newView: ViewState) => {
      setView(newView);
      setIsMenuOpen(false);
      
      // Reset search query when changing views for better UX
      setSearchQuery('');
      
      // Reset selections
      setSelectedCustomer(null);

      // Reset selections if moving away from bulk edit
      if (newView !== 'MODIFY_STATUS') {
          setSelectedInvoiceNos([]);
      }
      if (newView === 'CREATE_INVOICE') {
          handleCreateInvoice();
      }
  };
  
  const addShipmentType = () => {
      if(!tempShipmentName || !tempShipmentValue) return;
      
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
              tcArabic: newCompany.settings?.tcArabic || c.settings.tcArabic
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
          tcArabic: newCompany.settings.tcArabic || DEFAULT_TC_ARABIC
        },
        invoices: []
      };
      setCompanies([...companies, companyToAdd]);
      alert("Company Created Successfully!");
    }
    
    // Reset Form
    setNewCompany({ expiryDate: getOneYearFromNow(), parentId: undefined, settings: { shipmentTypes: [], isVatEnabled: false, tcHeader: DEFAULT_TC_HEADER, tcEnglish: DEFAULT_TC_ENGLISH, tcArabic: DEFAULT_TC_ARABIC, brandColor: DEFAULT_BRAND_COLOR, invoicePrefix: '', invoiceStartNumber: 1000, location: '' } });
    setEditingCompanyId(null);
    setIsBranch(false);
    setSelectedParentId('');
    setTempShipmentName('');
    setTempShipmentValue('');
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
        location: company.settings.location || ''
      }
    });
    // Scroll to top to see form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingCompanyId(null);
    setNewCompany({ expiryDate: getOneYearFromNow(), parentId: undefined, settings: { shipmentTypes: [], isVatEnabled: false, tcHeader: DEFAULT_TC_HEADER, tcEnglish: DEFAULT_TC_ENGLISH, tcArabic: DEFAULT_TC_ARABIC, brandColor: DEFAULT_BRAND_COLOR, invoicePrefix: '', invoiceStartNumber: 1000, location: '' } });
    setTempShipmentName('');
    setTempShipmentValue('');
    setIsBranch(false);
    setSelectedParentId('');
  };

  const handleCreateInvoice = () => {
    if (!activeCompany) return;
    
    // Default values if settings are missing
    const prefix = activeCompany.settings.invoicePrefix || '';
    const startNum = activeCompany.settings.invoiceStartNumber || 1000;

    let nextNum = startNum;

    // Logic to calculate next invoice number based on existing invoices
    // We assume the invoices are sorted new-to-old, so index 0 is the latest.
    if (activeInvoices.length > 0) {
        const lastInvoiceNo = activeInvoices[0].invoiceNo;
        // Attempt to extract the number part from the string
        // If invoice is "HQ-1005", replace "HQ-" with "" -> "1005"
        const numberPart = lastInvoiceNo.replace(prefix, '');
        const parsed = parseInt(numberPart, 10);

        if (!isNaN(parsed)) {
            nextNum = parsed + 1;
        } else {
            // Fallback: If stripping prefix failed (maybe old data format), try finding any number at the end
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
      status: 'Received', // Default status
      statusHistory: [{ status: 'Received', timestamp: new Date().toISOString() }],
      shipper: { name: '', idNo: '', tel: '', vatnos: '', pcs: 0, weight: 0 }, 
      consignee: { name: '', address: '', post: '', pin: '', country: '', district: '', state: '', tel: '', tel2: '' },
      cargoItems: [],
      financials: { total: 0, billCharges: 0, vat: 0, vatAmount: 0, netTotal: 0 }
    };

    setCurrentInvoice(template);
    setView('CREATE_INVOICE');
  };

  const handleEditInvoice = (invoice: InvoiceData) => {
    setCurrentInvoice(invoice);
    setView('CREATE_INVOICE');
  };

  const handleInvoiceSubmit = (data: InvoiceData) => {
    // When submitting, check if this invoice belongs to ANY company in our DB (edit mode)
    // If not found, it's a new invoice for the ACTIVE company.
    
    let foundAndUpdated = false;

    setCompanies(prev => {
      // 1. Try to find and update existing invoice in ANY company
      const nextCompanies = prev.map(c => {
        const existingIndex = c.invoices.findIndex(inv => inv.invoiceNo === data.invoiceNo);
        if (existingIndex >= 0) {
            foundAndUpdated = true;
            const updatedInvoices = [...c.invoices];
            updatedInvoices[existingIndex] = data;
            return { ...c, invoices: updatedInvoices };
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
                  return { ...c, invoices: [data, ...c.invoices] };
              }
              return c;
          });
      }

      return prev;
    });
    
    setCurrentInvoice(data);
    setView('PREVIEW_INVOICE');
  };
  
  // Bulk Update Handlers
  const toggleAllInvoices = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          setSelectedInvoiceNos(filteredInvoices.map(inv => inv.invoiceNo));
      } else {
          setSelectedInvoiceNos([]);
      }
  };

  const toggleInvoiceSelection = (invoiceNo: string) => {
      if (selectedInvoiceNos.includes(invoiceNo)) {
          setSelectedInvoiceNos(prev => prev.filter(id => id !== invoiceNo));
      } else {
          setSelectedInvoiceNos(prev => [...prev, invoiceNo]);
      }
  };

  const handleBulkStatusUpdate = () => {
      if (selectedInvoiceNos.length === 0) return;

      if (!window.confirm(`Are you sure you want to update the status of ${selectedInvoiceNos.length} invoices to "${bulkStatus}"?`)) {
          return;
      }

      setCompanies(prev => prev.map(c => {
          // Check if this company has any of the selected invoices
          const hasInvoices = c.invoices.some(inv => selectedInvoiceNos.includes(inv.invoiceNo));
          
          if (hasInvoices) {
              const updatedInvoices = c.invoices.map(inv => {
                  if (selectedInvoiceNos.includes(inv.invoiceNo)) {
                      // Update Status AND Append History
                      const timestamp = new Date().toISOString();
                      const history = inv.statusHistory || [];
                      return { 
                          ...inv, 
                          status: bulkStatus,
                          statusHistory: [...history, { status: bulkStatus, timestamp }]
                      };
                  }
                  return inv;
              });
              return { ...c, invoices: updatedInvoices };
          }
          return c;
      }));

      alert("Status updated successfully!");
      setSelectedInvoiceNos([]); // Clear selection
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
      if(!editingCustomer) return;

      if(!window.confirm(`This will update the details for ${editingCustomer.totalShipments} invoices belonging to this customer. Continue?`)) {
          return;
      }

      setCompanies(prev => prev.map(company => {
          // Only update companies that might contain this customer (technically just the one from companyId, but we check matching logic)
           if (company.id !== editingCustomer.companyId) return company;

           const updatedInvoices = company.invoices.map(inv => {
                // Match logic: Same as aggregation
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


  // --- Filtering & Stats ---

  const parseDateStr = (dateStr: string): Date => {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date();
  };

  const filteredInvoices = useMemo(() => {
    // Start with all invoices from the relevant network (HQ + Branches)
    let filtered = allNetworkInvoices;

    // 1. Dashboard Location Filter
    if (dashboardLocationFilter !== 'ALL') {
        filtered = filtered.filter(inv => inv._companyId === dashboardLocationFilter);
    }

    // 2. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(inv => 
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.consignee.name.toLowerCase().includes(q) ||
        inv.shipper.name.toLowerCase().includes(q) ||
        inv.consignee.tel.includes(q) ||
        inv.shipper.tel.includes(q) ||
        inv.date.includes(q)
      );
    }

    // 3. Date Range
    const today = new Date();
    today.setHours(0,0,0,0);
    
    filtered = filtered.filter(inv => {
      const invDate = parseDateStr(inv.date);
      invDate.setHours(0,0,0,0);

      if (dateRange === 'TODAY') return invDate.getTime() === today.getTime();
      if (dateRange === 'WEEK') {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); 
        return invDate >= startOfWeek;
      }
      if (dateRange === 'MONTH') return invDate.getMonth() === today.getMonth() && invDate.getFullYear() === today.getFullYear();
      if (dateRange === 'LAST_MONTH') {
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return invDate.getMonth() === lastMonth.getMonth() && invDate.getFullYear() === lastMonth.getFullYear();
      }
      if (dateRange === 'CUSTOM') {
        if (!customStart && !customEnd) return true;
        const start = customStart ? new Date(customStart) : new Date(0);
        const end = customEnd ? new Date(customEnd) : new Date(9999, 11, 31);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        return invDate >= start && invDate <= end;
      }
      return true;
    });

    return filtered;
  }, [allNetworkInvoices, dashboardLocationFilter, searchQuery, dateRange, customStart, customEnd]);

  const stats = useMemo(() => {
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.financials.netTotal, 0);
    const totalShipments = filteredInvoices.length;
    return { totalRevenue, totalShipments };
  }, [filteredInvoices]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredInvoices.forEach(inv => {
      const s = inv.status || 'Received';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [filteredInvoices]);

  const getRangeLabel = () => {
    switch(dateRange) {
      case 'TODAY': return 'Today';
      case 'WEEK': return 'This Week';
      case 'MONTH': return 'This Month';
      case 'LAST_MONTH': return 'Last Month';
      case 'CUSTOM': return 'Custom Range';
      default: return '';
    }
  };


  // --- VIEWS ---

  // History Modal Renderer
  const renderHistoryModal = () => (
      viewingHistoryInvoice && (
          <StatusHistoryModal 
              invoice={viewingHistoryInvoice} 
              onClose={() => setViewingHistoryInvoice(null)} 
          />
      )
  );

  const renderEditCustomerModal = () => (
      editingCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] animate-fade-in p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
                <div className="p-6 border-b">
                    <h3 className="text-xl font-bold text-gray-800">Edit Customer Details</h3>
                    <p className="text-xs text-gray-500 mt-1">Updates will apply to all <strong>{editingCustomer.totalShipments}</strong> linked invoices.</p>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                        <input 
                            type="text" 
                            className="w-full border p-2 rounded bg-gray-100"
                            value={editCustomerForm.name}
                            onChange={e => setEditCustomerForm({...editCustomerForm, name: e.target.value})}
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                        <input 
                            type="text" 
                            className="w-full border p-2 rounded bg-gray-100"
                            value={editCustomerForm.mobile}
                            onChange={e => setEditCustomerForm({...editCustomerForm, mobile: e.target.value})}
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                        <input 
                            type="text" 
                            className="w-full border p-2 rounded bg-gray-100"
                            value={editCustomerForm.idNo}
                            onChange={e => setEditCustomerForm({...editCustomerForm, idNo: e.target.value})}
                        />
                    </div>
                </div>
                <div className="p-6 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3">
                    <button 
                        onClick={() => setEditingCustomer(null)}
                        className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveCustomerDetails}
                        className="px-4 py-2 bg-blue-900 text-white font-bold rounded hover:bg-blue-800 shadow transition-colors"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
          </div>
      )
  );

  if (view === 'LOGIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow-md w-96">
          <div className="text-center mb-5">
            <h1 className="text-3xl font-bold text-blue-700 mb-[10px]">QOVOZ</h1>
            <p className="text-sm text-gray-500">Logistics Management System</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <input 
                type="text" 
                className="mt-1 block w-full border border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input 
                type="password" 
                className="mt-1 block w-full border border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
            <button type="submit" className="w-full bg-blue-800 text-white p-2 rounded hover:bg-blue-600 transition">
              Login
            </button>
          </form>
          <div className="mt-4 text-xs text-center text-gray-400">
            Secure Login by Qovoz
          </div>
        </div>
      </div>
    );
  }

  // Super Admin View to Create Companies
  if (view === 'SETTINGS' && isSuperAdmin) {
    return (
       <div className="min-h-screen bg-gray-50">
        <nav className="bg-blue-900 text-white p-4 shadow-lg sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold">Qovoz Admin Panel</h1>
            <button onClick={handleLogout} className="bg-red-600 px-3 py-1 rounded hover:bg-red-500 text-sm">
              Logout
            </button>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded shadow-lg overflow-hidden">
            <div className="p-4 bg-gray-100 border-b flex justify-between items-center">
               <div>
                   <h2 className="text-lg font-bold text-gray-800">{editingCompanyId ? 'Edit Company' : 'Create New Company'}</h2>
                   <p className="text-xs text-gray-500">{editingCompanyId ? 'Update details for the selected company.' : 'Fill in the details to create a new isolated company account.'}</p>
               </div>
               {editingCompanyId && (
                   <button onClick={handleCancelEdit} className="text-sm text-red-600 underline">Cancel Edit</button>
               )}
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ... (Existing company form code) ... */}
                <div className="col-span-1 md:col-span-2">
                    <h3 className="font-bold text-blue-900 border-b pb-2 mb-4">Company Details</h3>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name (English) *</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black"
                        value={newCompany.settings?.companyName || ''}
                        onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, companyName: e.target.value}})}
                    />
                     {/* Branch Management Tickbox */}
                     <div className="mt-2 flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="isBranch" 
                            checked={isBranch}
                            onChange={(e) => {
                                setIsBranch(e.target.checked);
                                if (!e.target.checked) setSelectedParentId('');
                            }}
                            className="h-4 w-4 text-blue-600"
                        />
                        <label htmlFor="isBranch" className="text-xs text-gray-600 cursor-pointer select-none">Is this a Sub-Branch?</label>
                    </div>
                    {isBranch && (
                        <div className="mt-1 animate-fade-in">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Select Parent Company</label>
                            <select 
                                className="w-full border-gray-300 rounded p-1 bg-gray-300 text-black text-xs"
                                value={selectedParentId}
                                onChange={(e) => setSelectedParentId(e.target.value)}
                            >
                                <option value="">-- Select Parent --</option>
                                {companies
                                    .filter(c => c.id !== editingCompanyId) // Prevent self-selection
                                    .map(c => (
                                        <option key={c.id} value={c.id}>{c.settings.companyName}</option>
                                    ))
                                }
                            </select>
                        </div>
                    )}
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name (Arabic)</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black text-right font-arabic"
                        value={newCompany.settings?.companyArabicName || ''}
                        onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, companyArabicName: e.target.value}})}
                    />
                </div>
                
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 (English)</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black"
                        value={newCompany.settings?.addressLine1 || ''}
                        onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, addressLine1: e.target.value}})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 (Arabic)</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black text-right"
                        value={newCompany.settings?.addressLine1Arabic || ''}
                        onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, addressLine1Arabic: e.target.value}})}
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2 (English)</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black"
                        value={newCompany.settings?.addressLine2 || ''}
                        onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, addressLine2: e.target.value}})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2 (Arabic)</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black text-right"
                        value={newCompany.settings?.addressLine2Arabic || ''}
                        onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, addressLine2Arabic: e.target.value}})}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Mobile (English)</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black"
                        value={newCompany.settings?.phone1 || ''}
                        onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, phone1: e.target.value}})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Mobile</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black"
                        value={newCompany.settings?.phone2 || ''}
                        onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, phone2: e.target.value}})}
                    />
                </div>
                
                 {/* Invoice Prefix & Start Number */}
                 <div className="flex gap-4">
                     <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
                        <input 
                            type="text" 
                            placeholder="e.g. HQ-"
                            className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black font-mono uppercase"
                            value={newCompany.settings?.invoicePrefix || ''}
                            onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, invoicePrefix: e.target.value.toUpperCase()}})}
                        />
                     </div>
                     <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start No.</label>
                        <input 
                            type="number" 
                            placeholder="1000"
                            className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black font-mono"
                            value={newCompany.settings?.invoiceStartNumber || ''}
                            onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, invoiceStartNumber: parseInt(e.target.value)}})}
                        />
                     </div>
                 </div>

                {/* Location Input */}
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location / Branch *</label>
                    <input 
                        type="text" 
                        placeholder="e.g. Riyadh, Dammam"
                        className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black"
                        value={newCompany.settings?.location || ''}
                        onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, location: e.target.value}})}
                    />
                </div>
                
                {/* VAT Section */}
                <div className="bg-gray-200 p-2 rounded border border-gray-300 col-span-1 md:col-span-2 flex flex-col gap-2">
                     <div className="flex items-center gap-2">
                         <input 
                             type="checkbox" 
                             id="enableVat"
                             checked={newCompany.settings?.isVatEnabled || false}
                             onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, isVatEnabled: e.target.checked}})}
                             className="h-4 w-4 text-blue-600 rounded"
                         />
                         <label htmlFor="enableVat" className="text-sm font-medium text-gray-700 select-none cursor-pointer">Enable VAT Calculation</label>
                     </div>
                     <div>
                        <label className={`block text-sm font-medium mb-1 ${newCompany.settings?.isVatEnabled ? 'text-gray-700' : 'text-gray-400'}`}>VAT Number</label>
                        <input 
                            type="text" 
                            className={`w-full border-gray-300 rounded p-2 text-black placeholder-black ${newCompany.settings?.isVatEnabled ? 'bg-gray-300' : 'bg-gray-200 text-gray-400'}`}
                            value={newCompany.settings?.vatnoc || ''}
                            onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, vatnoc: e.target.value}})}
                            disabled={!newCompany.settings?.isVatEnabled}
                            placeholder={newCompany.settings?.isVatEnabled ? "Enter VAT Number" : "Enable checkbox to enter VAT"}
                        />
                    </div>
                </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Logo (260px * 110px)</label>
                    <div className="flex flex-col gap-2">
                         <input 
                             type="file" 
                             accept="image/png, image/jpeg"
                             className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black text-sm"
                             onChange={(e) => {
                                 const file = e.target.files?.[0];
                                 if (file) {
                                     const reader = new FileReader();
                                     reader.onloadend = () => {
                                         setNewCompany(prev => ({
                                             ...prev,
                                             settings: {
                                                 ...prev.settings,
                                                 logoUrl: reader.result as string
                                             }
                                         }));
                                     };
                                     reader.readAsDataURL(file);
                                 }
                             }}
                         />
                         {newCompany.settings?.logoUrl && (
                             <div className="relative inline-block w-fit group">
                                <img src={newCompany.settings.logoUrl} alt="Logo Preview" className="h-16 w-auto object-contain border bg-white p-1" />
                                <button 
                                    onClick={() => setNewCompany(prev => ({...prev, settings: {...prev.settings, logoUrl: ''}}))}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-red-600"
                                    title="Remove Logo"
                                >
                                    &times;
                                </button>
                             </div>
                         )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand Color</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="color" 
                            className="h-10 w-20 p-1 border border-gray-300 rounded cursor-pointer"
                            value={newCompany.settings?.brandColor || DEFAULT_BRAND_COLOR} 
                            onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, brandColor: e.target.value}})}
                        />
                        <span className="text-sm text-gray-500 font-mono">{newCompany.settings?.brandColor || DEFAULT_BRAND_COLOR}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Used for headings, borders, and accents on the invoice.</p>
                </div>

                {/* Terms and Conditions Section */}
                <div className="col-span-1 md:col-span-2 mt-2">
                    <h3 className="font-bold text-blue-900 border-b pb-2 mb-4">Invoice Terms & Conditions</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">T&C Warning Header (Center Bold)</label>
                            <textarea 
                                rows={2}
                                className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black text-sm"
                                value={newCompany.settings?.tcHeader || ''}
                                onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, tcHeader: e.target.value}})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">T&C Text (English)</label>
                            <textarea 
                                rows={4}
                                className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black text-sm"
                                value={newCompany.settings?.tcEnglish || ''}
                                onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, tcEnglish: e.target.value}})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">T&C Text (Arabic)</label>
                            <textarea 
                                rows={4}
                                className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black text-sm text-right font-arabic"
                                value={newCompany.settings?.tcArabic || ''}
                                onChange={(e) => setNewCompany({...newCompany, settings: {...newCompany.settings, tcArabic: e.target.value}})}
                            />
                        </div>
                    </div>
                </div>

                {/* Shipment Types Section */}
                <div className="col-span-1 md:col-span-2 mt-2">
                    <h3 className="font-bold text-blue-900 border-b pb-2 mb-2">Shipment Types</h3>
                    <div className="flex gap-2 mb-3 bg-gray-200 p-2 rounded items-end">
                        <div className="flex-1">
                            <label className="block text-sm text-gray-700">Name</label>
                            <input 
                                placeholder="e.g. IND AIR" 
                                className="w-full border-gray-300 p-1 rounded text-sm bg-gray-300 text-black placeholder-black"
                                value={tempShipmentName}
                                onChange={e => setTempShipmentName(e.target.value)}
                            />
                        </div>
                        <div className="w-24">
                            <label className="block text-sm text-gray-700">Value</label>
                            <input 
                                placeholder="e.g. 10" 
                                type="number"
                                className="w-full border-gray-300 p-1 rounded text-sm bg-gray-300 text-black placeholder-black"
                                value={tempShipmentValue}
                                onChange={e => setTempShipmentValue(e.target.value)}
                            />
                        </div>
                        <button onClick={addShipmentType} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-500 h-8 text-sm">Add</button>
                    </div>
                    
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                        {(newCompany.settings?.shipmentTypes || []).length === 0 && (
                            <p className="text-gray-500 text-xs italic">No shipment types added.</p>
                        )}
                        {(newCompany.settings?.shipmentTypes || []).map((type, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-gray-100 p-2 rounded border">
                                <span className="text-gray-700 font-normal">{type.name} <span className="text-gray-700 font-normal">({type.value})</span></span>
                                <button onClick={() => removeShipmentType(idx)} className="text-red-500 font-bold hover:bg-red-100 rounded px-2">&times;</button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Account Section */}
                <div className="col-span-1 md:col-span-2 mt-4">
                    <h3 className="font-bold text-blue-900 border-b pb-2 mb-4">Account Credentials</h3>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Username *</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black"
                        value={newCompany.username || ''}
                        onChange={(e) => setNewCompany({...newCompany, username: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password *</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black"
                        value={newCompany.password || ''}
                        onChange={(e) => setNewCompany({...newCompany, password: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Expiry Date</label>
                    <input 
                        type="date" 
                        className="w-full border-gray-300 rounded p-2 bg-gray-300 text-black placeholder-black"
                        value={newCompany.expiryDate || ''}
                        onChange={(e) => setNewCompany({...newCompany, expiryDate: e.target.value})}
                    />
                    <p className="text-xs text-gray-500 mt-1">Default is 1 year from today.</p>
                </div>

                <div className="col-span-1 md:col-span-2 mt-6">
                    <button 
                        onClick={handleSaveCompany}
                        className={`w-full text-white font-bold py-3 rounded shadow transition ${editingCompanyId ? 'bg-green-700 hover:bg-green-600' : 'bg-blue-800 hover:bg-blue-600'}`}
                    >
                        {editingCompanyId ? 'Update Company' : 'Create Company'}
                    </button>
                </div>

            </div>
            
            <div className="bg-gray-50 p-6 border-t">
                 <h3 className="font-bold text-gray-600 mb-2">Existing Companies ({companies.length})</h3>
                 <div className="space-y-2">
                     {companies.map(c => (
                         <div key={c.id} className="bg-white border p-3 rounded flex justify-between items-center text-sm shadow-sm">
                             <div>
                                 <span className="font-bold text-gray-800 block">
                                    {c.settings.companyName} {c.settings.location ? `(${c.settings.location})` : ''}
                                 </span>
                                 <div className="text-gray-500 text-xs">
                                     User: {c.username} | Exp: {c.expiryDate}
                                     {c.parentId && <span className="ml-2 text-blue-600 bg-blue-50 px-1 rounded border border-blue-200">Sub-Branch</span>}
                                 </div>
                             </div>
                             <div className="flex gap-2">
                                <button 
                                    onClick={() => handleEditCompany(c)}
                                    className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 transition"
                                >
                                    Edit
                                </button>
                             </div>
                         </div>
                     ))}
                 </div>
            </div>
          </div>
        </main>
       </div>
    );
  }

  const renderSidebar = () => {
    if (!isMenuOpen || !activeCompany) return null;
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
                    
                    <button onClick={() => handleNavClick('CUSTOMERS')} className={`px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 ${view === 'CUSTOMERS' ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-900' : 'text-gray-700'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        Customers
                    </button>

                     <button onClick={() => handleNavClick('MODIFY_STATUS')} className={`px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 ${view === 'MODIFY_STATUS' ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-900' : 'text-gray-700'}`}>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 9.414v2.586h2.586l7.586-7.586a2 2 0 000-2.828z" />
                            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                         </svg>
                         Modify Status
                    </button>

                    <button onClick={() => handleNavClick('BRANCH_MANAGEMENT')} className={`px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 ${view === 'BRANCH_MANAGEMENT' ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-900' : 'text-gray-700'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 8v7a1 1 0 100 2h14a1 1 0 100-2V8a1 1 0 00.496-1.868l-7-4zM6 9a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm3 1a1 1 0 012 0v3a1 1 0 11-2 0v-3zm5-1a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Branch Management
                    </button>
                    
                     <div className="border-t my-2"></div>
                     
                     <button onClick={handleLogout} className="px-4 py-3 text-left hover:bg-red-50 text-red-600 flex items-center gap-3">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                         </svg>
                         Logout
                    </button>
                </div>
                
                <div className="p-4 bg-gray-50 text-xs text-gray-500 border-t">
                    <p>{activeCompany.settings.companyName} {activeCompany.settings.location ? `(${activeCompany.settings.location})` : ''}</p>
                    <p className="mt-1">User: {activeCompany.username}</p>
                </div>
            </div>
        </div>
    );
  };

  const renderHeader = () => {
      if(!activeCompany) return null;
      return (
        <nav className="bg-blue-900 text-white p-4 flex justify-between items-center shadow-lg sticky top-0 z-10">
          <div className="flex items-center gap-4">
              <button onClick={() => setIsMenuOpen(true)} className="hover:bg-blue-800 p-1 rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
              </button>
              <h1 className="text-xl font-bold">{activeCompany.settings.companyName} {activeCompany.settings.location ? `(${activeCompany.settings.location})` : ''}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-sm opacity-80">Logged in as {activeCompany.username}</span>
            <button onClick={handleLogout} className="bg-red-600 px-3 py-1 rounded hover:bg-red-500 text-sm">Logout</button>
          </div>
        </nav>
      );
  };

  const renderFilterBar = () => {
      const isBranchUser = activeCompany?.parentId; // Identify if branch user
      
      return (
      <div className="bg-white p-4 rounded shadow mb-6 flex flex-col xl:flex-row gap-4 items-center">
             <div className="relative w-full xl:w-1/3">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input 
                  type="text"
                  placeholder="Search invoice #, name, mobile..."
                  className="w-full border border-gray-300 rounded pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-300 text-black placeholder-black"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>

             <div className="flex flex-col md:flex-row gap-2 items-center w-full xl:w-auto">
                {/* Location Filter */}
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

                {/* Hide Date Range Picker in Customers View */}
                {view !== 'CUSTOMERS' && (
                    <>
                        <select 
                        className="border border-gray-300 rounded px-3 py-2 bg-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-auto"
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value as any)}
                        >
                        <option value="TODAY">Today</option>
                        <option value="WEEK">This Week</option>
                        <option value="MONTH">This Month</option>
                        <option value="LAST_MONTH">Last Month</option>
                        <option value="CUSTOM">Custom Date</option>
                        </select>

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
  )};

  const renderCustomers = () => {
    if (!activeCompany) return null;

    // 1. Get Base Invoices based on network (same logic as dashboard/invoices)
    let relevantInvoices = allNetworkInvoices;

    // 2. Apply Location Filter
    // Only apply specific filter if it is NOT 'ALL'
    if (dashboardLocationFilter && dashboardLocationFilter !== 'ALL') {
        relevantInvoices = relevantInvoices.filter(inv => inv._companyId === dashboardLocationFilter);
    }

    // 3. Extract Unique Customers (Shippers)
    const customersMap = new Map<string, AggregatedCustomer>();

    relevantInvoices.forEach(inv => {
        const shipper = inv.shipper;
        if (!shipper.name) return; // Skip empty records
        
        // Key generation: Try ID, else Name+Tel
        const identityKey = shipper.idNo && shipper.idNo.length > 3 ? `ID:${shipper.idNo}` : `NM:${shipper.name.trim().toLowerCase()}|${shipper.tel}`;
        
        // If "ALL" locations, include company ID in key to separate them one by one per branch
        // If specific location selected, filtering already happened, but key remains unique per branch logic effectively.
        const key = `${identityKey}_${inv._companyId}`;
        
        if (!customersMap.has(key)) {
            customersMap.set(key, {
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
        
        const customer = customersMap.get(key);
        if (customer) {
            customer.totalShipments += 1;
        }
    });
    
    let customers = Array.from(customersMap.values());

    // 4. Search Filter
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        customers = customers.filter(c => 
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.mobile && c.mobile.includes(q)) ||
            (c.idNo && c.idNo.includes(q))
        );
    }

    // Sort by name
    customers.sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="min-h-screen bg-gray-50">
             {renderHeader()}
             {renderSidebar()}
             {renderEditCustomerModal()}
             <main className="max-w-7xl mx-auto p-4 md:p-6">
                <div className="flex items-center gap-4 mb-6">
                     <button onClick={() => setView('DASHBOARD')} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
                        &larr; Back to Dashboard
                    </button>
                     <h2 className="text-2xl font-bold text-gray-800">Customers</h2>
                </div>
                
                {renderFilterBar()} 

                <div className="bg-white rounded shadow overflow-hidden">
                    <div className="px-6 py-4 border-b flex justify-between items-center">
                        <h3 className="font-bold text-gray-700">Customer List</h3>
                         <span className="text-xs text-gray-500">
                             Showing {customers.length} entries 
                             {dashboardLocationFilter === 'ALL' ? ' across all locations' : ' in selected location'}
                         </span>
                    </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600 text-sm">
                                    <th className="p-4 border-b">Customer Name</th>
                                    <th className="p-4 border-b">ID No</th>
                                    <th className="p-4 border-b">Mobile</th>
                                    <th className="p-4 border-b">Branch</th>
                                    <th className="p-4 border-b text-center">Shipments</th>
                                    <th className="p-4 border-b text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-gray-700">
                                {customers.length > 0 ? (
                                    customers.map((cust) => (
                                        <tr 
                                            key={cust.key} 
                                            onClick={() => {
                                                setSelectedCustomer(cust);
                                                setView('CUSTOMER_DETAIL');
                                            }}
                                            className="hover:bg-blue-50 border-b last:border-0 cursor-pointer transition-colors"
                                        >
                                            <td className="p-4 font-bold text-blue-900">{cust.name}</td>
                                            <td className="p-4 font-mono">{cust.idNo || '-'}</td>
                                            <td className="p-4 text-gray-600">{cust.mobile || '-'}</td>
                                            <td className="p-4 text-xs font-bold text-gray-500">
                                                {cust.location}
                                            </td>
                                            <td className="p-4 text-center font-bold">{cust.totalShipments}</td>
                                            <td className="p-4 text-center">
                                                <button 
                                                    onClick={(e) => handleEditCustomerClick(e, cust)}
                                                    className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-100 transition"
                                                    title="Edit Customer Details"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-gray-500">No customers found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
             </main>
        </div>
    )
  };

  const renderCustomerDetail = () => {
    if (!activeCompany || !selectedCustomer) return null;

    // Filter invoices matching this specific customer key
    const customerInvoices = allNetworkInvoices.filter(inv => {
        const shipper = inv.shipper;
        const identityKey = shipper.idNo && shipper.idNo.length > 3 ? `ID:${shipper.idNo}` : `NM:${shipper.name.trim().toLowerCase()}|${shipper.tel}`;
        const key = `${identityKey}_${inv._companyId}`;
        return key === selectedCustomer.key;
    });

    // Sort by date (newest first)
    customerInvoices.sort((a, b) => new Date(parseDateStr(b.date)).getTime() - new Date(parseDateStr(a.date)).getTime());

    const totalSpent = customerInvoices.reduce((acc, curr) => acc + curr.financials.netTotal, 0);

    return (
        <div className="min-h-screen bg-gray-50">
             {renderHeader()}
             {renderSidebar()}
             <main className="max-w-7xl mx-auto p-4 md:p-6">
                <div className="flex items-center gap-4 mb-6">
                     <button onClick={() => setView('CUSTOMERS')} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
                        &larr; Back to Customers
                    </button>
                     <h2 className="text-2xl font-bold text-gray-800">Customer Details</h2>
                </div>

                <div className="bg-white p-6 rounded shadow mb-6 border-l-4 border-blue-900 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h3 className="text-3xl font-bold text-blue-900">{selectedCustomer.name}</h3>
                        <div className="mt-2 text-gray-600 space-y-1">
                             <p><span className="font-bold">Mobile:</span> {selectedCustomer.mobile}</p>
                             <p><span className="font-bold">ID No:</span> {selectedCustomer.idNo}</p>
                             <p><span className="font-bold">Branch:</span> {selectedCustomer.location}</p>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center items-start md:items-end">
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Total Spent</p>
                            <p className="text-3xl font-bold text-green-700">SAR {totalSpent.toFixed(2)}</p>
                        </div>
                         <div className="text-right mt-2">
                            <p className="text-sm text-gray-500">Total Shipments</p>
                            <p className="text-xl font-bold text-gray-800">{customerInvoices.length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded shadow overflow-hidden">
                    <div className="px-6 py-4 border-b">
                        <h3 className="font-bold text-gray-700">Shipment History</h3>
                    </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600 text-sm">
                                    <th className="p-4 border-b">Invoice #</th>
                                    <th className="p-4 border-b">Date</th>
                                    <th className="p-4 border-b">Consignee</th>
                                    <th className="p-4 border-b">Items</th>
                                    <th className="p-4 border-b">Amount</th>
                                    <th className="p-4 border-b">Status</th>
                                    <th className="p-4 border-b text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-gray-700">
                                {customerInvoices.map((inv, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 border-b last:border-0">
                                        <td className="p-4 font-mono font-bold text-blue-900">{inv.invoiceNo}</td>
                                        <td className="p-4 text-gray-600">{inv.date}</td>
                                        <td className="p-4">{inv.consignee.name}</td>
                                        <td className="p-4 text-xs text-gray-500">{inv.cargoItems.length} items ({inv.shipper.weight}kg)</td>
                                        <td className="p-4 font-bold">SAR {inv.financials.netTotal.toFixed(2)}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    inv.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                                                    inv.status === 'Received' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                {inv.status || 'Received'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button 
                                                onClick={() => handleEditInvoice(inv)}
                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium underline"
                                            >
                                                View/Edit
                                            </button>
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

  const renderBranchManagement = () => {
    if(!activeCompany) return null;

    // Determine Logic:
    // If I am a parent (parentId is null), show ME as top, and MY CHILDREN as branches.
    // If I am a child (parentId exists), show MY PARENT as top, and MY SIBLINGS (including me) as branches.
    
    let headOffice: Company | undefined;
    let branches: Company[] = [];

    if (activeCompany.parentId) {
        // I am a branch
        headOffice = companies.find(c => c.id === activeCompany.parentId);
        branches = companies.filter(c => c.parentId === activeCompany.parentId);
    } else {
        // I am HQ (potentially)
        headOffice = activeCompany;
        branches = companies.filter(c => c.parentId === activeCompany.id);
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {renderHeader()}
            {renderSidebar()}
            <main className="max-w-7xl mx-auto p-4 md:p-6">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setView('DASHBOARD')} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
                        &larr; Back to Dashboard
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800">Branch Management</h2>
                </div>

                {/* Head Office Card */}
                <div className="mb-8">
                     <h3 className="text-gray-500 font-bold uppercase text-sm mb-3 tracking-wider">Head Office</h3>
                     {headOffice ? (
                         <div className="bg-white border-l-4 border-blue-900 rounded shadow-md p-6 flex flex-col md:flex-row justify-between items-start md:items-center">
                             <div>
                                 <h4 className="text-xl font-bold text-gray-900">{headOffice.settings.companyName} {headOffice.settings.location ? `(${headOffice.settings.location})` : ''}</h4>
                                 <p className="text-gray-500">{headOffice.settings.addressLine2}, {headOffice.settings.addressLine1}</p>
                                 <p className="text-gray-500 text-sm mt-1">Phone: {headOffice.settings.phone1}</p>
                             </div>
                             <div className="mt-4 md:mt-0 flex gap-4">
                                  <div className="text-right">
                                      <p className="text-xs text-gray-400 uppercase">Role</p>
                                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">HEADQUARTERS</span>
                                  </div>
                                  {activeCompany.id === headOffice.id && (
                                       <div className="text-right">
                                           <p className="text-xs text-gray-400 uppercase">Status</p>
                                           <span className="text-green-600 font-bold text-sm">Active (You)</span>
                                       </div>
                                  )}
                             </div>
                         </div>
                     ) : (
                         <div className="bg-red-50 text-red-600 p-4 rounded border border-red-200">
                             Parent Company data not found. Contact Admin.
                         </div>
                     )}
                </div>

                {/* Network Branches */}
                <div>
                     <h3 className="text-gray-500 font-bold uppercase text-sm mb-3 tracking-wider flex justify-between items-center">
                         <span>Network Branches ({branches.length})</span>
                     </h3>
                     
                     {branches.length > 0 ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                             {branches.map(branch => (
                                 <div key={branch.id} className={`bg-white rounded shadow border hover:shadow-lg transition p-5 flex flex-col justify-between ${branch.id === activeCompany.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'}`}>
                                     <div>
                                         <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-gray-800 text-lg mb-1">{branch.settings.companyName} {branch.settings.location ? `(${branch.settings.location})` : ''}</h4>
                                            {branch.id === activeCompany.id && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">You</span>}
                                         </div>
                                         <p className="text-sm text-gray-600">{branch.settings.addressLine2}</p>
                                         <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                             {branch.settings.phone1}
                                         </p>
                                     </div>
                                     <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                                         <div className="text-xs text-gray-500">
                                             User: <span className="font-mono">{branch.username}</span>
                                         </div>
                                         <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">Branch Office</span>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     ) : (
                         <div className="bg-gray-100 p-8 text-center rounded text-gray-500 italic">
                             No branches connected to this Head Office yet.
                         </div>
                     )}
                </div>
            </main>
        </div>
    );
  };

  if (view === 'MODIFY_STATUS' && activeCompany) {
      return (
        <div className="min-h-screen bg-gray-50">
            {renderHeader()}
            {renderSidebar()}
            {renderHistoryModal()} 
            <main className="max-w-7xl mx-auto p-4 md:p-6">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setView('DASHBOARD')} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
                        &larr; Back to Dashboard
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800">Modify Status</h2>
                </div>
                
                {renderFilterBar()}

                <div className="bg-blue-50 p-4 rounded shadow border border-blue-200 mb-4 flex justify-between items-center">
                    <div className="flex gap-4 items-center">
                        <span className="font-bold text-blue-900">{selectedInvoiceNos.length} Selected</span>
                        <div className="flex items-center gap-2">
                             <label className="text-sm text-gray-700">Set Status To:</label>
                             <select 
                                className="border border-gray-300 rounded p-2 bg-white text-black"
                                value={bulkStatus}
                                onChange={(e) => setBulkStatus(e.target.value as ShipmentStatus)}
                            >
                                {SHIPMENT_STATUSES.map(status => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button 
                        onClick={handleBulkStatusUpdate}
                        disabled={selectedInvoiceNos.length === 0}
                        className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Save Changes
                    </button>
                </div>

                <div className="bg-white rounded shadow overflow-hidden">
                     <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600 text-sm">
                                    <th className="p-4 border-b w-10">
                                        <input 
                                            type="checkbox" 
                                            onChange={toggleAllInvoices}
                                            checked={selectedInvoiceNos.length > 0 && selectedInvoiceNos.length === filteredInvoices.length}
                                            className="h-4 w-4"
                                        />
                                    </th>
                                    <th className="p-4 border-b">Invoice #</th>
                                    <th className="p-4 border-b">Location</th>
                                    <th className="p-4 border-b">Date</th>
                                    <th className="p-4 border-b">Shipper Name</th>
                                    <th className="p-4 border-b">Mobile</th>
                                    <th className="p-4 border-b">Amount</th>
                                    <th className="p-4 border-b">Current Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-gray-700">
                                {filteredInvoices.length > 0 ? (
                                    filteredInvoices.map((inv, idx) => (
                                        <tr key={idx} className={`hover:bg-gray-50 ${selectedInvoiceNos.includes(inv.invoiceNo) ? 'bg-blue-50' : ''}`}>
                                            <td className="p-4 border-b">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedInvoiceNos.includes(inv.invoiceNo)}
                                                    onChange={() => toggleInvoiceSelection(inv.invoiceNo)}
                                                    className="h-4 w-4"
                                                />
                                            </td>
                                            <td className="p-4 border-b font-mono font-bold text-blue-900">{inv.invoiceNo}</td>
                                            <td className="p-4 border-b text-xs text-gray-500">
                                                {inv._locationName}
                                            </td>
                                            <td className="p-4 border-b">{inv.date}</td>
                                            <td className="p-4 border-b font-medium">{inv.shipper.name}</td>
                                            <td className="p-4 border-b text-gray-500">{inv.shipper.tel}</td>
                                            <td className="p-4 border-b font-bold">SAR {inv.financials.netTotal.toFixed(2)}</td>
                                            <td className="p-4 border-b">
                                                 <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    inv.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                                                    inv.status === 'Received' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {inv.status || 'Received'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={8} className="p-8 text-center text-gray-500">No invoices found.</td></tr>
                                )}
                            </tbody>
                        </table>
                     </div>
                </div>
            </main>
        </div>
      );
  }

  if (view === 'BRANCH_MANAGEMENT' && activeCompany) {
      return renderBranchManagement();
  }
  
  if (view === 'CUSTOMERS' && activeCompany) {
      return renderCustomers();
  }

  if (view === 'CUSTOMER_DETAIL' && activeCompany) {
      return renderCustomerDetail();
  }

  if (view === 'DASHBOARD' && activeCompany) {
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
                  onClick={() => {
                      setSelectedInvoiceNos([]);
                      setView('MODIFY_STATUS');
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 flex items-center gap-2 justify-center flex-1 md:flex-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 9.414v2.586h2.586l7.586-7.586a2 2 0 000-2.828z" />
                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                  </svg>
                  Modify Status
                </button>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded shadow-sm border-l-4 border-blue-500">
              <div className="text-gray-500 text-sm">Shipments ({getRangeLabel()})</div>
              <div className="text-3xl font-bold text-gray-800">{stats.totalShipments}</div>
            </div>
            <div className="bg-white p-6 rounded shadow-sm border-l-4 border-green-500">
              <div className="text-gray-500 text-sm">Revenue ({getRangeLabel()})</div>
              <div className="text-3xl font-bold text-gray-800">SAR {stats.totalRevenue.toFixed(2)}</div>
            </div>
            <div className="bg-white p-6 rounded shadow-sm border-l-4 border-yellow-500">
              <div className="text-gray-500 text-sm">Pending Clearance</div>
              <div className="text-3xl font-bold text-gray-800">3</div>
            </div>
          </div>

          <h3 className="font-bold text-gray-700 mb-4 text-lg">Shipment Status Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {SHIPMENT_STATUSES.map(status => (
                  <div key={status} className="bg-white p-4 rounded shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center hover:shadow-md transition">
                      <div className="text-2xl font-bold text-blue-900">{statusCounts[status] || 0}</div>
                      <div className="text-xs text-gray-500 font-medium">{status}</div>
                  </div>
              ))}
          </div>

          <h3 className="font-bold text-gray-700 mb-4 text-lg">Recent Activity</h3>
          <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-100">
              <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                      <tr>
                          <th className="p-3">Invoice #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Customer</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Amount</th>
                      </tr>
                  </thead>
                  <tbody>
                      {filteredInvoices.slice(0, 5).map((inv, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="p-3 font-mono font-bold text-blue-800">{inv.invoiceNo}</td>
                              <td className="p-3 text-gray-600">{inv.date}</td>
                              <td className="p-3 font-medium text-gray-900">{inv.shipper.name || 'Unknown'}</td>
                              <td className="p-3">
                                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                      {inv.status || 'Received'}
                                  </span>
                              </td>
                              <td className="p-3 text-right font-bold text-gray-700">SAR {inv.financials.netTotal.toFixed(2)}</td>
                          </tr>
                      ))}
                      {filteredInvoices.length === 0 && (
                          <tr><td colSpan={5} className="p-4 text-center text-gray-400">No activity found.</td></tr>
                      )}
                  </tbody>
              </table>
              {filteredInvoices.length > 0 && (
                  <div className="p-3 bg-gray-50 text-center border-t">
                      <button onClick={() => setView('INVOICES')} className="text-blue-600 text-xs font-bold hover:underline">View All Invoices &rarr;</button>
                  </div>
              )}
          </div>
        </main>
      </div>
    );
  }

  if (view === 'INVOICES' && activeCompany) {
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
                    onClick={() => {
                        setSelectedInvoiceNos([]);
                        setView('MODIFY_STATUS');
                    }}
                    className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 flex items-center gap-2 justify-center flex-1 md:flex-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M17.414 2.586a2 2 0 00-2.828 0L7 9.414v2.586h2.586l7.586-7.586a2 2 0 000-2.828z" />
                      <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                    </svg>
                    Modify Status
                  </button>
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
                                  className={`px-2 py-1 rounded text-xs font-bold hover:opacity-80 transition shadow-sm ${
                                      inv.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                                      inv.status === 'Received' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                  }`}
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
                                    setView('PREVIEW_INVOICE');
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
                <button onClick={() => setView('DASHBOARD')} className="hover:text-white">&larr; Back</button>
                <h1 className="text-lg font-bold">Create Invoice</h1>
             </div>
          </nav>
          <InvoiceForm 
            initialData={currentInvoice}
            onSubmit={handleInvoiceSubmit}
            onCancel={() => setView('DASHBOARD')}
            shipmentTypes={activeCompany?.settings.shipmentTypes || []}
            history={allNetworkInvoices}
            isVatEnabled={activeCompany?.settings.isVatEnabled || false} 
          />
      </div>
    );
  }

  if (view === 'PREVIEW_INVOICE' && currentInvoice && activeCompany) {
    // Note: InvoicePreview usually needs settings of the invoice's creator
    // If viewing a branch invoice from HQ, we should technically pass that branch's settings.
    // For now, defaulting to activeCompany settings (viewing user), or we could try to find the company 
    // from the invoiceNo logic if we needed exact letterhead of the branch.
    // Given the prompt didn't specify strict letterhead switching for preview, we keep activeCompany.
    // However, if we wanted to be precise, we'd find the owner company of currentInvoice.
    
    // Let's try to find the owner for the preview to be accurate
    const ownerCompany = companies.find(c => c.invoices.some(inv => inv.invoiceNo === currentInvoice.invoiceNo)) || activeCompany;

    return (
      <InvoicePreview 
        data={currentInvoice} 
        settings={ownerCompany.settings}
        onBack={() => setView('DASHBOARD')} 
      />
    );
  }

  return null;
};

export default App;

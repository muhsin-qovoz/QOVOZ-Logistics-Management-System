
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { InvoiceData, InvoiceItem, ShipmentType, ItemMaster } from '../types';
import { extractInvoiceData, fileToGenerativePart } from '../services/geminiService';

interface InvoiceFormProps {
  initialData: InvoiceData;
  onSubmit: (data: InvoiceData) => void;
  onCancel: () => void;
  shipmentTypes: ShipmentType[];
  history?: InvoiceData[];
  isVatEnabled: boolean;
  savedItems?: ItemMaster[];
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ initialData, onSubmit, onCancel, shipmentTypes, history = [], isVatEnabled, savedItems = [] }) => {
  // Ensure at least one item exists
  const ensureItems = (items: InvoiceItem[]) => {
      if (!items || items.length === 0) {
          return [{
              slNo: 1,
              description: '',
              boxNo: 'B1',
              qty: 0 // Changed default to 0 so it appears empty
          }];
      }
      return items;
  };

  const [data, setData] = useState<InvoiceData>({
      ...initialData,
      cargoItems: ensureItems(initialData.cargoItems),
      status: initialData.status || 'Received' // Ensure default
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [shouldFocusNewRow, setShouldFocusNewRow] = useState(false);
  
  // State to control the "Expanded" look of the Shipment Type dropdown
  const [isShipmentListOpen, setIsShipmentListOpen] = useState(true);

  // --- Autocomplete & Modal State ---
  const [suggestions, setSuggestions] = useState<InvoiceData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAutofillModal, setShowAutofillModal] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<InvoiceData | null>(null);
  
  // Item Autocomplete State
  const [activeItemRow, setActiveItemRow] = useState<number | null>(null);
  const [itemSuggestions, setItemSuggestions] = useState<ItemMaster[]>([]);
  
  // Checkbox states for the modal
  const [applyShipper, setApplyShipper] = useState(true);
  const [applyConsignee, setApplyConsignee] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  // Derive unique customers from history for autocomplete
  const uniqueCustomers = useMemo(() => {
      const map = new Map<string, InvoiceData>();
      history.forEach(inv => {
          if (inv.shipper.name && !map.has(inv.shipper.name.trim().toLowerCase())) {
              map.set(inv.shipper.name.trim().toLowerCase(), inv);
          }
      });
      return Array.from(map.values());
  }, [history]);

  // Handle clicking outside suggestions to close them
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
              setShowSuggestions(false);
          }
          // Also close item suggestions if clicked outside
          const target = event.target as HTMLElement;
          if (!target.closest('.item-suggestion-box')) {
             setActiveItemRow(null);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus new row item
  useEffect(() => {
    if (shouldFocusNewRow) {
        const lastIdx = data.cargoItems.length - 1;
        const el = document.getElementById(`row-${lastIdx}-desc`);
        if(el) el.focus();
        setShouldFocusNewRow(false);
    }
  }, [data.cargoItems, shouldFocusNewRow]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const base64 = await fileToGenerativePart(file);
      const extractedData = await extractInvoiceData(base64);
      
      // Merge extracted data with current data
      setData(prev => ({
        ...prev,
        ...extractedData,
        shipper: { ...prev.shipper, ...extractedData.shipper },
        consignee: { ...prev.consignee, ...extractedData.consignee },
        financials: { ...prev.financials, ...extractedData.financials },
        cargoItems: extractedData.cargoItems || prev.cargoItems
      }));
    } catch (error) {
      alert("Failed to extract data. Please try again or enter manually.");
      console.error(error);
    } finally {
      setIsProcessing(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleShipperChange = (field: string, value: string | number) => {
    setData(prev => ({
      ...prev,
      shipper: { ...prev.shipper, [field]: value }
    }));

    if (field === 'name') {
        const strVal = String(value);
        if (strVal.length > 0) {
            const matches = uniqueCustomers.filter(c => 
                c.shipper.name.toLowerCase().includes(strVal.toLowerCase())
            );
            setSuggestions(matches);
            setShowSuggestions(matches.length > 0);
        } else {
            setShowSuggestions(false);
        }
    }
  };

  const handleSuggestionClick = (customer: InvoiceData) => {
      setSelectedHistoryItem(customer);
      setApplyShipper(true);
      setApplyConsignee(true);
      setShowAutofillModal(true);
      setShowSuggestions(false);
  };

  const handleAutofillConfirm = () => {
      if (selectedHistoryItem) {
          setData(prev => ({
              ...prev,
              shipper: applyShipper ? {
                  ...prev.shipper,
                  name: selectedHistoryItem.shipper.name,
                  idNo: selectedHistoryItem.shipper.idNo,
                  tel: selectedHistoryItem.shipper.tel,
                  vatnos: selectedHistoryItem.shipper.vatnos || prev.shipper.vatnos
              } : prev.shipper,
              consignee: applyConsignee ? {
                  ...selectedHistoryItem.consignee
              } : prev.consignee
          }));
      }
      setShowAutofillModal(false);
      setSelectedHistoryItem(null);
      // Focus on the first item description field (item box) after selection
      focusField('row-0-desc');
  };

  const handleConsigneeChange = (field: string, value: string) => {
    setData(prev => ({
      ...prev,
      consignee: { ...prev.consignee, [field]: value }
    }));
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      slNo: data.cargoItems.length + 1,
      description: '',
      boxNo: 'B1', 
      qty: 0 // Default to 0 so it shows as empty field
    };
    setData(prev => ({ ...prev, cargoItems: [...prev.cargoItems, newItem] }));
    setShouldFocusNewRow(true);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...data.cargoItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setData(prev => ({ ...prev, cargoItems: newItems }));

    if (field === 'description') {
        const strVal = String(value).toUpperCase();
        if (savedItems.length > 0) {
            const matches = savedItems.filter(i => i.name.includes(strVal));
            // Only show if there is input and matches, OR if input is empty showing all might be too much but lets show if they match
            if (strVal && matches.length > 0) {
                setItemSuggestions(matches);
                setActiveItemRow(index);
            } else {
                setActiveItemRow(null);
            }
        }
    }
  };

  const handleSelectSavedItem = (index: number, name: string) => {
      updateItem(index, 'description', name);
      setActiveItemRow(null);
      // Optional: focus next field
      focusField(`row-${index}-box`);
  };

  const removeItem = (index: number) => {
      setData(prev => {
          const filtered = prev.cargoItems.filter((_, i) => i !== index);
          const reindexed = filtered.map((item, i) => ({ ...item, slNo: i + 1 }));
          
          if (reindexed.length === 0) {
              return {
                  ...prev,
                  cargoItems: [{ slNo: 1, description: '', boxNo: 'B1', qty: 0 }]
              };
          }
          return { ...prev, cargoItems: reindexed };
      });
  }

  // Navigation Helpers
  const focusField = (id: string) => {
      // Small timeout to allow render cycle if needed, though usually not strictly necessary for direct moves
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
            el.focus();
            if (el instanceof HTMLInputElement) el.select();
        }
      }, 10);
  };

  const handleEnter = (e: React.KeyboardEvent, nextId: string) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          focusField(nextId);
      }
  };

  // Handle navigation for continuous entry in items
  const handleItemKeyDown = (e: React.KeyboardEvent, idx: number, field: keyof InvoiceItem) => {
      // Logic for Quantity Field: Only allow digits and navigation keys
      if (field === 'qty') {
           // Allow: Backspace, Delete, Tab, Escape, Enter, Arrows
           const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
           if (!allowedKeys.includes(e.key) && !/^\d$/.test(e.key)) {
                e.preventDefault();
           }
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
          const isLastRow = idx === data.cargoItems.length - 1;
          
          if (field === 'description') {
               if (e.key === 'Enter') {
                   e.preventDefault();
                   if (activeItemRow === idx && itemSuggestions.length > 0) {
                       handleSelectSavedItem(idx, itemSuggestions[0].name);
                   } else {
                       focusField(`row-${idx}-box`);
                   }
               }
          } else if (field === 'boxNo') {
              if (e.key === 'Enter') {
                   e.preventDefault();
                   focusField(`row-${idx}-qty`);
               }
          } else if (field === 'qty') {
               if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isLastRow) {
                        // Strict validation: Only add row if Quantity is >= 1
                        if (data.cargoItems[idx].qty >= 1) {
                            addItem();
                        }
                    } else {
                        focusField(`row-${idx + 1}-desc`);
                    }
               }
               // Allow Tab to move to next field naturally or add item if needed, 
               // but strictly per request "upon pressing Enter", we leave Tab default behavior or handle similarly.
               // We will let Tab behave normally (move focus to delete button or next element).
          }
      }
  };

  const calculateFinancials = () => {
      const selectedType = shipmentTypes.find(t => t.name === data.shipmentType);
      const rate = selectedType ? selectedType.value : 0;
      
      const total = data.shipper.weight * rate;
      const billCharges = data.shipper.pcs * 40; 
      
      const vatRate = isVatEnabled ? 0.15 : 0;
      const vatAmount = (total + billCharges) * vatRate;
      const netTotal = total + billCharges + vatAmount;
      
      setData(prev => ({
          ...prev,
          financials: {
              ...prev.financials,
              total,
              billCharges,
              vat: vatRate * 100,
              vatAmount,
              netTotal
          }
      }));
  }
  
  const handleManualTotalChange = (val: number) => {
      const total = val;
      const billCharges = data.financials.billCharges;
      const vatRate = isVatEnabled ? 0.15 : 0;
      const vatAmount = (total + billCharges) * vatRate;
      const netTotal = total + billCharges + vatAmount;

      setData(prev => ({
          ...prev,
          financials: { ...prev.financials, total, vatAmount, netTotal }
      }));
  };

  const handleManualBillChargesChange = (val: number) => {
      const total = data.financials.total;
      const billCharges = val;
      const vatRate = isVatEnabled ? 0.15 : 0;
      const vatAmount = (total + billCharges) * vatRate;
      const netTotal = total + billCharges + vatAmount;

      setData(prev => ({
          ...prev,
          financials: { ...prev.financials, billCharges, vatAmount, netTotal }
      }));
  };

  const inputClass = "w-full border p-1 text-sm bg-gray-300 text-black placeholder-black border-gray-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const openSelectClass = "absolute top-[1.3rem] left-0 w-full z-50 shadow-xl border-blue-500 max-h-60 overflow-y-auto bg-white text-black";

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl mx-auto my-8 relative">
      
      {/* Autofill Modal */}
      {showAutofillModal && selectedHistoryItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] animate-fade-in p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b">
                    <h3 className="text-xl font-bold text-blue-900">Autofill Customer Details</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Selected Customer: <span className="font-semibold text-gray-800">{selectedHistoryItem.shipper.name}</span>
                    </p>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Shipper Section */}
                        <div className={`border rounded-lg p-4 transition-colors ${applyShipper ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-gray-50 border-gray-200 opacity-75'}`}>
                            <label className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={applyShipper} 
                                    onChange={(e) => setApplyShipper(e.target.checked)}
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className="font-bold text-lg text-gray-800">Shipper Details</span>
                            </label>
                            <div className="space-y-2 text-sm text-gray-700">
                                <div className="grid grid-cols-[80px_1fr]">
                                    <span className="font-semibold text-gray-500">Name:</span>
                                    <span>{selectedHistoryItem.shipper.name}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr]">
                                    <span className="font-semibold text-gray-500">ID No:</span>
                                    <span>{selectedHistoryItem.shipper.idNo}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr]">
                                    <span className="font-semibold text-gray-500">Mobile:</span>
                                    <span>{selectedHistoryItem.shipper.tel}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr]">
                                    <span className="font-semibold text-gray-500">VAT No:</span>
                                    <span>{selectedHistoryItem.shipper.vatnos || '-'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Consignee Section */}
                        <div className={`border rounded-lg p-4 transition-colors ${applyConsignee ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-gray-50 border-gray-200 opacity-75'}`}>
                            <label className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={applyConsignee} 
                                    onChange={(e) => setApplyConsignee(e.target.checked)}
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className="font-bold text-lg text-gray-800">Consignee Details</span>
                            </label>
                            <div className="space-y-2 text-sm text-gray-700">
                                <div className="grid grid-cols-[80px_1fr]">
                                    <span className="font-semibold text-gray-500">Name:</span>
                                    <span>{selectedHistoryItem.consignee.name}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr]">
                                    <span className="font-semibold text-gray-500">Address:</span>
                                    <span>{selectedHistoryItem.consignee.address}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr]">
                                    <span className="font-semibold text-gray-500">Location:</span>
                                    <span>
                                        {[
                                            selectedHistoryItem.consignee.post,
                                            selectedHistoryItem.consignee.district,
                                            selectedHistoryItem.consignee.state,
                                            selectedHistoryItem.consignee.country
                                        ].filter(Boolean).join(', ')}
                                    </span>
                                </div>
                                 <div className="grid grid-cols-[80px_1fr]">
                                    <span className="font-semibold text-gray-500">Pin:</span>
                                    <span>{selectedHistoryItem.consignee.pin}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr]">
                                    <span className="font-semibold text-gray-500">Mobile:</span>
                                    <span>{selectedHistoryItem.consignee.tel}</span>
                                </div>
                                {selectedHistoryItem.consignee.tel2 && (
                                  <div className="grid grid-cols-[80px_1fr]">
                                      <span className="font-semibold text-gray-500">Mobile 2:</span>
                                      <span>{selectedHistoryItem.consignee.tel2}</span>
                                  </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3">
                    <button 
                        onClick={() => setShowAutofillModal(false)}
                        className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleAutofillConfirm}
                        className="px-8 py-2.5 bg-blue-900 text-white font-bold rounded hover:bg-blue-800 shadow transition-colors"
                    >
                        Apply Selected Details
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">New Invoice Details</h2>
        <div className="flex gap-2">
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
                {isProcessing ? (
                    <span className="animate-pulse">Analyzing Image...</span>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 0011.586 3H8.414a1 1 0 00-.707.293L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        Autofill from Image
                    </>
                )}
            </button>
            <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
            />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Meta Info */}
        <div className="col-span-1 md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded border border-gray-200 order-1">
            <div>
                <label className="block text-xs font-bold text-gray-600">Invoice No</label>
                <input id="invoice-no" type="text" value={data.invoiceNo} onChange={e => setData({...data, invoiceNo: e.target.value})} className={inputClass} onKeyDown={(e) => handleEnter(e, 'date')} />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-600">Date</label>
                <input id="date" type="text" value={data.date} onChange={e => setData({...data, date: e.target.value})} className={inputClass} onKeyDown={(e) => handleEnter(e, 'shipment-type')} />
            </div>
            <div className="relative">
                <label className="block text-xs font-bold text-gray-600">Shipment Type</label>
                {/* Spacer to hold the grid height when absolute positioned */}
                <div className="h-[30px] w-full"></div>
                <select 
                    id="shipment-type"
                    value={data.shipmentType} 
                    autoFocus
                    size={isShipmentListOpen ? (Math.min(shipmentTypes.length + 1, 8)) : 1}
                    onFocus={() => setIsShipmentListOpen(true)}
                    onBlur={() => setIsShipmentListOpen(false)}
                    onChange={e => {
                        // Just update value on arrow key / click
                        setData({...data, shipmentType: e.target.value});
                    }} 
                    onClick={() => {
                        // Click confirms selection
                        if(isShipmentListOpen) {
                            setIsShipmentListOpen(false);
                            focusField('shipper-name');
                        }
                    }}
                    onKeyDown={(e) => {
                        // Enter or Tab confirms selection
                        if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            setIsShipmentListOpen(false);
                            focusField('shipper-name');
                        }
                        if (e.key === 'Escape') {
                            setIsShipmentListOpen(false);
                        }
                    }}
                    className={`${inputClass} ${isShipmentListOpen ? openSelectClass : 'absolute top-[1.3rem] left-0'}`}
                >
                    <option value="">Select Type</option>
                    {shipmentTypes.map((type) => (
                        <option key={type.name} value={type.name}>{type.name}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* Shipper */}
        <div className="border p-4 rounded bg-red-50 border-red-100 order-3 md:order-2">
          <h3 className="font-bold text-red-900 mb-3 border-b border-red-200 pb-1">Shipper Details</h3>
          <div className="space-y-2">
            <div className="relative">
                <label className="text-xs text-gray-600">Name</label>
                <input 
                    id="shipper-name"
                    className={inputClass} 
                    value={data.shipper.name} 
                    autoComplete="off"
                    onChange={e => handleShipperChange('name', e.target.value)}
                    onKeyDown={(e) => handleEnter(e, 'shipper-id')}
                />
                {/* Autocomplete Dropdown */}
                {showSuggestions && (
                    <ul ref={suggestionsRef} className="absolute z-50 w-full bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-y-auto top-full mt-1">
                        {suggestions.map((customer, idx) => (
                            <li 
                                key={idx}
                                onClick={() => handleSuggestionClick(customer)}
                                className="px-3 py-2 text-sm hover:bg-blue-100 cursor-pointer border-b last:border-0"
                            >
                                <div className="font-bold text-gray-800">{customer.shipper.name}</div>
                                <div className="text-xs text-gray-500">ID: {customer.shipper.idNo} | {customer.consignee.country}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-gray-600">ID No</label>
                    <input 
                        id="shipper-id"
                        className={inputClass} 
                        value={data.shipper.idNo} 
                        onChange={e => handleShipperChange('idNo', e.target.value)}
                        onKeyDown={(e) => handleEnter(e, 'shipper-mobile')}
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-600">Mobile</label>
                    <input 
                        id="shipper-mobile"
                        className={inputClass} 
                        value={data.shipper.tel} 
                        onChange={e => handleShipperChange('tel', e.target.value)}
                        onKeyDown={(e) => handleEnter(e, 'shipper-vat')}
                    />
                </div>
            </div>
            
            <div>
                <label className="text-xs text-gray-600">VAT No</label>
                <input 
                    id="shipper-vat"
                    className={inputClass} 
                    value={data.shipper.vatnos} 
                    onChange={e => handleShipperChange('vatnos', e.target.value)}
                    onKeyDown={(e) => handleEnter(e, 'shipper-pcs')}
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-gray-600">Pcs</label>
                    <input id="shipper-pcs" type="number" className={inputClass} value={data.shipper.pcs} onChange={e => handleShipperChange('pcs', Number(e.target.value))} onKeyDown={(e) => handleEnter(e, 'shipper-weight')} />
                </div>
                <div>
                    <label className="text-xs text-gray-600">Weight (KG)</label>
                    <input id="shipper-weight" type="number" className={inputClass} value={data.shipper.weight} onChange={e => handleShipperChange('weight', Number(e.target.value))} onKeyDown={(e) => handleEnter(e, 'consignee-name')} />
                </div>
            </div>
          </div>
        </div>

        {/* Consignee */}
        <div className="border p-4 rounded bg-blue-50 border-blue-100 order-2 md:order-3">
          <h3 className="font-bold text-blue-900 mb-3 border-b border-blue-200 pb-1">Consignee Details</h3>
          <div className="space-y-2">
            <div>
                <label className="text-xs text-gray-600">Name</label>
                <input id="consignee-name" className={inputClass} value={data.consignee.name} onChange={e => handleConsigneeChange('name', e.target.value)} onKeyDown={(e) => handleEnter(e, 'consignee-address')} />
            </div>
            <div>
                <label className="text-xs text-gray-600">Address</label>
                <input id="consignee-address" className={inputClass} value={data.consignee.address} onChange={e => handleConsigneeChange('address', e.target.value)} onKeyDown={(e) => handleEnter(e, 'consignee-post')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-gray-600">Post</label>
                    <input id="consignee-post" className={inputClass} value={data.consignee.post} onChange={e => handleConsigneeChange('post', e.target.value)} onKeyDown={(e) => handleEnter(e, 'consignee-district')} />
                </div>
                 <div>
                    <label className="text-xs text-gray-600">District</label>
                    <input id="consignee-district" className={inputClass} value={data.consignee.district} onChange={e => handleConsigneeChange('district', e.target.value)} onKeyDown={(e) => handleEnter(e, 'consignee-state')} />
                </div>
            </div>
             <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-gray-600">State</label>
                    <input id="consignee-state" className={inputClass} value={data.consignee.state} onChange={e => handleConsigneeChange('state', e.target.value)} onKeyDown={(e) => handleEnter(e, 'consignee-country')} />
                </div>
                <div>
                     <label className="text-xs text-gray-600">Country</label>
                     <input id="consignee-country" className={inputClass} value={data.consignee.country} onChange={e => handleConsigneeChange('country', e.target.value)} onKeyDown={(e) => handleEnter(e, 'consignee-pin')} />
                </div>
            </div>
            <div>
                <label className="text-xs text-gray-600">Pin</label>
                <input id="consignee-pin" className={inputClass} value={data.consignee.pin} onChange={e => handleConsigneeChange('pin', e.target.value)} onKeyDown={(e) => handleEnter(e, 'consignee-tel')} />
            </div>
             <div className="grid grid-cols-2 gap-2">
                 <div>
                     <label className="text-xs text-gray-600">Mobile</label>
                     <input id="consignee-tel" className={inputClass} value={data.consignee.tel} onChange={e => handleConsigneeChange('tel', e.target.value)} onKeyDown={(e) => handleEnter(e, 'consignee-tel2')} />
                </div>
                <div>
                     <label className="text-xs text-gray-600">Mobile 2</label>
                     <input 
                        id="consignee-tel2" 
                        className={inputClass} 
                        value={data.consignee.tel2} 
                        onChange={e => handleConsigneeChange('tel2', e.target.value)} 
                        onKeyDown={(e) => handleEnter(e, 'row-0-desc')} 
                    />
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="mt-6 border p-4 rounded bg-white order-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-gray-600">Cargo Items</h3>
            <span className="text-xs text-gray-500 italic">Press <strong>Enter</strong> or <strong>Tab</strong> on the last field to add a new row.</span>
          </div>
          <table className="w-full text-sm">
              <thead className="bg-gray-100">
                  <tr>
                      <th className="p-1 border text-left text-gray-600">Item</th>
                      <th className="p-1 border w-24 text-gray-600">Box No</th>
                      <th className="p-1 border w-24 text-gray-600">Qty</th>
                      <th className="p-1 border w-10 text-gray-600"></th>
                  </tr>
              </thead>
              <tbody>
                  {data.cargoItems.map((item, idx) => (
                      <tr key={idx}>
                          <td className="border p-1 relative">
                              <input 
                                id={`row-${idx}-desc`}
                                className={inputClass} 
                                value={item.description} 
                                autoComplete="off"
                                onChange={e => updateItem(idx, 'description', e.target.value)} 
                                onKeyDown={e => handleItemKeyDown(e, idx, 'description')}
                              />
                              {activeItemRow === idx && itemSuggestions.length > 0 && (
                                  <ul className="absolute z-50 left-0 w-full bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-y-auto top-full mt-1 item-suggestion-box">
                                      {itemSuggestions.map((s, sIdx) => (
                                          <li 
                                            key={s.id} 
                                            className="px-2 py-1 hover:bg-blue-100 cursor-pointer text-xs"
                                            onClick={() => handleSelectSavedItem(idx, s.name)}
                                          >
                                              {s.name}
                                          </li>
                                      ))}
                                  </ul>
                              )}
                          </td>
                          <td className="border p-1">
                              <input 
                                id={`row-${idx}-box`}
                                className={`${inputClass} text-center`} 
                                value={item.boxNo} 
                                onChange={e => updateItem(idx, 'boxNo', e.target.value)} 
                                onKeyDown={e => handleItemKeyDown(e, idx, 'boxNo')}
                              />
                          </td>
                          <td className="border p-1">
                              <input 
                                id={`row-${idx}-qty`}
                                type="number" 
                                min="0"
                                className={`${inputClass} text-center`} 
                                value={item.qty === 0 ? '' : item.qty} 
                                onChange={e => updateItem(idx, 'qty', e.target.value === '' ? 0 : parseFloat(e.target.value))} 
                                onKeyDown={e => handleItemKeyDown(e, idx, 'qty')}
                              />
                          </td>
                          <td className="border p-1 text-center">
                              <button onClick={() => removeItem(idx)} className="text-red-500 font-bold">&times;</button>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

      {/* Financials Manual Override */}
      <div className="mt-6 border p-4 rounded bg-gray-50 flex flex-col md:flex-row gap-8 justify-end order-5">
           <div className="flex flex-col items-start gap-1">
               <button onClick={calculateFinancials} className="text-blue-600 underline text-xs">Auto-Calculate defaults</button>
               <span className="text-xs text-gray-500 max-w-[200px]">Calculation based on weight * shipment type value + bill charges.</span>
               {isVatEnabled && <span className="text-xs text-green-600 font-bold">VAT (15%) Enabled</span>}
           </div>
           <div className="w-full md:w-64 space-y-2">
               <div className="flex justify-between items-center">
                   <label className="text-sm font-bold text-gray-600">Total</label>
                   <input 
                        type="number" 
                        className="w-24 text-right p-1 bg-gray-300 text-black rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                        value={data.financials.total} 
                        onChange={e => handleManualTotalChange(Number(e.target.value))} 
                    />
               </div>
               <div className="flex justify-between items-center">
                   <label className="text-sm font-bold text-gray-600">Bill Charges</label>
                   <input 
                        type="number" 
                        className="w-24 text-right p-1 bg-gray-300 text-black rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                        value={data.financials.billCharges} 
                        onChange={e => handleManualBillChargesChange(Number(e.target.value))} 
                    />
               </div>
               {isVatEnabled && (
                   <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-gray-600">VAT (15%)</label>
                        <input 
                            type="number" 
                            disabled
                            className="w-24 text-right p-1 bg-gray-200 text-gray-600 rounded" 
                            value={data.financials.vatAmount.toFixed(2)} 
                        />
                   </div>
               )}
               <div className="flex justify-between items-center bg-gray-300 p-1 rounded">
                   <label className="text-sm font-bold text-gray-600">Net Total</label>
                   <input 
                        type="number" 
                        className="w-24 text-right p-1 font-bold bg-gray-300 text-black rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                        value={data.financials.netTotal} 
                        readOnly
                   />
               </div>
           </div>
      </div>

      <div className="mt-8 flex justify-end gap-4 order-6">
        <button onClick={onCancel} className="px-6 py-2 border rounded text-gray-600 hover:bg-gray-100">Cancel</button>
        <button onClick={() => onSubmit(data)} className="px-6 py-2 bg-blue-900 text-white rounded hover:bg-blue-800 shadow">Generate Invoice</button>
      </div>
    </div>
  );
};

export default InvoiceForm;

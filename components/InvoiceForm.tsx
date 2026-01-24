

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { InvoiceData, InvoiceItem, ShipmentType, ItemMaster, SavedCustomer } from '../types';
import { extractInvoiceData, fileToGenerativePart } from '../services/geminiService';

interface InvoiceFormProps {
  initialData: InvoiceData;
  onSubmit: (data: InvoiceData) => void;
  onCancel: () => void;
  shipmentTypes: ShipmentType[];
  history?: InvoiceData[];
  isVatEnabled: boolean;
  savedItems?: ItemMaster[];
  savedCustomers?: SavedCustomer[];
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ initialData, onSubmit, onCancel, shipmentTypes, history = [], isVatEnabled, savedItems = [], savedCustomers = [] }) => {
  // Ensure at least one item exists
  const ensureItems = (items: InvoiceItem[]) => {
      if (!items || items.length === 0) {
          return [{
              slNo: 1,
              description: '',
              boxNo: 'B1',
              qty: 0,
              weight: 0
          }];
      }
      return items.map(i => ({...i, weight: i.weight || 0}));
  };

  const [data, setData] = useState<InvoiceData>({
      ...initialData,
      cargoItems: ensureItems(initialData.cargoItems),
      status: initialData.status || 'Received', // Ensure default
      paymentMode: initialData.paymentMode || 'CASH',
      splitDetails: initialData.splitDetails || { cash: 0, bank: 0 }
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
  
  // Box Closing / Weight Modal State
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [tempBoxWeight, setTempBoxWeight] = useState('');
  const [boxToCloseIndex, setBoxToCloseIndex] = useState<number | null>(null);
  
  // Checkbox states for the modal
  const [applyShipper, setApplyShipper] = useState(true);
  const [applyConsignee, setApplyConsignee] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);

  // Derive unique customers from history AND savedCustomers for autocomplete
  const uniqueCustomers = useMemo(() => {
      const map = new Map<string, InvoiceData>();
      savedCustomers.forEach(sc => {
          if (sc.shipper.name) {
              const key = sc.shipper.name.trim().toLowerCase();
              map.set(key, {
                  invoiceNo: 'SAVED',
                  date: '',
                  shipmentType: '',
                  status: 'Received',
                  cargoItems: [],
                  financials: { total: 0, billCharges: 0, vat: 0, vatAmount: 0, netTotal: 0 },
                  shipper: {
                      ...sc.shipper,
                      pcs: 0,
                      weight: 0
                  },
                  consignee: {
                      ...sc.consignee
                  }
              });
          }
      });

      history.forEach(inv => {
          if (inv.shipper.name) {
              const key = inv.shipper.name.trim().toLowerCase();
              if (!map.has(key)) {
                  map.set(key, inv);
              }
          }
      });
      return Array.from(map.values());
  }, [history, savedCustomers]);

  // Handle clicking outside suggestions to close them
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
              setShowSuggestions(false);
          }
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

  // Focus weight input when modal opens
  useEffect(() => {
      if (showWeightModal && weightInputRef.current) {
          setTimeout(() => weightInputRef.current?.focus(), 50);
      }
  }, [showWeightModal]);

  // Recalculate total weight and pcs whenever items change
  useEffect(() => {
      const calculatedWeight = data.cargoItems.reduce((sum, item) => sum + (item.weight || 0), 0);
      
      // Calculate unique boxes (Pcs)
      const uniqueBoxes = new Set(data.cargoItems.map(i => i.boxNo)).size;

      if (calculatedWeight !== data.shipper.weight || uniqueBoxes !== data.shipper.pcs) {
          setData(prev => ({
              ...prev,
              shipper: { 
                  ...prev.shipper, 
                  weight: calculatedWeight,
                  pcs: uniqueBoxes
              }
          }));
      }
  }, [data.cargoItems]);

  // Recalculate financials when weight/pcs changes (or if data changes generally, but we rely on explicit calls mostly)
  // Actually, standard practice is to auto-calc financials if weight/pcs changes.
  // We'll leave the manual trigger unless requested, but let's ensure split logic updates if total changes.
  useEffect(() => {
      if (data.paymentMode === 'SPLIT') {
          // If total changes, rebalance split. Prioritize keeping cash amount, adjust bank.
          const total = data.financials.netTotal;
          const currentCash = data.splitDetails?.cash || 0;
          let newCash = currentCash;
          
          if (newCash > total) newCash = total;
          const newBank = total - newCash;

          if (newCash !== data.splitDetails?.cash || newBank !== data.splitDetails?.bank) {
             setData(prev => ({
                 ...prev,
                 splitDetails: { cash: newCash, bank: newBank }
             }));
          }
      }
  }, [data.financials.netTotal, data.paymentMode]);

  // Calculate box weights summary
  const boxWeightsSummary = useMemo(() => {
    const weightMap = new Map<string, number>();
    data.cargoItems.forEach(item => {
        if (item.boxNo) {
            const current = weightMap.get(item.boxNo) || 0;
            weightMap.set(item.boxNo, current + (item.weight || 0));
        }
    });

    const summaryParts: string[] = [];
    weightMap.forEach((weight, boxNo) => {
        if (weight > 0) {
            summaryParts.push(`${boxNo}=${parseFloat(weight.toFixed(3))}Kg`);
        }
    });
    
    return summaryParts.join(', ');
  }, [data.cargoItems]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const base64 = await fileToGenerativePart(file);
      const extractedData = await extractInvoiceData(base64);
      
      setData(prev => ({
        ...prev,
        ...extractedData,
        shipper: { ...prev.shipper, ...extractedData.shipper },
        consignee: { ...prev.consignee, ...extractedData.consignee },
        financials: { ...prev.financials, ...extractedData.financials },
        cargoItems: ensureItems(extractedData.cargoItems || prev.cargoItems)
      }));
    } catch (error) {
      alert("Failed to extract data. Please try again or enter manually.");
      console.error(error);
    } finally {
      setIsProcessing(false);
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
      focusField('row-0-desc');
  };

  const handleConsigneeChange = (field: string, value: string) => {
    setData(prev => ({
      ...prev,
      consignee: { ...prev.consignee, [field]: value }
    }));
  };

  // --- Box Logic ---

  const getNextBoxNo = (current: string) => {
      const match = current.match(/^([a-zA-Z]*)(\d+)$/);
      if (match) {
          const prefix = match[1];
          const num = parseInt(match[2], 10);
          return `${prefix}${num + 1}`;
      }
      return current; // Fallback if pattern doesn't match
  };

  const handleCloseBoxRequest = (index: number) => {
      // Validate: Don't close if qty is 0 or empty description? (Optional)
      // For now, just open modal
      setBoxToCloseIndex(index);
      setTempBoxWeight('');
      setShowWeightModal(true);
  };

  const handleWeightAction = (createNew: boolean) => {
      if (boxToCloseIndex === null) return;

      const weightVal = parseFloat(tempBoxWeight);
      if (isNaN(weightVal) || weightVal < 0) {
          alert("Please enter a valid weight");
          return;
      }

      setData(prev => {
          // 1. Update current item weight
          const updatedItems = [...prev.cargoItems];
          updatedItems[boxToCloseIndex] = {
              ...updatedItems[boxToCloseIndex],
              weight: weightVal
          };

          // 2. Add new item automatically with next box number IF requested
          if (createNew) {
              const currentBoxNo = updatedItems[boxToCloseIndex].boxNo;
              const newItem: InvoiceItem = {
                  slNo: updatedItems.length + 1,
                  description: '', // Empty description for next item
                  boxNo: getNextBoxNo(currentBoxNo),
                  qty: 0,
                  weight: 0
              };
              return { ...prev, cargoItems: [...updatedItems, newItem] };
          }

          return { ...prev, cargoItems: updatedItems };
      });

      setShowWeightModal(false);
      setBoxToCloseIndex(null);
      setTempBoxWeight('');
      
      if (createNew) {
        setShouldFocusNewRow(true); // Will focus the description of the new row
      }
  };
  
  const addItemRow = (currentIndex: number) => {
        setData(prev => {
            const currentItems = prev.cargoItems;
            const currentItem = currentItems[currentIndex];
            
            const newItem: InvoiceItem = {
                slNo: currentItems.length + 1,
                description: '',
                boxNo: currentItem.boxNo, // Keep same box number
                qty: 0,
                weight: 0
            };
            
            return {
                ...prev,
                cargoItems: [...currentItems, newItem]
            };
        });
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
      focusField(`row-${index}-box`);
  };

  const removeItem = (index: number) => {
      setData(prev => {
          const filtered = prev.cargoItems.filter((_, i) => i !== index);
          const reindexed = filtered.map((item, i) => ({ ...item, slNo: i + 1 }));
          
          if (reindexed.length === 0) {
              return {
                  ...prev,
                  cargoItems: [{ slNo: 1, description: '', boxNo: 'B1', qty: 0, weight: 0 }]
              };
          }
          return { ...prev, cargoItems: reindexed };
      });
  }

  // Navigation Helpers
  const focusField = (id: string) => {
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
      // Shortcut to Close Box: Alt + Enter
      if (e.key === 'Enter' && e.altKey) {
          e.preventDefault();
          handleCloseBoxRequest(idx);
          return;
      }

      // Logic for Quantity Field
      if (field === 'qty') {
           const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
           if (!allowedKeys.includes(e.key) && !/^\d$/.test(e.key) && !e.altKey) {
                e.preventDefault();
           }
      }

      if (e.key === 'Enter') {
          if (field === 'description') {
               e.preventDefault();
               if (activeItemRow === idx && itemSuggestions.length > 0) {
                   handleSelectSavedItem(idx, itemSuggestions[0].name);
               } else {
                   focusField(`row-${idx}-box`);
               }
          } else if (field === 'boxNo') {
               e.preventDefault();
               focusField(`row-${idx}-qty`);
          } 
          else if (field === 'qty') {
              e.preventDefault(); 
              // Enter alone adds a new row with same box number
              addItemRow(idx);
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

  const handlePaymentModeChange = (mode: 'CASH' | 'BANK' | 'SPLIT') => {
      setData(prev => {
          let split = { cash: 0, bank: 0 };
          if (mode === 'SPLIT') {
             // Initialize split: Cash 0, Bank = Net Total
             split = { cash: 0, bank: prev.financials.netTotal };
          }
          return { ...prev, paymentMode: mode, splitDetails: split };
      });
  };

  const handleSplitChange = (type: 'cash' | 'bank', value: number) => {
      const total = data.financials.netTotal;
      let val = value;
      if (val < 0) val = 0;
      if (val > total) val = total;

      if (type === 'cash') {
          setData(prev => ({
              ...prev,
              splitDetails: { cash: val, bank: total - val }
          }));
      } else {
          setData(prev => ({
              ...prev,
              splitDetails: { bank: val, cash: total - val }
          }));
      }
  };

  const handleFormSubmit = () => {
      // Validate Split Logic
      if (data.paymentMode === 'SPLIT') {
          const sum = (data.splitDetails?.cash || 0) + (data.splitDetails?.bank || 0);
          if (Math.abs(sum - data.financials.netTotal) > 0.1) {
              alert(`Split amounts (SAR ${sum.toFixed(2)}) do not match Net Total (SAR ${data.financials.netTotal.toFixed(2)}). Please adjust.`);
              return;
          }
      }
      onSubmit(data);
  };

  const inputClass = "w-full border p-1 text-sm bg-gray-300 text-black placeholder-black border-gray-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const openSelectClass = "absolute top-[1.3rem] left-0 w-full z-50 shadow-xl border-blue-500 max-h-60 overflow-y-auto bg-white text-black";

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl mx-auto my-8 relative">
      
      {/* Weight Input Modal */}
      {showWeightModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70]">
              <div className="bg-white p-6 rounded-lg shadow-2xl w-96 animate-fade-in border-t-4 border-blue-600">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Enter Box Weight</h3>
                  <div className="mb-4">
                      <label className="block text-sm text-gray-600 mb-1">Weight (KG)</label>
                      <input 
                          ref={weightInputRef}
                          type="number" 
                          step="0.01"
                          className="w-full border-2 border-blue-500 rounded p-2 text-xl font-bold text-center focus:outline-none"
                          value={tempBoxWeight}
                          onChange={e => setTempBoxWeight(e.target.value)}
                          onKeyDown={(e) => {
                             if(e.key === 'Enter') {
                                 e.preventDefault();
                                 if (e.altKey) {
                                     handleWeightAction(false); // Close Box
                                 } else {
                                     handleWeightAction(true); // Confirm & New
                                 }
                             }
                          }}
                          placeholder="0.00"
                      />
                  </div>
                  <div className="flex justify-between items-center gap-2 mt-6">
                      <button 
                          type="button" 
                          onClick={() => setShowWeightModal(false)}
                          className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded text-sm font-medium"
                      >
                          Cancel
                      </button>
                      <div className="flex gap-2">
                        <button 
                            type="button"
                            onClick={() => handleWeightAction(false)}
                            className="px-4 py-2 bg-gray-200 text-gray-800 font-bold rounded hover:bg-gray-300 text-sm"
                        >
                            Close Box
                        </button>
                        <button 
                            type="button"
                            onClick={() => handleWeightAction(true)}
                            className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow text-sm"
                        >
                            Confirm & New
                        </button>
                      </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">Shortcuts: Enter (New) | Alt+Enter (Close)</p>
              </div>
          </div>
      )}

      {/* Autofill Modal (Existing) */}
      {showAutofillModal && selectedHistoryItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] animate-fade-in p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b">
                    <h3 className="text-xl font-bold text-blue-900">Autofill Customer Details</h3>
                    <div className="text-sm text-gray-600 mt-1 flex justify-between items-center">
                        <p>Selected Customer: <span className="font-semibold text-gray-800">{selectedHistoryItem.shipper.name}</span></p>
                        {selectedHistoryItem.invoiceNo === 'SAVED' && (
                            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold">Saved Contact</span>
                        )}
                    </div>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    {/* ... (Same modal content as before) ... */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                <div className="grid grid-cols-[80px_1fr]"><span className="font-semibold text-gray-500">Name:</span><span>{selectedHistoryItem.shipper.name}</span></div>
                                <div className="grid grid-cols-[80px_1fr]"><span className="font-semibold text-gray-500">Mobile:</span><span>{selectedHistoryItem.shipper.tel}</span></div>
                            </div>
                        </div>
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
                                <div className="grid grid-cols-[80px_1fr]"><span className="font-semibold text-gray-500">Name:</span><span>{selectedHistoryItem.consignee.name}</span></div>
                                <div className="grid grid-cols-[80px_1fr]"><span className="font-semibold text-gray-500">Mobile:</span><span>{selectedHistoryItem.consignee.tel}</span></div>
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
                <div className="h-[30px] w-full"></div>
                <select 
                    id="shipment-type"
                    value={data.shipmentType} 
                    autoFocus
                    size={isShipmentListOpen ? (Math.min(shipmentTypes.length + 1, 8)) : 1}
                    onFocus={() => setIsShipmentListOpen(true)}
                    onBlur={() => setIsShipmentListOpen(false)}
                    onChange={e => {
                        setData({...data, shipmentType: e.target.value});
                    }} 
                    onClick={() => {
                        if(isShipmentListOpen) {
                            setIsShipmentListOpen(false);
                            focusField('shipper-name');
                        }
                    }}
                    onKeyDown={(e) => {
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
        <div className="border p-4 rounded bg-red-50 border-red-100 order-2 md:order-2">
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
                {showSuggestions && (
                    <ul ref={suggestionsRef} className="absolute z-50 w-full bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-y-auto top-full mt-1">
                        {suggestions.map((customer, idx) => (
                            <li 
                                key={idx}
                                onClick={() => handleSuggestionClick(customer)}
                                className="px-3 py-2 text-sm hover:bg-blue-100 cursor-pointer border-b last:border-0"
                            >
                                <div className="font-bold text-gray-800">
                                    {customer.shipper.name}
                                    {customer.invoiceNo === 'SAVED' && <span className="ml-2 text-green-600 text-xs">(Saved)</span>}
                                </div>
                                <div className="text-xs text-gray-500">ID: {customer.shipper.idNo}</div>
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
                        onKeyDown={(e) => handleEnter(e, 'consignee-name')}
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
                    onKeyDown={(e) => handleEnter(e, 'consignee-name')}
                />
            </div>
          </div>
        </div>

        {/* Consignee */}
        <div className="border p-4 rounded bg-blue-50 border-blue-100 order-3 md:order-3">
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
            <span className="text-xs text-gray-500 italic">Shortcut: Press <strong>Enter</strong> or <strong>Tab</strong> after Qty to add a new row / Press <strong>Alt + Enter</strong> after Qty to close or Add New Box</span>
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
                              <button onClick={() => removeItem(idx)} className="text-red-500 font-bold hover:bg-red-100 rounded px-2">&times;</button>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
          <div className="mt-2 flex flex-col items-center justify-center gap-2">
              <button 
                  onClick={() => handleCloseBoxRequest(data.cargoItems.length - 1)}
                  className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700 font-bold text-sm flex items-center gap-2"
              >
                  <span>Close or Add New Box</span>
                  <span className="bg-green-800 text-xs px-1 rounded">Alt + Enter</span>
              </button>
              {boxWeightsSummary && (
                  <div className="text-xs text-blue-800 font-semibold bg-blue-50 px-3 py-1 rounded border border-blue-100 animate-fade-in">
                      {boxWeightsSummary}
                  </div>
              )}
          </div>
      </div>

      {/* Financials Manual Override */}
      <div className="mt-6 border p-4 rounded bg-gray-50 flex flex-col md:flex-row gap-8 justify-between order-5">
           <div className="flex flex-col gap-4">
               {/* Moved Fields: Pcs and Total Weight */}
               <div className="flex gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-600 mb-1">Total Pcs</label>
                        <input 
                            id="shipper-pcs" 
                            type="number" 
                            className="w-32 border p-2 text-sm bg-gray-200 text-gray-700 font-bold rounded focus:outline-none" 
                            value={data.shipper.pcs} 
                            readOnly
                            tabIndex={-1}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-600 mb-1">Total Weight</label>
                        <input 
                            id="shipper-weight" 
                            type="number" 
                            className="w-32 border p-2 text-sm bg-gray-200 text-gray-700 font-bold rounded focus:outline-none" 
                            value={data.shipper.weight} 
                            readOnly 
                            tabIndex={-1} 
                        />
                    </div>
               </div>

               <div className="flex flex-col items-start gap-1">
                   <button onClick={calculateFinancials} className="text-blue-600 underline text-xs">Auto-Calculate defaults</button>
                   <span className="text-xs text-gray-500 max-w-[200px]">Calculation based on total weight * shipment type value + bill charges.</span>
                   {isVatEnabled && <span className="text-xs text-green-600 font-bold">VAT (15%) Enabled</span>}
               </div>
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

                {/* Payment Mode Selector */}
                <div className="mt-4 pt-4 border-t border-gray-300">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Payment Mode</label>
                    <div className="flex gap-2 mb-2">
                        {['CASH', 'BANK', 'SPLIT'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => handlePaymentModeChange(mode as 'CASH' | 'BANK' | 'SPLIT')}
                                className={`flex-1 py-1 text-[10px] font-bold rounded border transition-colors ${data.paymentMode === mode ? 'bg-blue-900 text-white border-blue-900' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'}`}
                            >
                                {mode === 'BANK' ? 'CARD/BANK' : mode}
                            </button>
                        ))}
                    </div>
                    
                    {data.paymentMode === 'SPLIT' && (
                        <div className="bg-yellow-50 p-2 rounded border border-yellow-200 text-xs animate-fade-in">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-600 font-semibold">Cash</span>
                                <input 
                                    type="number" 
                                    value={data.splitDetails?.cash || 0}
                                    onChange={(e) => handleSplitChange('cash', parseFloat(e.target.value) || 0)}
                                    className="w-24 text-right border border-yellow-300 rounded p-1 focus:outline-none focus:border-blue-500 bg-white"
                                />
                            </div>
                             <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-semibold">Bank</span>
                                <input 
                                    type="number" 
                                    value={data.splitDetails?.bank || 0}
                                    onChange={(e) => handleSplitChange('bank', parseFloat(e.target.value) || 0)}
                                    className="w-24 text-right border border-yellow-300 rounded p-1 focus:outline-none focus:border-blue-500 bg-white"
                                />
                            </div>
                        </div>
                    )}
                </div>

           </div>
      </div>

      <div className="mt-8 flex justify-end gap-4 order-6">
        <button onClick={onCancel} className="px-6 py-2 border rounded text-gray-600 hover:bg-gray-100">Cancel</button>
        <button onClick={handleFormSubmit} className="px-6 py-2 bg-blue-900 text-white rounded hover:bg-blue-800 shadow">Generate Invoice</button>
      </div>
    </div>
  );
};

export default InvoiceForm;

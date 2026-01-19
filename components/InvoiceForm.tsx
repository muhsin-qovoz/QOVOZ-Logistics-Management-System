
import React, { useState, useRef, useEffect } from 'react';
import { InvoiceData, InvoiceItem, ShipmentType } from '../types';
import { extractInvoiceData, fileToGenerativePart } from '../services/geminiService';

interface InvoiceFormProps {
  initialData: InvoiceData;
  onSubmit: (data: InvoiceData) => void;
  onCancel: () => void;
  shipmentTypes: ShipmentType[];
  history?: InvoiceData[];
  isVatEnabled: boolean;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ initialData, onSubmit, onCancel, shipmentTypes, history = [], isVatEnabled }) => {
  // Ensure at least one item exists
  const ensureItems = (items: InvoiceItem[]) => {
      if (!items || items.length === 0) {
          return [{
              slNo: 1,
              description: '',
              boxNo: 'B1',
              qty: 1
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
  const [matchCandidate, setMatchCandidate] = useState<InvoiceData | null>(null);
  const [shouldFocusNewRow, setShouldFocusNewRow] = useState(false);
  
  // State to control the "Expanded" look of the Shipment Type dropdown
  const [isShipmentListOpen, setIsShipmentListOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
  };

  const handleConsigneeChange = (field: string, value: string) => {
    setData(prev => ({
      ...prev,
      consignee: { ...prev.consignee, [field]: value }
    }));
  };

  const handleCheckHistory = (type: 'NAME' | 'ID' | 'MOBILE', value: string) => {
      if (!value) return;
      const normalizedValue = value.trim().toLowerCase();
      
      const found = history.find(inv => {
          if (type === 'NAME') return inv.shipper.name.toLowerCase() === normalizedValue;
          if (type === 'ID') return inv.shipper.idNo === normalizedValue;
          if (type === 'MOBILE') return inv.shipper.tel === normalizedValue;
          return false;
      });

      if (found) {
          setMatchCandidate(found);
      }
  };

  const applyAutoFill = () => {
      if (!matchCandidate) return;

      setData(prev => ({
          ...prev,
          shipper: {
              ...prev.shipper,
              name: matchCandidate.shipper.name,
              idNo: matchCandidate.shipper.idNo,
              tel: matchCandidate.shipper.tel,
              vatnos: matchCandidate.shipper.vatnos || prev.shipper.vatnos
          },
          consignee: {
              ...matchCandidate.consignee
          }
      }));
      setMatchCandidate(null);
      // After auto-fill, focus on Items
      focusField('row-0-desc');
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      slNo: data.cargoItems.length + 1,
      description: '',
      boxNo: 'B1', 
      qty: 1
    };
    setData(prev => ({ ...prev, cargoItems: [...prev.cargoItems, newItem] }));
    setShouldFocusNewRow(true);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...data.cargoItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setData(prev => ({ ...prev, cargoItems: newItems }));
  };

  const removeItem = (index: number) => {
      setData(prev => {
          const filtered = prev.cargoItems.filter((_, i) => i !== index);
          const reindexed = filtered.map((item, i) => ({ ...item, slNo: i + 1 }));
          
          if (reindexed.length === 0) {
              return {
                  ...prev,
                  cargoItems: [{ slNo: 1, description: '', boxNo: 'B1', qty: 1 }]
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
      if (e.key === 'Enter' || e.key === 'Tab') {
          const isLastRow = idx === data.cargoItems.length - 1;
          
          if (field === 'description') {
               if (e.key === 'Enter') {
                   e.preventDefault();
                   focusField(`row-${idx}-box`);
               }
          } else if (field === 'boxNo') {
              if (e.key === 'Enter') {
                   e.preventDefault();
                   focusField(`row-${idx}-qty`);
               }
          } else if (field === 'qty') {
               if (isLastRow) {
                   if (!e.shiftKey) { 
                        e.preventDefault();
                        addItem();
                   }
               } else {
                   if (e.key === 'Enter') {
                       e.preventDefault();
                       focusField(`row-${idx + 1}-desc`);
                   }
               }
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
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl mx-auto my-8">
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

      {matchCandidate && (
          <div className="mb-6 bg-blue-50 border border-blue-200 p-4 rounded-md flex flex-col md:flex-row justify-between items-center gap-4 animate-fade-in">
              <div>
                  <div className="flex items-center gap-2 text-blue-800 font-bold">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Previous Record Found
                  </div>
                  <div className="text-sm text-blue-700 mt-1">
                      Shipper: <b>{matchCandidate.shipper.name}</b> &rarr; Consignee: <b>{matchCandidate.consignee.name}</b>
                  </div>
              </div>
              <div className="flex gap-3">
                  <button 
                      onClick={() => setMatchCandidate(null)}
                      className="px-4 py-1 text-sm text-blue-600 hover:bg-blue-100 rounded"
                  >
                      Dismiss
                  </button>
                  <button 
                      onClick={applyAutoFill}
                      className="px-4 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded font-bold shadow-sm"
                  >
                      Autofill All Details
                  </button>
              </div>
          </div>
      )}

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
            <div>
                <label className="text-xs text-gray-600">Name</label>
                <input 
                    id="shipper-name"
                    className={inputClass} 
                    value={data.shipper.name} 
                    onChange={e => handleShipperChange('name', e.target.value)}
                    onBlur={(e) => handleCheckHistory('NAME', e.target.value)}
                    onKeyDown={(e) => handleEnter(e, 'shipper-id')}
                />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-gray-600">ID No</label>
                    <input 
                        id="shipper-id"
                        className={inputClass} 
                        value={data.shipper.idNo} 
                        onChange={e => handleShipperChange('idNo', e.target.value)}
                        onBlur={(e) => handleCheckHistory('ID', e.target.value)}
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
                        onBlur={(e) => handleCheckHistory('MOBILE', e.target.value)}
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
                          <td className="border p-1">
                              <input 
                                id={`row-${idx}-desc`}
                                className={inputClass} 
                                value={item.description} 
                                onChange={e => updateItem(idx, 'description', e.target.value)} 
                                onKeyDown={e => handleItemKeyDown(e, idx, 'description')}
                              />
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
                                className={`${inputClass} text-center`} 
                                value={item.qty} 
                                onChange={e => updateItem(idx, 'qty', Number(e.target.value))} 
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

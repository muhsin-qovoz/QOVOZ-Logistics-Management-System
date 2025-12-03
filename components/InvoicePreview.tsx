
import React from 'react';
import { InvoiceData, AppSettings } from '../types';

interface InvoicePreviewProps {
  data: InvoiceData;
  settings: AppSettings;
  onBack: () => void;
}

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ data, settings, onBack }) => {
  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-500 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl no-print mb-4 flex justify-between">
        <button onClick={onBack} className="bg-gray-700 text-white px-4 py-2 rounded shadow hover:bg-gray-600 transition">
          &larr; Back to Dashboard
        </button>
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-500 transition font-bold">
          Print Invoice
        </button>
      </div>

      {/* Actual Paper Representation */}
      <div className="bg-white w-[210mm] min-h-[297mm] p-8 shadow-2xl text-xs font-sans text-gray-900 relative">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
            <div className="w-1/3">
                <div className="flex items-center gap-2 mb-2">
                    {settings.logoUrl ? (
                         <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
                    ) : (
                         <div className="text-3xl font-serif font-bold text-red-900 tracking-tighter uppercase break-words">
                            {settings.companyName.split(' ')[0]}
                            <span className="block text-xl text-gray-700">{settings.companyName.split(' ').slice(1).join(' ')}</span>
                        </div>
                    )}
                </div>
                <div className="font-bold text-blue-900 text-sm uppercase">{settings.addressLine1}</div>
                <div className="font-bold text-blue-900 text-sm uppercase">{settings.addressLine2}</div>
            </div>

            <div className="flex flex-col items-center">
                 <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=Invoice:${data.invoiceNo}|Date:${data.date}|Total:${data.financials.netTotal}`} alt="QR" className="w-20 h-20" />
            </div>

            <div className="w-1/3 text-right">
                <div className="text-xl font-bold text-red-900 uppercase">{settings.companyName}</div>
                <div className="font-arabic text-right my-1 text-lg font-bold text-gray-800">{settings.companyArabicName}</div>
                {settings.addressLine1Arabic && (
                    <div className="font-arabic text-right text-sm text-gray-700 font-bold">{settings.addressLine1Arabic}</div>
                )}
                {settings.addressLine2Arabic && (
                    <div className="font-arabic text-right text-sm text-gray-700 font-bold">{settings.addressLine2Arabic}</div>
                )}
                
                <div className="font-bold text-sm mt-1">{settings.phone1} /</div>
                <div className="font-bold text-sm">{settings.phone2}</div>
            </div>
        </div>

        {/* Invoice Meta Bar */}
        <div className="w-full bg-red-900 text-white flex justify-between items-center px-4 py-1 mb-1 text-xs">
            <div>DATE: {data.date}</div>
            <div className="flex flex-col items-center leading-none">
                <span>فاتورة ضريبة مبسطة</span>
                <span>SIMPLIFIED TAX INVOICE</span>
            </div>
            <div className="text-right">
                <div className="bg-white text-red-900 px-1 text-[10px] font-bold rounded-sm mb-[2px]">TRK{data.invoiceNo}X99</div>
                <div className="text-sm font-bold">INV:{data.invoiceNo}</div>
            </div>
        </div>
        <div className="w-full bg-red-900 text-white px-4 py-1 text-xs mb-4">
             SHIPMENT TYPE: {data.shipmentType}
        </div>


        {/* Shipper & Consignee Grid */}
        <div className="flex border-b-2 border-red-900 pb-1 mb-1">
            {/* Shipper */}
            <div className="w-1/2 pr-2 border-r border-gray-300">
                <div className="bg-red-900 text-white inline-block px-2 py-0.5 rounded-sm mb-2 font-bold text-[10px]">SHIPPER</div>
                <div className="grid grid-cols-[80px_1fr] gap-y-1 text-[11px] font-semibold">
                    <div>NAME</div><div>: {data.shipper.name}</div>
                    <div>ID NO</div><div>: {data.shipper.idNo}</div>
                    <div>Mobile</div><div>: {data.shipper.tel}</div>
                    <div>NO. OF PCS</div><div>: {data.shipper.pcs}</div>
                    <div>WEIGHT</div><div>: {data.shipper.weight.toFixed(3)} KG</div>
                    {data.shipper.vatnos && (
                        <>
                            <div>VAT NO</div><div>: {data.shipper.vatnos}</div>
                        </>
                    )}
                </div>
            </div>

            {/* Consignee */}
            <div className="w-1/2 pl-2 relative">
                <div className="bg-red-900 text-white inline-block px-2 py-0.5 rounded-sm mb-2 font-bold text-[10px]">CONSIGNEE</div>
                
                {/* Consignee Top Right Box */}
                 <div className="absolute top-0 right-0 border border-black text-[10px] text-center w-38">
                     <div className="flex border-b border-black">
                         <div className="w-8 border-r border-black bg-gray-100">S.NO</div>
                         <div className="w-20 border-r border-black bg-gray-100">BOX NO.</div>
                         <div className="flex-1 bg-gray-100">WEIGHT</div>
                     </div>
                     <div className="flex font-bold">
                         <div className="w-8 border-r border-black">1</div>
                         <div className="w-20 border-r border-black">B:{data.invoiceNo}</div>
                         <div className="flex-1">{data.shipper.weight.toFixed(3)}</div>
                     </div>
                 </div>

                <div className="grid grid-cols-[60px_1fr] gap-y-1 text-[11px] font-semibold mt-6">
                    <div>NAME</div><div>: {data.consignee.name}</div>
                    <div>ADRESS</div><div>: {data.consignee.address}</div>
                    <div>POST</div><div className="flex gap-4"><span>: {data.consignee.post}</span> <span>DIST: {data.consignee.district}</span></div>
                    <div>STATE</div><div className="flex gap-4"><span>: {data.consignee.state}</span> <span>COUNTRY: {data.consignee.country}</span></div>
                    <div>PIN</div><div className="flex gap-4"><span>: {data.consignee.pin}</span></div>
                    <div>MOBILE</div><div>: {data.consignee.tel}</div>
                    <div>MOBILE</div><div>: {data.consignee.tel2}</div>
                </div>
            </div>
        </div>

        {/* Cargo Items Table */}
        <div className="mt-4">
             <div className="flex justify-between items-end mb-1">
                 <div className="bg-red-800 text-white px-2 py-0.5 rounded-t-sm text-[10px] font-bold">CARGO ITEMS</div>
                 <div className="bg-gray-400 text-black px-2 py-0.5 rounded-full text-[10px] font-bold">TOTAL WEIGHT: {data.shipper.weight.toFixed(3)} KG</div>
             </div>

             <div className="border-2 border-black w-full text-[11px]">
                 {/* Table Header */}
                 <div className="flex bg-gray-200 border-b border-black font-bold text-center">
                     <div className="w-10 border-r border-black py-1">SL NO.</div>
                     <div className="flex-1 border-r border-black py-1">ITEMS</div>
                     <div className="w-16 border-r border-black py-1">BOX NO.</div>
                     <div className="w-12 border-r border-black py-1">QTY</div>
                     
                     {/* Second Column Header */}
                     <div className="w-10 border-r border-black py-1">SL NO.</div>
                     <div className="flex-1 border-r border-black py-1">ITEMS</div>
                     <div className="w-16 border-r border-black py-1">BOX NO.</div>
                     <div className="w-12 py-1">QTY</div>
                 </div>

                 {/* Table Body - Creating fixed 15 rows to simulate the paper */}
                 {Array.from({ length: 15 }).map((_, index) => {
                     const item1 = data.cargoItems[index] || null;
                     const item2 = data.cargoItems[index + 15] || null; // Support up to 30 items for double column

                     return (
                        <div key={index} className="flex border-b border-gray-400 last:border-b-0 h-6 items-center">
                             <div className="w-10 border-r border-black h-full text-center flex items-center justify-center">{item1?.slNo}</div>
                             <div className="flex-1 border-r border-black h-full pl-1 flex items-center uppercase">{item1?.description}</div>
                             <div className="w-16 border-r border-black h-full text-center flex items-center justify-center">{item1?.boxNo}</div>
                             <div className="w-12 border-r border-black h-full text-center flex items-center justify-center">{item1?.qty}</div>

                             {/* Right Side */}
                             <div className="w-10 border-r border-black h-full text-center flex items-center justify-center">{item2?.slNo}</div>
                             <div className="flex-1 border-r border-black h-full pl-1 flex items-center uppercase">{item2?.description}</div>
                             <div className="w-16 border-r border-black h-full text-center flex items-center justify-center">{item2?.boxNo}</div>
                             <div className="w-12 h-full text-center flex items-center justify-center">{item2?.qty}</div>
                        </div>
                     );
                 })}
             </div>
        </div>

        {/* Financials */}
        <div className="flex mt-0 border-x-2 border-b-2 border-black">
             <div className="flex-1"></div> {/* Spacer to push totals to right */}
             <div className="w-64 border-l-2 border-black text-[11px] font-bold">
                 <div className="flex justify-between border-b border-gray-400 px-2 py-1">
                     <span>TOTAL</span>
                     <span className="font-arabic font-normal text-right px-2">المجموع</span>
                     <span>{data.financials.total.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between border-b border-gray-400 px-2 py-1">
                     <span>BILL CHARGES</span>
                     <span className="font-arabic font-normal text-right px-2">رسوم الفاتورة</span>
                     <span>{data.financials.billCharges.toFixed(2)}</span>
                 </div>
                 {/* Conditionally Show VAT Row */}
                 {settings.isVatEnabled && (
                    <div className="flex justify-between border-b border-gray-400 px-2 py-1">
                        <span>VAT (15%)</span>
                        <span className="font-arabic font-normal text-right px-2">ضريبة القيمة المضافة</span>
                        <span>{data.financials.vatAmount.toFixed(2)}</span>
                    </div>
                 )}
                 <div className="flex justify-between bg-gray-200 px-2 py-1">
                     <span>NET TOTAL</span>
                     <span className="font-arabic font-normal text-right px-2">المجموع الصافي</span>
                     <span>{data.financials.netTotal.toFixed(2)}</span>
                 </div>
             </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-[9px] text-gray-700">
             <div className="text-right font-bold text-red-900 mb-2">THANK YOU FOR YOUR BUSINESS.</div>
             <div className="font-bold mb-1 text-red-900">TERMS AND CONDITIONS</div>
             <div className="text-center mb-2 font-bold text-[8px]">ACCEPT THE GOODS ONLY AFTER CHECKING AND CONFIRMING THEM ON DELIVERY.</div>
             
             <p className="leading-tight text-justify mb-2">
                 NO GUARANTEE FOR GLASS/BREAKABLE ITEMS. COMPANY NOT RESPONSIBLE FOR ITEMS RECEIVED IN DAMAGED CONDITION. COMPLAINTS WILL NOT BE ACCEPTED AFTER 2 DAYS FROM THE DATE OF DELIVERY. COMPANY NOT RESPONSIBLE FOR OCTROI CHARGES OR ANY OTHER CHARGES LEVIED LOCALLY. IN CASE OF CLAIM (LOSS), PROOF OF DOCUMENTS SHOULD BE PRODUCED. SETTLEMENT WILL BE MADE (20 SAR/KGS) PER COMPANY RULES. COMPANY WILL NOT TAKE RESPONSIBILITY FOR NATURAL CALAMITY AND DELAY IN CUSTOMS CLEARANCE.
             </p>
             <p className="leading-tight text-justify font-arabic mb-8" dir="rtl">
                 الشروط: 1. لا توجد مطالب عند الشركة الناشئة للخسائر الناتجة عن الحوادث الطبيعية أو تأخير التخليص الجمركي. 2. لا تتحمل الشركة مسؤولية أي خسارة ناتجة عن سوء الاستخدام أو الأضرار غير المسؤولة أو المسؤوليات المترتبة على أي رسوم ومعاملات تفرض من قبل السلطات الجمركية. 3. الشركة غير مسؤولة عن أي مسؤوليات قانونية ناشئة عن المستندات المفقودة أو التالفة. 4. يتحمل المستلم أو المشتري جميع الرسوم الإضافية، بما في ذلك رسوم التخزين والغرامات المفروضة من قبل الجمارك.
             </p>

             <div className="flex justify-between items-end px-8 mt-12 font-bold text-[10px] text-red-900">
                 <div className="flex flex-col items-center">
                     <div className="mb-8 font-signature text-2xl text-blue-900">Signature</div>
                     <div className="border-t border-gray-400 px-4 pt-1">SHIPPER SIGNATURE</div>
                 </div>
                 <div className="flex flex-col items-center">
                     <div className="mb-4 font-signature text-3xl text-blue-900 rotate-[-10deg]">
                         {settings.companyName.split(' ')[0]}
                     </div>
                     <div className="border-t border-gray-400 px-4 pt-1">CONSIGNEE SIGNATURE</div>
                 </div>
                 <div className="flex flex-col items-center">
                      <div className="mb-12"></div>
                     <div className="border-t border-gray-400 px-4 pt-1">MANAGER SIGNATURE</div>
                 </div>
             </div>
        </div>

      </div>
    </div>
  );
};

export default InvoicePreview;



import React from 'react';
import { InvoiceData, AppSettings } from '../types';
import { DEFAULT_TC_HEADER, DEFAULT_TC_ENGLISH, DEFAULT_TC_ARABIC, DEFAULT_BRAND_COLOR } from '../services/dataService';

interface InvoicePreviewProps {
    data: InvoiceData;
    settings: AppSettings;
    onBack: () => void;
}

const ITEMS_PER_COLUMN = 15;
const COLUMNS_PER_PAGE = 2;
const ITEMS_PER_PAGE = ITEMS_PER_COLUMN * COLUMNS_PER_PAGE;

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ data, settings, onBack }) => {
    const totalItems = data.cargoItems.length;
    // Ensure at least one page exists even if there are no items
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / ITEMS_PER_PAGE) : 1;
    const pages = Array.from({ length: totalPages }, (_, i) => i);
    const brandColor = settings.brandColor || DEFAULT_BRAND_COLOR;

    return (
        <div className="flex flex-col items-center justify-start min-h-screen bg-gray-500 p-4 overflow-y-auto print:bg-white print:p-0 print:block">
            <div className="w-full max-w-4xl no-print mb-4 flex justify-between">
                <button onClick={onBack} className="bg-gray-700 text-white px-4 py-2 rounded shadow hover:bg-gray-600 transition">
                    &larr; Back to Dashboard
                </button>
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-500 transition font-bold">
                    Print Invoice
                </button>
            </div>

            {pages.map((pageIndex) => (
                <div key={pageIndex} className="bg-white w-[210mm] h-[297mm] p-8 shadow-2xl text-xs font-sans text-gray-900 relative mb-8 mx-auto flex flex-col justify-between print:mb-0 print:shadow-none print:w-full print:h-[297mm] print:mx-0 page-break-container box-border">

                    {/* Main Content Wrapper */}
                    <div className="flex-1">
                        {/* Header - Contains Side Details Only */}
                        <div className="flex justify-between items-start border-b-2 pb-2 mb-2" style={{ borderColor: brandColor }}>
                            {/* Left: English Details */}
                            <div className="w-1/3 flex flex-col items-start">
                                <div className="text-3xl font-serif font-black uppercase mb-1 leading-none tracking-tighter" style={{ color: brandColor }}>
                                    {settings.companyName}
                                </div>
                                <div className="text-xs text-blue-900 font-bold leading-tight uppercase tracking-wide">
                                    {settings.addressLine1}
                                </div>
                                {settings.addressLine2 && (
                                    <div className="text-xs text-blue-900 font-bold leading-tight uppercase tracking-wide">
                                        {settings.addressLine2}
                                    </div>
                                )}
                                <div className="font-bold text-[10px] mt-1 text-gray-900">
                                    {settings.phone1} {settings.phone2 && `/ ${settings.phone2}`}
                                </div>
                                {settings.vatnoc && (
                                    <div className="font-bold text-[10px] text-gray-900 mt-0.5">
                                        VAT NO: {settings.vatnoc}
                                    </div>
                                )}
                            </div>

                            {/* Center: Logo */}
                            <div className="flex-1 flex justify-center items-center px-2">
                                {settings.logoUrl && (
                                    <img src={settings.logoUrl} alt="Logo" className="max-h-[100px] max-w-[240px] object-contain" />
                                )}
                            </div>

                            {/* Right: Arabic Details */}
                            <div className="w-1/3 text-right flex flex-col items-end">
                                <div className="font-arabic text-3xl font-black mb-1 leading-none" style={{ color: brandColor }}>
                                    {settings.companyArabicName}
                                </div>
                                {settings.addressLine1Arabic && (
                                    <div className="font-arabic text-right text-xs text-blue-900 font-bold leading-tight">{settings.addressLine1Arabic}</div>
                                )}
                                {settings.addressLine2Arabic && (
                                    <div className="font-arabic text-right text-xs text-blue-900 font-bold leading-tight">{settings.addressLine2Arabic}</div>
                                )}
                                <div className="font-bold text-[10px] mt-1 text-gray-900" dir="ltr">
                                    {settings.phone1} {settings.phone2 && `/ ${settings.phone2}`}
                                </div>
                                {settings.vatnoc && (
                                    <div className="font-bold text-[10px] text-gray-900 mt-0.5">
                                        الرقم الضريبي: {settings.vatnoc}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Invoice Heading Section */}
                        <div className="flex flex-col items-center justify-center text-center py-1 mb-1">
                            <div className="font-bold text-xl leading-none mb-0.5" style={{ color: brandColor }}>فاتورة ضريبة مبسطة</div>
                            <div className="font-bold text-lg leading-none uppercase" style={{ color: brandColor }}>SIMPLIFIED TAX INVOICE</div>
                        </div>

                        {/* Invoice Meta Bar */}
                        <div className="w-full text-white flex justify-between items-center px-4 py-1 mb-1 text-xs font-bold" style={{ backgroundColor: brandColor }}>
                            <div>DATE: {data.date}</div>
                            <div className="uppercase">SHIPMENT TYPE: {data.shipmentType}</div>
                            <div className="uppercase">PAYMENT: {data.paymentMode || 'CASH'}</div>
                            <div className="text-right">INV NO: {data.invoiceNo}</div>
                        </div>


                        {/* Shipper & Consignee Grid */}
                        <div className="flex border-b-2 pb-1 mb-1" style={{ borderColor: brandColor }}>
                            {/* Shipper */}
                            <div className="w-1/2 pr-2 border-r border-gray-300">
                                <div className="text-white inline-block px-2 py-0.5 rounded-sm mb-1.5 font-bold text-[10px]" style={{ backgroundColor: brandColor }}>SHIPPER</div>
                                <div className="grid grid-cols-[80px_1fr] gap-y-0.5 text-[11px] font-semibold">
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
                                <div className="text-white inline-block px-2 py-0.5 rounded-sm mb-1.5 font-bold text-[10px]" style={{ backgroundColor: brandColor }}>CONSIGNEE</div>

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

                                <div className="grid grid-cols-[60px_1fr] gap-y-0.5 text-[11px] font-semibold mt-6">
                                    <div>NAME</div><div>: {data.consignee.name}</div>
                                    <div>ADDRESS</div><div>: {data.consignee.address}</div>
                                    <div>POST</div><div className="flex gap-4"><span>: {data.consignee.post}</span> <span>DIST: {data.consignee.district}</span></div>
                                    <div>STATE</div><div className="flex gap-4"><span>: {data.consignee.state}</span> <span>COUNTRY: {data.consignee.country}</span></div>
                                    <div>PIN</div><div className="flex gap-4"><span>: {data.consignee.pin}</span></div>
                                    <div>MOBILE</div><div>: {data.consignee.tel}</div>
                                    <div>MOBILE</div><div>: {data.consignee.tel2}</div>
                                </div>
                            </div>
                        </div>

                        {/* Cargo Items Table */}
                        <div className="mt-2">
                            <div className="flex justify-between items-end mb-0.5">
                                <div className="text-white px-2 py-0.5 rounded-t-sm text-[10px] font-bold" style={{ backgroundColor: brandColor }}>CARGO ITEMS</div>
                                <div className="bg-gray-400 text-black px-2 py-0.5 rounded-full text-[10px] font-bold">TOTAL WEIGHT: {data.shipper.weight.toFixed(3)} KG</div>
                            </div>

                            <div className="border-2 border-black w-full text-[11px]">
                                {/* Table Header */}
                                <div className="flex bg-gray-200 border-b border-black font-bold text-center">
                                    <div className="w-10 border-r border-black py-0.5">SL NO.</div>
                                    <div className="flex-1 border-r border-black py-0.5">ITEMS</div>
                                    <div className="w-16 border-r border-black py-0.5">BOX NO.</div>
                                    <div className="w-12 border-r border-black py-0.5">QTY</div>

                                    {/* Second Column Header */}
                                    <div className="w-10 border-r border-black py-0.5">SL NO.</div>
                                    <div className="flex-1 border-r border-black py-0.5">ITEMS</div>
                                    <div className="w-16 border-r border-black py-0.5">BOX NO.</div>
                                    <div className="w-12 py-0.5">QTY</div>
                                </div>

                                {/* Table Body - Fixed rows for print layout consistency */}
                                {Array.from({ length: ITEMS_PER_COLUMN }).map((_, rowIndex) => {
                                    const pageOffset = pageIndex * ITEMS_PER_PAGE;

                                    // Left Column Item (0-14 for Page 1, 30-44 for Page 2)
                                    const leftIndex = pageOffset + rowIndex;
                                    const item1 = data.cargoItems[leftIndex] || null;

                                    // Right Column Item (15-29 for Page 1, 45-59 for Page 2)
                                    const rightIndex = pageOffset + ITEMS_PER_COLUMN + rowIndex;
                                    const item2 = data.cargoItems[rightIndex] || null;

                                    return (
                                        <div key={rowIndex} className="flex border-b border-gray-400 last:border-b-0 h-[22px] items-center">
                                            <div className="w-10 border-r border-black h-full text-center flex items-center justify-center">{item1?.slNo}</div>
                                            <div className="flex-1 border-r border-black h-full pl-1 flex items-center uppercase overflow-hidden whitespace-nowrap text-[10px]">{item1?.description}</div>
                                            <div className="w-16 border-r border-black h-full text-center flex items-center justify-center">{item1?.boxNo}</div>
                                            <div className="w-12 border-r border-black h-full text-center flex items-center justify-center">{item1?.qty}</div>

                                            {/* Right Side */}
                                            <div className="w-10 border-r border-black h-full text-center flex items-center justify-center">{item2?.slNo}</div>
                                            <div className="flex-1 border-r border-black h-full pl-1 flex items-center uppercase overflow-hidden whitespace-nowrap text-[10px]">{item2?.description}</div>
                                            <div className="w-16 border-r border-black h-full text-center flex items-center justify-center">{item2?.boxNo}</div>
                                            <div className="w-12 h-full text-center flex items-center justify-center">{item2?.qty}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Financials - Repeated on every page to maintain template structure */}
                        <div className="flex mt-0 border-x-2 border-b-2 border-black">
                            <div className="flex-1"></div>
                            <div className="w-64 border-l-2 border-black text-[11px] font-bold">
                                <div className="flex justify-between border-b border-gray-400 px-2 py-0.5">
                                    <span>TOTAL</span>
                                    <span className="font-arabic font-normal text-right px-2">المجموع</span>
                                    <span>{data.financials.total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-400 px-2 py-0.5">
                                    <span>BILL CHARGES</span>
                                    <span className="font-arabic font-normal text-right px-2">رسوم الفاتورة</span>
                                    <span>{data.financials.billCharges.toFixed(2)}</span>
                                </div>
                                {settings.isVatEnabled && (
                                    <div className="flex justify-between border-b border-gray-400 px-2 py-0.5">
                                        <span>VAT (15%)</span>
                                        <span className="font-arabic font-normal text-right px-2">ضريبة القيمة المضافة</span>
                                        <span>{data.financials.vatAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between bg-gray-200 px-2 py-0.5">
                                    <span>NET TOTAL</span>
                                    <span className="font-arabic font-normal text-right px-2">المجموع الصافي</span>
                                    <span>{data.financials.netTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-t border-gray-400 px-2 py-0.5 text-[10px]">
                                    <span>PAYMENT MODE</span>
                                    <span className="uppercase">{data.paymentMode || 'CASH'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-auto pt-2 text-[9px] text-gray-700">
                        <div className="text-right font-bold mb-1" style={{ color: brandColor }}>THANK YOU FOR YOUR BUSINESS.</div>
                        <div className="font-bold mb-0.5 uppercase" style={{ color: brandColor }}>TERMS AND CONDITIONS</div>
                        <div className="text-center mb-1 font-bold text-[8px]">
                            {settings.tcHeader || DEFAULT_TC_HEADER}
                        </div>

                        <p className="leading-tight text-justify mb-1 text-[8px]">
                            {settings.tcEnglish || DEFAULT_TC_ENGLISH}
                        </p>
                        <p className="leading-tight text-justify font-arabic mb-4 text-[8px]" dir="rtl">
                            {settings.tcArabic || DEFAULT_TC_ARABIC}
                        </p>

                        <div className="flex justify-between items-end px-4 mt-2 font-bold text-[10px]" style={{ color: brandColor }}>
                            <div className="flex flex-col items-center">
                                <div className="h-10 mb-1"></div>
                                <div className="border-t border-gray-400 px-4 pt-0.5">SHIPPER SIGNATURE</div>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="h-10 mb-1"></div>
                                <div className="border-t border-gray-400 px-4 pt-0.5">CONSIGNEE SIGNATURE</div>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="h-10 mb-1"></div>
                                <div className="border-t border-gray-400 px-4 pt-0.5">MANAGER SIGNATURE</div>
                            </div>
                        </div>

                        {/* Page Number Indicator */}
                        <div className="text-center mt-1 text-[8px] text-gray-400">
                            Page {pageIndex + 1} of {totalPages}
                        </div>
                    </div>

                </div>
            ))}
            <style>{`
        @media print {
            body { 
                background: white; 
            }
            .page-break-container {
                page-break-after: always;
                break-after: page;
            }
            .page-break-container:last-child {
                page-break-after: auto;
                break-after: auto;
            }
        }
      `}</style>
        </div>
    );
};

export default InvoicePreview;

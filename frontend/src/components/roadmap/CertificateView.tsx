'use client';

import React from 'react';
import { Award, ShieldCheck, Calendar, User, Briefcase, Sparkles, Download, X } from 'lucide-react';
import Portal from '@/components/ui/Portal';

interface CertificateData {
    certificate_id: string;
    user_name: string;
    target_role: string;
    completion_date: string;
    issuer: string;
    verification_url: string;
}

interface CertificateViewProps {
    data: CertificateData;
    onClose: () => void;
}

export default function CertificateView({ data, onClose }: CertificateViewProps) {
    const handlePrint = () => {
        window.print();
    };

    const formattedDate = new Date(data.completion_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <Portal>
            <div id="certificate-portal-overlay" className="fixed inset-0 z-[100000] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 md:p-8 overflow-y-auto animate-fade-in">
                <div className="relative max-w-5xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
                    {/* Header Actions */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white sticky top-0 z-20 no-print">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                                <Award size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Professional Certificate</h2>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Seal of Achievement</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handlePrint}
                                className="h-11 px-6 bg-blue-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-blue-100 active:scale-95"
                            >
                                <Download size={16} />
                                Download PDF
                            </button>
                            <button
                                onClick={onClose}
                                className="w-11 h-11 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center hover:bg-gray-100 hover:text-gray-600 transition-all active:scale-95"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Certificate Content - Print Area */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-100 flex justify-center items-start">
                        <div id="certificate-print-area" className="print-area w-[1122px] h-[793px] bg-white shadow-2xl relative p-0 flex flex-col overflow-hidden font-['Montserrat',sans-serif] transform origin-top scale-[0.4] sm:scale-[0.6] lg:scale-[0.8] mb-[200px] lg:mb-0 transition-transform duration-500">

                            {/* THEME BORDERS & GEOMETRIC SHAPES */}
                            {/* Blue Decorative Background */}
                            <div className="absolute inset-0 bg-white">
                                {/* Top Left Gold Corner */}
                                <div className="absolute top-10 left-10 w-40 h-40 border-t-[6px] border-l-[6px] border-[#d4af37]" />
                                {/* Top Right Gold Corner */}
                                <div className="absolute top-10 right-10 w-40 h-40 border-t-[6px] border-r-[6px] border-[#d4af37]" />

                                {/* Bottom Blue Waves - SVG for maximum print reliability */}
                                <svg className="absolute bottom-[1mm] left-0 w-full h-[120px] pointer-events-none z-0" viewBox="0 0 1000 100" preserveAspectRatio="none">
                                    <path d="M0 100 L0 20 L400 100 Z" fill="#0a2e7a" opacity="0.5" />
                                    <path d="M0 100 L0 40 L350 100 Z" fill="#1042b0" />
                                    <path d="M1000 100 L1000 20 L600 100 Z" fill="#0a2e7a" opacity="0.5" />
                                    <path d="M1000 100 L1000 40 L650 100 Z" fill="#1042b0" />
                                </svg>

                                {/* Gold Accents on Waves */}
                                <div className="absolute bottom-4 left-[35%] w-[10%] h-[10px] bg-[#d4af37] -rotate-[31deg]" />
                                <div className="absolute bottom-4 right-[35%] w-[10%] h-[10px] bg-[#d4af37] rotate-[31deg]" />
                            </div>

                            {/* LIGHT WATERMARK TEXTURE */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none grayscale flex items-center justify-center">
                                <Sparkles size={600} strokeWidth={0.5} />
                            </div>

                            {/* INNER CONTENT - Main Area */}
                            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-20 text-center">
                                {/* Certificate Title */}
                                <div className="mb-6">
                                    <h1 className="text-[54px] font-[900] text-[#1a1a1a] tracking-[0.1em] uppercase leading-tight italic">CERTIFICATE</h1>
                                    <p className="text-[18px] font-bold text-[#d4af37] uppercase tracking-[0.5em] mt-2">OF ACHIEVEMENT</p>
                                </div>

                                <div className="w-64 h-[2px] bg-gray-200 mb-8" />

                                <p className="text-gray-500 text-base uppercase tracking-[0.1em] font-medium mb-10">THIS CERTIFICATE PROUDLY PRESENTED TO</p>

                                {/* Recipient Name */}
                                <div className="mb-8 w-full">
                                    <h2 className="text-[64px] font-normal text-[#c5a044] leading-tight font-['Great_Vibes',cursive] py-2">
                                        {data.user_name}
                                    </h2>
                                    <div className="w-[80%] h-[1px] bg-gray-300 mx-auto" />
                                </div>

                                {/* Achievement Text */}
                                <div className="max-w-3xl mx-auto mb-10 px-4">
                                    <p className="text-gray-600 text-[16px] leading-relaxed">
                                        In recognition of demonstrating exceptional mastery and completing the comprehensive career roadmap benchmarks as an industry-verified
                                    </p>
                                    <p className="text-3xl font-black text-gray-900 mt-4 uppercase tracking-tighter">
                                        {data.target_role}
                                    </p>
                                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-8 border-t border-gray-100 pt-6 w-fit mx-auto">
                                        Validated by SkillBridge Real-Time Market Intelligence • Date: {formattedDate}
                                    </p>
                                </div>
                            </div>

                            {/* FOOTER AREA - Fixed height in Flow for absolute print reliability */}
                            <div className="relative w-full h-[180px] mt-auto">
                                {/* Bottom Blue Waves - Simplified Single-Layer Design */}
                                <svg className="absolute bottom-[2px] left-0 w-full h-[140px] pointer-events-none z-0" viewBox="0 0 1000 100" preserveAspectRatio="none">
                                    <path d="M0 100 L0 30 L400 100 Z" fill="#1042b0" style={{ fill: '#1042b0 !important' }} />
                                    <path d="M1000 100 L1000 30 L600 100 Z" fill="#1042b0" style={{ fill: '#1042b0 !important' }} />
                                    {/* Gold Center Triangle */}
                                    <path d="M480 100 L500 80 L520 100 Z" fill="#d4af37" style={{ fill: '#d4af37 !important' }} />
                                </svg>

                                {/* Signatures & Seal Row */}
                                <div className="relative z-20 w-full grid grid-cols-3 items-end px-20 pb-12">
                                    <div className="flex flex-col items-center">
                                        <div className="w-full border-b border-gray-400 mb-2 px-6 h-8"></div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Lead Architect</p>
                                    </div>

                                    <div className="flex justify-center mb-[-10px]">
                                        <div className="w-24 h-24 relative flex items-center justify-center">
                                            {/* Dedicated Inline SVG Seal Backgrounds */}
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                                                <circle cx="50" cy="50" r="48" fill="#d4af37" opacity="0.2" fillOpacity="0.2" style={{ fill: '#d4af37 !important', opacity: '0.2 !important' }} />
                                                <circle cx="50" cy="50" r="44" fill="white" stroke="#d4af37" strokeWidth="1.5" style={{ fill: 'white !important', stroke: '#d4af37 !important' }} />
                                                <circle cx="50" cy="50" r="40" fill="none" stroke="#d4af37" strokeWidth="0.5" strokeDasharray="2 1" style={{ stroke: '#d4af37 !important' }} />
                                            </svg>
                                            <Award size={32} className="text-[#d4af37] relative z-10" />
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <div className="w-full border-b border-gray-400 mb-2 px-6 h-8"></div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">SkillBridge Engine</p>
                                    </div>
                                </div>

                                {/* ID Footer (Discreet) - NO-PRINT to avoid PDF clutter as requested */}
                                <div className="absolute bottom-[4mm] left-0 w-full px-16 flex justify-between items-center opacity-30 text-[9px] font-bold text-gray-500 uppercase tracking-[0.4em] z-30 no-print">
                                    <span>ID: {data.certificate_id}</span>
                                    <span>VERIFY: {data.verification_url}</span>
                                </div>
                            </div>

                            {/* PREMIUM SPARKLE OVERLAY */}
                            <div className="absolute inset-0 pointer-events-none no-print overflow-hidden z-0">
                                {[...Array(24)].map((_, i) => ( // More sparkles (24 instead of 12)
                                    <div
                                        key={i}
                                        className="absolute animate-sparkle"
                                        style={{
                                            top: `${Math.random() * 100}%`,
                                            left: `${Math.random() * 100}%`,
                                            animationDelay: `${Math.random() * 6}s`,
                                            color: '#d4af37'
                                        }}
                                    >
                                        <Sparkles size={Math.random() * 25 + 10} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer Tip */}
                    <div className="p-4 bg-gray-50 border-t border-gray-100 text-center no-print">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                            Certified on {formattedDate} • SkillBridge AI Framework v2.0
                        </p>
                    </div>
                </div>

                <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Great+Vibes&display=swap');

                @media print {
                    /* CLEAN SLATE PDF: Absolute Isolation and Font Loading */
                    html, body {
                        height: 210mm !important;
                        width: 297mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        font-family: 'Montserrat', sans-serif !important;
                    }

                    /* Hide EVERY immediate child of body... */
                    body > * {
                        display: none !important;
                    }

                    /* ...EXCEPT our portal container */
                    body > #certificate-portal-overlay {
                        display: block !important;
                        visibility: visible !important;
                        position: relative !important;
                        width: 297mm !important;
                        height: 210mm !important;
                        background: white !important;
                        z-index: 99999999 !important;
                        padding: 0 !important;
                    }

                    /* Drill down Hide other portal UI */
                    #certificate-portal-overlay > *:not(.relative) { display: none !important; }
                    .relative.max-w-5xl { 
                        display: block !important; 
                        max-width: none !important;
                        width: 297mm !important;
                        height: 210mm !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        padding: 0 !important;
                    }
                    .relative.max-w-5xl > *:not(.flex-1) { display: none !important; }
                    .flex-1.bg-gray-100 { background: white !important; padding: 0 !important; }

                    #certificate-print-area {
                        visibility: visible !important;
                        position: relative !important;
                        margin: 0 !important;
                        width: 297mm !important;
                        height: 210mm !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        display: flex !important;
                        flex-direction: column !important;
                        overflow: hidden !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* Typography Polish */
                    #certificate-print-area h1 { font-family: 'Montserrat', sans-serif !important; font-weight: 900 !important; font-size: 52pt !important; letter-spacing: 0.1em !important; }
                    #certificate-print-area .text-[#d4af37] { font-family: 'Montserrat', sans-serif !important; font-weight: 700 !important; }
                    #certificate-print-area h2 { font-family: 'Great Vibes', cursive !important; font-size: 64pt !important; margin-bottom: 5mm !important; }
                    #certificate-print-area .text-gray-600 { font-size: 11pt !important; line-height: 1.5 !important; }
                    
                    /* Signature Area Safety */
                    #certificate-print-area .mt-auto {
                        margin-bottom: 10mm !important;
                        height: auto !important;
                    }

                    .no-print {
                        display: none !important;
                    }

                    @page {
                        size: A4 landscape;
                        margin: 0;
                    }

                    /* Force EXACT color reproduction on ALL elements */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }

                @keyframes sparkle {
                    0%, 100% { opacity: 0; transform: scale(0.3) rotate(0deg); }
                    50% { opacity: 0.9; transform: scale(1.5) rotate(180deg); }
                }
                .animate-sparkle {
                    animation: sparkle 5s infinite ease-in-out;
                }
            `}</style>
            </div>
        </Portal>
    );
}


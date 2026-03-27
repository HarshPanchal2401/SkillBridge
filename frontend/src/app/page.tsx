'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';
import { 
    ArrowRight, Target, BookOpen, BarChart3, Sparkles, 
    BrainCircuit, Rocket, ShieldCheck, Zap, ChevronRight,
    Globe, MousePointer2, Cpu, GraduationCap, Layout, Bot,
    X, Mail, User, MapPin, Building, AlertCircle, RefreshCw
} from 'lucide-react';

function HomePageContent() {
    const { user, login, register, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [scrolled, setScrolled] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const heroRef = useRef<HTMLDivElement>(null);
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        const authType = searchParams.get('auth');
        if (authType === 'login') setShowLogin(true);
        if (authType === 'register') setShowRegister(true);
    }, [searchParams]);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        const handleMouseMove = (e: MouseEvent) => {
            if (heroRef.current) {
                const rect = heroRef.current.getBoundingClientRect();
                setMousePos({
                    x: (e.clientX - rect.left) / rect.width - 0.5,
                    y: (e.clientY - rect.top) / rect.height - 0.5,
                });
            }
        };

        window.addEventListener('scroll', handleScroll);
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    const handleLogin = async (email: string) => {
        setAuthError('');
        setAuthLoading(true);
        try {
            await login(email);
            setShowLogin(false);
            router.push('/dashboard');
        } catch (err: any) {
            setAuthError(err.message || 'Login failed');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleRegister = async (data: any) => {
        setAuthError('');
        setAuthLoading(true);
        try {
            await register(data);
            setShowRegister(false);
            router.push('/onboarding');
        } catch (err: any) {
            setAuthError(err.message || 'Registration failed');
        } finally {
            setAuthLoading(false);
        }
    };

    useEffect(() => {
        if (!loading && user) {
            router.push('/dashboard');
        }
    }, [user, loading, router]);

    const features = [
        {
            icon: BrainCircuit,
            title: 'Neural Analysis',
            description: 'AI-driven mapping of your skills against real-world market requirements.',
            color: 'from-blue-500/20 to-indigo-600/20',
            iconColor: 'text-blue-400',
        },
        {
            icon: Target,
            title: 'Precision Paths',
            description: 'Step-by-step career roadmaps engineered for rapid domain mastery.',
            color: 'from-emerald-400/20 to-teal-600/20',
            iconColor: 'text-emerald-400',
        },
        {
            icon: Rocket,
            title: 'Learning Velocity',
            description: 'Accelerated growth through curated resources and automated syncing.',
            color: 'from-orange-400/20 to-red-600/20',
            iconColor: 'text-orange-400',
        },
        {
            icon: ShieldCheck,
            title: 'Verified Readiness',
            description: 'Quantifiable metrics that prove your expertise to top-tier employers.',
            color: 'from-purple-500/20 to-pink-600/20',
            iconColor: 'text-purple-400',
        },
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#050505]">
                <div className="relative w-12 h-12 flex items-center justify-center">
                    <div className="absolute inset-0 border-2 border-green-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    <Sparkles className="text-green-500 animate-pulse" size={20} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020202] text-white selection:bg-green-500/30 overflow-x-hidden font-sans">
            {/* 3D BACKGROUND SYSTEM - SIMPLIFIED */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[10%] w-[60%] h-[60%] bg-green-500/5 blur-[140px] rounded-full animate-blob"></div>
                <div className="absolute bottom-[-20%] right-[10%] w-[60%] h-[60%] bg-blue-500/5 blur-[140px] rounded-full animate-blob animation-delay-4000"></div>
                
                {/* Grid & Dot System */}
                <div className="absolute inset-0 bg-grid-white opacity-[0.03] [mask-image:radial-gradient(ellipse_at_center,black,transparent)]"></div>
                <div className="absolute inset-0 bg-dot-pattern opacity-[0.1]"></div>
            </div>

            {/* NAVIGATION */}
            <nav className={`fixed top-0 w-full z-50 transition-all duration-500 px-6 lg:px-12 ${scrolled ? 'py-4 mt-0' : 'py-8 mt-2'}`}>
                <div className={`max-w-7xl mx-auto flex justify-between items-center transition-all duration-500 ${scrolled ? 'bg-black/40 backdrop-blur-2xl border border-white/10 px-6 py-3 rounded-2xl shadow-2xl' : ''}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-green-900/20">
                            <Sparkles className="text-white" size={18} />
                        </div>
                        <span className="text-lg font-black tracking-tight uppercase">SkillBridge</span>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-8">
                        <Link href="#features" className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-[0.2em]">Platform Core</Link>
                        <button 
                            onClick={() => { setShowLogin(true); setAuthError(''); }}
                            className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-[0.2em]"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => { setShowRegister(true); setAuthError(''); }}
                            className="px-6 py-2.5 bg-green-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-green-500 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all active:scale-95"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* AUTH MODALS */}
            {showLogin && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fade-in">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLogin(false)}></div>
                    <div className="relative w-full max-w-[400px] bg-white rounded-[2.5rem] p-10 shadow-2xl animate-slide-up overflow-hidden">
                        <button onClick={() => setShowLogin(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors">
                            <X size={20} />
                        </button>
                        
                        <div className="mb-8 text-center">
                            <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tight">Welcome Back</h2>
                            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Access your neural profile</p>
                        </div>

                        {authError && (
                            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 border border-red-100 animate-shake">
                                <AlertCircle size={16} className="shrink-0" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{authError}</span>
                            </div>
                        )}

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value;
                            handleLogin(email);
                        }} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Neural ID (Email)</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        name="email"
                                        type="email"
                                        className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-transparent focus:border-green-500/50 rounded-2xl text-xs font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all"
                                        placeholder="system_access@identity.com"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={authLoading}
                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                            >
                                {authLoading ? <RefreshCw className="animate-spin" size={16} /> : <>Authorize Access <ArrowRight size={16} /></>}
                            </button>
                        </form>

                        <div className="mt-8 text-center font-bold text-[10px] text-gray-400 uppercase tracking-widest">
                            New here? <button onClick={() => { setShowLogin(false); setShowRegister(true); }} className="text-green-600 hover:underline">Register Identity</button>
                        </div>
                    </div>
                </div>
            )}

            {showRegister && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fade-in">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRegister(false)}></div>
                    <div className="relative w-full max-w-[500px] bg-white rounded-[2.5rem] p-10 shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button onClick={() => setShowRegister(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors">
                            <X size={20} />
                        </button>
                        
                        <div className="mb-8 text-center">
                            <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tight">Create Identity</h2>
                            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Initialize career synchronization</p>
                        </div>

                        {authError && (
                            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 border border-red-100 animate-shake">
                                <AlertCircle size={16} className="shrink-0" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{authError}</span>
                            </div>
                        )}

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const data = Object.fromEntries(formData.entries());
                            handleRegister(data);
                        }} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                        <input name="name" type="text" className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-green-500/50 rounded-xl text-xs font-bold text-gray-900 placeholder:text-gray-300 outline-none" required />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Neural ID</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                        <input name="email" type="email" className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-green-500/50 rounded-xl text-xs font-bold text-gray-900 placeholder:text-gray-300 outline-none" required />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Degree</label>
                                    <div className="relative">
                                        <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                        <input name="education" type="text" className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-blue-500/50 rounded-xl text-xs font-bold text-gray-900" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Target Role</label>
                                    <div className="relative">
                                        <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                        <input name="target_role" type="text" className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-green-500/50 rounded-xl text-xs font-bold text-gray-900" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Location</label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input name="location" type="text" className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-black rounded-xl text-xs font-bold text-gray-900" />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={authLoading}
                                className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-green-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                            >
                                {authLoading ? <RefreshCw className="animate-spin" size={16} /> : <>Initialize Identity <ArrowRight size={16} /></>}
                            </button>
                        </form>

                        <div className="mt-8 text-center font-bold text-[10px] text-gray-400 uppercase tracking-widest">
                            Already part of it? <button onClick={() => { setShowRegister(false); setShowLogin(true); }} className="text-green-600 hover:underline">Sign In</button>
                        </div>
                    </div>
                </div>
            )}

            {/* HERO SECTION - CENTRIC APPROACH WITH AI AVATAR */}
            <main ref={heroRef} className="relative z-10 pt-44 pb-32">
                <div className="max-w-7xl mx-auto px-8 lg:px-12">
                    <div className="flex flex-col items-center text-center space-y-12">
                        {/* Upper Badge */}
                        <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-md animate-slide-up shadow-sm">
                            <Cpu size={14} className="text-green-500" />
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                Domain-Agnostic Career Architecture
                            </span>
                        </div>

                        {/* Centered Headlines */}
                        <div className="space-y-6 max-w-4xl mx-auto">
                            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] animate-slide-up [animation-delay:100ms] text-white">
                                Bridge the Gap <br />
                                To Your <span className="text-gradient drop-shadow-[0_0_15px_rgba(34,197,94,0.2)]">Professional Peak.</span>
                            </h1>
                            <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed animate-slide-up [animation-delay:200ms] opacity-80">
                                Navigate any career path with neural skill analysis and 
                                precision-engineered roadmaps tailored for the modern architectural landscape.
                            </p>
                        </div>

                        {/* Centered Actions */}
                        <div className="flex flex-col sm:flex-row gap-5 animate-slide-up [animation-delay:300ms]">
                            <button
                                onClick={() => { setShowRegister(true); setAuthError(''); }}
                                className="px-10 py-5 bg-green-600 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-green-500 hover:shadow-[0_10px_30px_rgba(34,197,94,0.3)] transition-all flex items-center justify-center gap-3 active:scale-95"
                            >
                                Start Journey
                                <ArrowRight size={18} />
                            </button>
                            <button
                                onClick={() => { setShowLogin(true); setAuthError(''); }}
                                className="px-10 py-5 bg-white/5 text-white border border-white/10 rounded-[1.25rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-white/10 transition-all flex items-center justify-center backdrop-blur-sm active:scale-95"
                            >
                                Access Portal
                            </button>
                        </div>

                        {/* Interactive AI Avatar / Centerpiece */}
                        <div className="w-full pt-16 animate-fade-in [animation-delay:500ms]">
                            <div className="relative max-w-2xl mx-auto aspect-[16/9] flex items-center justify-center perspective-1000">
                                
                                {/* 3D ROBOT AVATAR */}
                                <div 
                                    className="relative z-30 transition-transform duration-500 ease-out"
                                    style={{ 
                                        transform: `rotateX(${mousePos.y * -15}deg) rotateY(${mousePos.x * 15}deg) translateY(-10px)` 
                                    }}
                                >
                                    {/* Robot Head/Body */}
                                    <div className="relative w-48 h-56 bg-white rounded-[4rem] shadow-[inset_-10px_-10px_30px_rgba(0,0,0,0.05),10px_10px_30px_rgba(0,0,0,0.1),0_0_50px_rgba(34,197,94,0.05)] border border-white/50 flex flex-col items-center justify-start pt-10 group overflow-hidden">
                                        
                                        {/* Glossy Overlay */}
                                        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none"></div>
                                        
                                        {/* Visor Area (Black Screen) */}
                                        <div className="w-40 h-24 bg-[#0a0a0a] rounded-[2.5rem] border-4 border-slate-200 shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center relative overflow-hidden">
                                            
                                            {/* Screen Scanlines */}
                                            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
                                            
                                            {/* Eyes Container */}
                                            <div 
                                                className="flex gap-10 transition-transform duration-300 ease-out"
                                                style={{ 
                                                    transform: `translate(${mousePos.x * 12}px, ${mousePos.y * 8}px)` 
                                                }}
                                            >
                                                {/* Left Eye (Semi-circle Glow) */}
                                                <div className="relative">
                                                    <div className="w-6 h-3 bg-cyan-400 rounded-t-full shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-pulse"></div>
                                                </div>
                                                {/* Right Eye (Semi-circle Glow) */}
                                                <div className="relative">
                                                    <div className="w-6 h-3 bg-cyan-400 rounded-t-full shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-pulse"></div>
                                                </div>
                                            </div>

                                            {/* Mouth (Semi-circle Glow) */}
                                            <div 
                                                className="mt-4 w-5 h-2.5 bg-cyan-400/80 rounded-t-full shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-transform duration-300 ease-out"
                                                style={{ 
                                                    transform: `translate(${mousePos.x * 6}px, ${mousePos.y * 4}px)` 
                                                }}
                                            ></div>
                                        </div>

                                        {/* Body Detail Line */}
                                        <div className="mt-12 w-32 h-[2px] bg-slate-200/50 rounded-full"></div>
                                        <div className="mt-8 w-16 h-1 bg-slate-100 rounded-full shadow-inner"></div>
                                    </div>

                                    {/* Detached Arms */}
                                    {/* Left Arm */}
                                    <div 
                                        className="absolute -left-16 top-24 w-12 h-20 bg-white rounded-full shadow-lg border border-white/50 transition-transform duration-700 ease-out animate-float"
                                        style={{ 
                                            transform: `rotate(${mousePos.x * -10}deg) translateY(${mousePos.y * 10}px)` 
                                        }}
                                    ></div>
                                    {/* Right Arm */}
                                    <div 
                                        className="absolute -right-16 top-24 w-12 h-20 bg-white rounded-full shadow-lg border border-white/50 transition-transform duration-700 ease-out animate-float"
                                        style={{ 
                                            transform: `rotate(${mousePos.x * 10}deg) translateY(${mousePos.y * -10}px)` 
                                        }}
                                    ></div>

                                    {/* Ground Shadow */}
                                    <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-32 h-6 bg-black/20 blur-xl rounded-full scale-x-150 animate-pulse"></div>
                                </div>

                                {/* Floating Modules - Generalized */}
                                <div className="absolute -top-10 -left-10 z-20 animate-float">
                                    <div className="p-4 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl flex items-center gap-4">
                                        <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center shadow-lg"><Zap size={18}/></div>
                                        <div className="text-left">
                                            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Growth Sync</p>
                                            <p className="text-xs font-black text-white uppercase italic">Active Monitoring</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute -bottom-6 -right-10 z-20 animate-float [animation-delay:2s]">
                                    <div className="p-4 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl flex items-center gap-4">
                                        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg"><Globe size={18}/></div>
                                        <div className="text-left">
                                            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Market Scan</p>
                                            <p className="text-xs font-black text-white uppercase italic">Target: Expert</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Base Slab - Generalized */}
                                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-blue-500/5 rounded-[3rem] border border-white/5 backdrop-blur-3xl rotate-x-12 preserve-3d animate-float shadow-2xl pointer-events-none"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* FEATURES SECTION */}
            <section id="features" className="relative z-10 py-32 bg-white/[0.01] border-y border-white/5">
                <div className="max-w-7xl mx-auto px-8 lg:px-12">
                    <div className="max-w-2xl mx-auto text-center mb-20 space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 mb-4">
                            <Sparkles size={12} className="text-blue-400" />
                            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.2em]">Universal Platform</span>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight uppercase italic">Neural Strategics</h2>
                        <p className="text-gray-500 font-bold text-xs tracking-[0.2em] uppercase leading-relaxed max-w-lg mx-auto">
                            Proprietary intelligence systems built to move you closer to your chosen destination.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={index}
                                    className="group p-8 bg-white/[0.03] border border-white/5 rounded-[2rem] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-500 relative overflow-hidden"
                                >
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-8 border border-white/10 group-hover:scale-110 transition-transform duration-500`}>
                                        <Icon size={20} className={feature.iconColor} />
                                    </div>
                                    <h3 className="text-sm font-black mb-3 uppercase tracking-tight text-white">{feature.title}</h3>
                                    <p className="text-gray-400 text-xs leading-relaxed font-medium opacity-70 group-hover:opacity-100 transition-opacity">{feature.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* CTA SECTION */}
            <section className="relative z-10 py-40">
                <div className="max-w-7xl mx-auto px-8 lg:px-12 text-center">
                    <div className="relative rounded-[3rem] bg-gradient-to-br from-green-600/10 to-emerald-800/20 border border-white/5 p-16 md:p-24 overflow-hidden backdrop-blur-xl group">
                        {/* Background Design */}
                        <div className="absolute top-0 right-0 w-full h-full bg-grid-white opacity-[0.03] pointer-events-none"></div>
                        <div className="absolute -top-24 -right-24 w-80 h-80 bg-green-500/10 blur-[100px] rounded-full group-hover:bg-green-500/20 transition-all duration-1000"></div>
                        
                        <div className="relative z-10 max-w-2xl mx-auto space-y-10">
                            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none uppercase italic">
                                Ready for the <br /><span className="text-green-500">Next Stage?</span>
                            </h2>
                            <p className="text-gray-400 text-sm md:text-base font-bold uppercase tracking-widest leading-relaxed opacity-60">
                                Join the elite tier of professionals using AI-driven <br />intelligence to navigate the modern market.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
                                <Link
                                    href="/register"
                                    className="w-full sm:w-auto px-12 py-5 bg-white text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-green-500 hover:text-white transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Access GlobalIQ
                                    <Zap size={14} fill="currentColor" />
                                </Link>
                                <Link
                                    href="/login"
                                    className="w-full sm:w-auto px-12 py-5 bg-white/5 text-white border border-white/10 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-white/10 transition-all backdrop-blur-md active:scale-95"
                                >
                                    Portal Login
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="relative z-10 py-16 bg-[#010101] border-t border-white/5">
                <div className="max-w-7xl mx-auto px-8 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-12">
                    <div className="flex flex-col items-center md:items-start gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center shadow-lg shadow-green-900/40">
                                <Sparkles className="text-white" size={16} />
                            </div>
                            <span className="text-base font-black uppercase tracking-tighter">SkillBridge</span>
                        </div>
                        <p className="text-gray-600 text-[9px] font-bold uppercase tracking-[0.3em] text-center md:text-left leading-relaxed">
                            © 2026 Neuronal Career Architecture. <br className="md:hidden" /> Ingenious Hackathon Edition.
                        </p>
                    </div>
                    
                    <div className="flex gap-12 sm:gap-20">
                        <div className="space-y-4">
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Platform</p>
                            <div className="flex flex-col gap-2 font-bold text-[10px] text-gray-500 uppercase tracking-wider">
                                <Link href="#" className="hover:text-green-500 transition-colors">Neural Mapping</Link>
                                <Link href="#" className="hover:text-green-500 transition-colors">Career Sync</Link>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Legal</p>
                            <div className="flex flex-col gap-2 font-bold text-[10px] text-gray-500 uppercase tracking-wider">
                                <Link href="#" className="hover:text-green-500 transition-colors">Privacy</Link>
                                <Link href="#" className="hover:text-green-500 transition-colors">Terms</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default function HomePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#050505]">
                <div className="relative w-12 h-12 flex items-center justify-center">
                    <div className="absolute inset-0 border-2 border-green-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    <Sparkles className="text-green-500 animate-pulse" size={20} />
                </div>
            </div>
        }>
            <HomePageContent />
        </Suspense>
    );
}


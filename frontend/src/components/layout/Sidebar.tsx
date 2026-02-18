'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import {
    Home,
    User,
    BarChart3,
    BookOpen,
    LogOut,
    Menu,
    X,
    Briefcase,
    Sparkles,
    Target,
    Map,
    ChevronRight,
    Search,
    Zap
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
    { href: '/dashboard', label: 'Overview', icon: Home },
    { href: '/profile', label: 'Identity', icon: User },
    { href: '/skills', label: 'Intelligence', icon: BarChart3 },
    { href: '/recommendations', label: 'Learning', icon: BookOpen },
    { href: '/jobs', label: 'Careers', icon: Briefcase },
    { href: '/roadmap', label: 'Journey', icon: Map },
];

export function Sidebar({ isCollapsed, setIsCollapsed }: { isCollapsed: boolean; setIsCollapsed: (v: boolean) => void }) {
    const pathname = usePathname();
    const { user, profile, logout } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    const profileCompletion = profile?.profile_completion || 0;

    return (
        <>
            {/* Mobile menu button */}
            <button
                className="lg:hidden fixed top-6 left-6 z-50 p-3 bg-white text-gray-900 rounded-2xl shadow-2xl border border-gray-100"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Overlay for mobile */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-all"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed left-0 top-0 h-full bg-gradient-to-b from-gray-950 via-gray-900 to-gray-900 
                    text-white z-40 transform transition-all duration-500 ease-in-out
                    lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
                    border-r border-white/5
                    ${isCollapsed ? 'w-24' : 'w-72'}
                `}
            >
                {/* Brand Identity / Toggle */}
                <div className={`flex items-center transition-all duration-500 ${isCollapsed ? 'p-4 justify-center mb-8' : 'p-8 mb-4 justify-between'}`}>
                    <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-12 h-12 min-w-[3rem] bg-gradient-to-tr from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)] group overflow-hidden relative">
                            <Sparkles className="relative text-white" size={24} />
                        </div>
                        {!isCollapsed && (
                            <div className="animate-fade-in whitespace-nowrap">
                                <h1 className="font-black text-xl tracking-tighter uppercase italic leading-none text-white">SkillPath</h1>
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mt-1">Intelligence</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden lg:flex absolute -right-4 top-10 w-8 h-8 bg-emerald-500 rounded-full items-center justify-center border-4 border-[#fafafa] text-white hover:scale-110 active:scale-90 transition-all shadow-lg z-50"
                >
                    <ChevronRight size={16} className={`transition-transform duration-500 ${isCollapsed ? '' : 'rotate-180'}`} />
                </button>

                {/* User Context Module */}
                {user && !isCollapsed && (
                    <div className="mx-6 mb-10 p-5 bg-white/5 rounded-[1.5rem] border border-white/10 relative overflow-hidden group animate-fade-in">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-120 transition-transform duration-700">
                            <Target size={80} />
                        </div>
                        <div className="relative">
                            <p className="font-black text-sm truncate max-w-[180px] mb-0.5">
                                {user.name || 'Professional'}
                            </p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{user.email}</p>

                            <div className="mt-4 pt-4 border-t border-white/5">
                                <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-0.5">
                                    <span>Sync Status</span>
                                    <span className="text-emerald-500">{Math.round(profileCompletion)}%</span>
                                </div>
                                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${profileCompletion}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Primary Navigation */}
                <nav className={`px-4 space-y-1 transition-all ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className={`
                                    flex items-center rounded-2xl transition-all duration-300 group relative
                                    ${isActive
                                        ? 'bg-gradient-to-r from-emerald-500/10 to-transparent text-white shadow-xl'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }
                                    ${isCollapsed
                                        ? 'w-14 h-14 justify-center p-0'
                                        : 'justify-between px-5 py-3.5 w-full border-l-4 border-transparent'
                                    }
                                    ${isActive && !isCollapsed ? 'border-l-emerald-500 translate-x-1' : ''}
                                `}
                            >
                                <div className={`flex items-center gap-4 ${isCollapsed ? 'justify-center' : ''}`}>
                                    <Icon
                                        size={20}
                                        className={`transition-colors duration-300 ${isActive ? 'text-emerald-500' : 'group-hover:text-white'}`}
                                    />
                                    {!isCollapsed && (
                                        <span className={`text-sm font-black uppercase tracking-[0.15em] ${isActive ? 'text-white' : 'group-hover:text-white'} whitespace-nowrap`}>
                                            {item.label}
                                        </span>
                                    )}
                                </div>
                                {!isCollapsed && isActive && <ChevronRight size={14} className="text-emerald-500" />}

                                {/* Tooltip for collapsed state */}
                                {isCollapsed && (
                                    <div className="absolute left-full ml-4 px-3 py-1 bg-gray-900 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-[100] whitespace-nowrap shadow-2xl">
                                        {item.label}
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* System Controls */}
                <div className={`absolute bottom-0 left-0 right-0 p-6 space-y-4 transition-all duration-500 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                    {!isCollapsed && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 animate-fade-in shadow-inner">
                            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white shrink-0">
                                <Zap size={16} fill="white" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-0.5 truncate">Go Premium</p>
                                <p className="text-[9px] text-emerald-500/60 font-medium truncate">Unlock full API search</p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={logout}
                        className={`flex items-center gap-4 transition-all duration-300 group ${isCollapsed ? 'w-12 h-12 justify-center rounded-2xl bg-red-400/5 text-gray-500 hover:text-red-400 hover:bg-red-400/10' : 'px-5 py-4 w-full text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-2xl'}`}
                    >
                        <LogOut size={18} className="group-hover:rotate-12 transition-transform shrink-0" />
                        {!isCollapsed && <span className="text-[10px] font-black uppercase tracking-[0.2em] animate-fade-in whitespace-nowrap">Terminate Session</span>}
                    </button>

                    {!isCollapsed && <p className="text-[10px] font-black text-gray-700 uppercase tracking-[0.3em] text-center pt-2 animate-fade-in">© 2026 SkillPath Engine</p>}
                </div>
            </aside>
        </>
    );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-[#fafafa] selection:bg-emerald-500 selection:text-white">
            <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
            <main className={`transition-all duration-500 min-h-screen ${isCollapsed ? 'lg:ml-24' : 'lg:ml-72'}`}>
                <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

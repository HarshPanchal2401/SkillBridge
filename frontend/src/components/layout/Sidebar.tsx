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
    ChevronRight,
    Search,
    Zap,
    PanelLeft,
    Map
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
    { href: '/dashboard', label: 'Overview', icon: Home },
    { href: '/skills', label: 'Skills IQ', icon: BarChart3 },
    { href: '/jobs', label: 'Careers', icon: Briefcase },
    { href: '/roadmap', label: 'Roadmap', icon: Map },
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
                className="lg:hidden fixed top-6 left-6 z-50 p-2.5 bg-white text-gray-900 rounded-xl shadow-md border border-gray-100"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Overlay for mobile */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-gray-900/10 backdrop-blur-sm z-40 transition-all"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed left-0 top-0 h-full bg-white text-gray-600 z-40 transform transition-all duration-300 ease-in-out
                    lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
                    border-r border-gray-100 shadow-sm
                    ${isCollapsed ? 'w-20' : 'w-64'}
                `}
            >
                {/* Brand Identity / Toggle */}
                <div className={`transition-all duration-300 ${isCollapsed ? 'p-4 justify-center mb-6' : 'p-6 mb-2'}`}>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={`flex items-center gap-3 w-full group transition-all duration-300 relative ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                    >
                        <div className="relative w-8 h-8 min-w-[2rem] bg-green-500 rounded-lg flex items-center justify-center text-white shadow-sm transition-all duration-300 group-hover:bg-green-600 group-hover:scale-105 active:scale-95 overflow-hidden">
                            {/* Logo Icon (Sparkles) */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-50' : 'opacity-100 group-hover:opacity-0 group-hover:-translate-x-full'}`}>
                                <Sparkles size={16} />
                            </div>

                            {/* Toggle Icon (PanelLeft) */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100' : 'opacity-0 translate-x-full group-hover:opacity-100 group-hover:translate-x-0'}`}>
                                <PanelLeft size={16} />
                            </div>
                        </div>

                        {!isCollapsed && (
                            <div className="flex flex-col items-start overflow-hidden transition-all duration-300">
                                <span className="text-base font-bold tracking-tight text-gray-900 group-hover:text-green-600 transition-colors">SkillBridge</span>
                                <span className={`text-[8px] font-black uppercase tracking-[0.2em] text-gray-300 transition-all duration-500 delay-100 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>Professional</span>
                            </div>
                        )}
                    </button>
                </div>

                {/* Primary Navigation */}
                <nav className={`px-3 space-y-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className={`
                                    flex items-center rounded-lg transition-all duration-200 group relative
                                    ${isActive
                                        ? 'bg-green-50 text-green-700'
                                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                    }
                                    ${isCollapsed
                                        ? 'w-12 h-12 justify-center p-0'
                                        : 'px-4 py-2.5 w-full'
                                    }
                                `}
                            >
                                <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                                    <Icon
                                        size={18}
                                        className={isActive ? 'text-green-600' : 'group-hover:text-green-600'}
                                    />
                                    {!isCollapsed && (
                                        <div className="flex items-center justify-between flex-1">
                                            <span className={`text-sm font-medium ${isActive ? 'text-green-700' : ''}`}>
                                                {item.label}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {isCollapsed && (
                                    <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all whitespace-nowrap z-50">
                                        {item.label}
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* System Controls */}
                <div className={`absolute bottom-0 left-0 right-0 p-4 space-y-2 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                    {!isCollapsed && (
                        <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white shrink-0">
                                <Zap size={14} fill="white" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-0.5 mt-0.5">Go Premium</p>
                                <p className="text-[9px] text-green-600/70">Unlock more power</p>
                            </div>
                        </div>
                    )}

                    <Link
                        href="/dashboard/settings"
                        className={`flex items-center gap-3 transition-all duration-200 group ${isCollapsed ? 'w-10 h-10 justify-center rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50' : 'px-4 py-3 w-full text-gray-500 hover:text-green-600 hover:bg-gray-50 rounded-xl'} ${pathname === '/dashboard/settings' ? 'bg-green-50 text-green-700' : ''}`}
                    >
                        <Target size={16} className={pathname === '/dashboard/settings' ? 'text-green-600' : ''} />
                        {!isCollapsed && <span className="text-xs font-semibold uppercase tracking-wider">Settings</span>}
                    </Link>

                    <button
                        onClick={logout}
                        className={`flex items-center gap-3 transition-all duration-200 group ${isCollapsed ? 'w-10 h-10 justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50' : 'px-4 py-3 w-full text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl'}`}
                    >
                        <LogOut size={16} />
                        {!isCollapsed && <span className="text-xs font-semibold uppercase tracking-wider">Logout</span>}
                    </button>

                    {!isCollapsed && <p className="text-[9px] font-bold text-gray-300 uppercase tracking-[0.2em] text-center pt-2">© 2026 SkillBridge</p>}
                </div>
            </aside>
        </>
    );
}

export function Header({ isCollapsed, setIsCollapsed }: { isCollapsed: boolean; setIsCollapsed: (v: boolean) => void }) {
    const { user, profile } = useAuth();
    const profileCompletion = profile?.profile_completion || 0;

    if (!user) return null;

    return (
        <header className={`fixed top-0 right-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 transition-all duration-300 ${isCollapsed ? 'left-20' : 'left-0 lg:left-64'}`}>
            <div className="px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Live System Active</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <Link href="/profile" className="hidden sm:flex flex-col items-end group">
                        <p className="text-sm font-bold text-gray-900 leading-none mb-1 group-hover:text-green-600 transition-colors">{user.name}</p>
                        <p className="text-[10px] text-gray-400 font-medium tracking-wide">{user.email}</p>
                    </Link>

                    <div className="flex items-center gap-4 pl-6 border-l border-gray-100">
                        <Link href="/profile" className="relative group">
                            {/* Circular Progress SVG */}
                            <svg className="w-12 h-12 transform -rotate-90 scale-90 sm:scale-100">
                                <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    fill="transparent"
                                    className="text-gray-50"
                                />
                                <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    fill="transparent"
                                    strokeDasharray={2 * Math.PI * 20}
                                    strokeDashoffset={2 * Math.PI * 20 * (1 - profileCompletion / 100)}
                                    strokeLinecap="round"
                                    className="text-green-500 transition-all duration-1000 ease-out"
                                />
                            </svg>
                            {/* Avatar */}
                            <div className="absolute inset-0 m-1.5 w-9 h-9 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center text-gray-900 font-bold text-sm shadow-sm transition-all cursor-pointer">
                                {user.name?.charAt(0) || 'U'}
                            </div>
                            {/* Percentage Badge */}
                            <div className="absolute -bottom-0.5 -right-0.5 bg-white border border-gray-100 px-1 py-0.5 rounded-full text-[8px] font-black text-green-600 shadow-sm leading-none flex items-center justify-center min-w-[18px]">
                                {Math.round(profileCompletion)}%
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    );
}

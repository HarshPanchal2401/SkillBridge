'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar, Header } from './Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const pathname = usePathname();

    // Pages that should NOT have the sidebar/header layout
    const excludeLayout = ['/', '/login', '/register', '/onboarding'].some(path =>
        pathname === path || pathname.startsWith(path + '/')
    );

    if (excludeLayout) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-gray-50 selection:bg-green-100 selection:text-green-900">
            <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
            <Header isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
            <main className={`transition-all duration-300 min-h-screen pt-16 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

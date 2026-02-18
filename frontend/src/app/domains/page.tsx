'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { AlertCircle } from 'lucide-react';

export default function DomainsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    if (authLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="space-y-8 animate-fade-in">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Career Domains</h1>
                    <p className="text-gray-500 mt-1">Explore different career paths</p>
                </div>

                <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
                    <AlertCircle size={48} className="mx-auto text-amber-400 mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Coming Soon</h2>
                    <p className="text-gray-500 mb-6">
                        Domain exploration and role matching features are being developed.
                    </p>
                    <button
                        onClick={() => router.push('/skills')}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                    >
                        View Skills Analysis
                    </button>
                </div>
            </div>
        </MainLayout>
    );
}

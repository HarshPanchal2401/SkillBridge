'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AlertCircle, Target, Sparkles, ChevronRight } from 'lucide-react';

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
            <>
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="space-y-8 animate-fade-in">
                <div>
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold uppercase tracking-wider mb-3">
                        <Target size={12} />
                        Strategic Mapping
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Career Domains</h1>
                    <p className="text-gray-500 mt-1">Explore specialized career trajectories.</p>
                </div>

                <div className="bg-white rounded-[2.5rem] p-16 shadow-sm border border-gray-100 text-center space-y-8">
                    <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto text-amber-400">
                        <Sparkles size={32} />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Intelligence Coming Soon</h2>
                        <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">
                            Domain exploration and automated role matching features are currently being indexed.
                        </p>
                    </div>

                    <button
                        onClick={() => router.push('/skills')}
                        className="px-8 py-3.5 bg-gray-900 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center gap-2 mx-auto active:scale-95 shadow-lg"
                    >
                        View Skills Analysis
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </>
    );
}

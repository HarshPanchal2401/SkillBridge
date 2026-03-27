'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/?auth=login');
    }, [router]);

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="animate-pulse text-green-500 font-black uppercase tracking-[0.3em] text-[10px]">
                Redirecting to Portal...
            </div>
        </div>
    );
}

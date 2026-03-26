'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface LoadingContextType {
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
}

let globalSetLoading: (loading: boolean) => void = () => {};

export const setGlobalLoading = (loading: boolean) => {
    globalSetLoading(loading);
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
    const [isLoading, setIsLoading] = useState(false);
    
    // Sync local state with global setter
    useEffect(() => {
        globalSetLoading = setIsLoading;
    }, []);

    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Automatically hide loading when pathname or searchParams change (navigation finished)
    useEffect(() => {
        setIsLoading(false);
    }, [pathname, searchParams]);

    return (
        <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
            {children}
            {isLoading && <LoadingBar />}
        </LoadingContext.Provider>
    );
}

export function useLoading() {
    const context = useContext(LoadingContext);
    if (!context) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
}

function LoadingBar() {
    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-1 overflow-hidden bg-transparent">
            <div className="h-full bg-gradient-to-r from-green-400 via-green-500 to-emerald-600 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-loading-bar origin-left" />
            <style jsx>{`
                @keyframes loading-bar {
                    0% {
                        transform: scaleX(0);
                        opacity: 1;
                    }
                    30% {
                        transform: scaleX(0.4);
                        opacity: 1;
                    }
                    60% {
                        transform: scaleX(0.8);
                        opacity: 1;
                    }
                    95% {
                        transform: scaleX(0.98);
                        opacity: 1;
                    }
                    100% {
                        transform: scaleX(1);
                        opacity: 0;
                    }
                }
                .animate-loading-bar {
                    animation: loading-bar 2.5s cubic-bezier(0.1, 0.05, 0, 1) infinite;
                }
            `}</style>
        </div>
    );
}

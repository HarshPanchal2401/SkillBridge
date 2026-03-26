'use client';

export default function Loading() {
    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-1 overflow-hidden bg-transparent">
            <div className="h-full bg-green-500 shadow-[0_0_10px_#22c55e,0_0_5px_#22c55e] animate-loading-bar origin-left" />
            <style jsx>{`
                @keyframes loading-bar {
                    0% { transform: scaleX(0); opacity: 1; }
                    50% { transform: scaleX(0.7); opacity: 1; }
                    100% { transform: scaleX(1); opacity: 0; }
                }
                .animate-loading-bar {
                    animation: loading-bar 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

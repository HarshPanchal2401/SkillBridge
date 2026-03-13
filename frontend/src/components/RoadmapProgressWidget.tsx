'use client';

import { Play, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface RoadmapStatus {
    has_active_roadmap: boolean;
    role?: string;
    type?: string;
    progress_percent?: number;
    hours_spent?: number;
}

export default function RoadmapProgressWidget({ status }: { status: RoadmapStatus }) {
    const router = useRouter();

    if (!status.has_active_roadmap) {
        return (
            <div className="card-simple bg-gradient-to-br from-green-50 to-blue-50 border-green-100 flex flex-col items-center text-center p-8">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                    <Play className="text-green-600 ml-1" size={24} fill="currentColor" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Kickstart Your AI Journey</h3>
                <p className="text-sm text-gray-500 mb-6 max-w-[240px]">
                    Generate a personalized roadmap to bridge your skill gaps with AI-curated content.
                </p>
                <button
                    onClick={() => router.push('/roadmap')}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md flex items-center gap-2"
                >
                    Generate Roadmap
                    <ArrowRight size={18} />
                </button>
            </div>
        );
    }

    return (
        <div className="card-simple border-green-100 shadow-sm overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Play size={80} />
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest rounded">Active Journey</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{status.type} Path</span>
                </div>

                <h3 className="text-xl font-black text-gray-900 mb-1">{status.role}</h3>
                <p className="text-xs text-gray-500 mb-6 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Clock size={12} /> {status.hours_spent}h spent</span>
                    <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {status.progress_percent}% Complete</span>
                </p>

                <div className="space-y-4">
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-1000"
                            style={{ width: `${status.progress_percent}%` }}
                        />
                    </div>

                    <button
                        onClick={() => router.push('/roadmap')}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-colors flex items-center justify-center gap-2"
                    >
                        Resume Learning
                        <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

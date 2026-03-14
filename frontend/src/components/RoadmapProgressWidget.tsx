'use client';

import { Play, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface RoadmapStatus {
    has_active_roadmap: boolean;
    latest?: {
        target_role: string;
        roadmap_type: string;
        progress_percent: number;
        hours_spent: number;
        active_milestone?: {
            id: string;
            name: string;
        };
    };
}

export default function RoadmapProgressWidget({ status }: { status: RoadmapStatus }) {
    const router = useRouter();

    if (!status.has_active_roadmap || !status.latest) {
        return (
            <div className="card-simple bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 flex flex-col items-center text-center p-8">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                    <Play className="text-blue-600 ml-1" size={24} fill="currentColor" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Kickstart Your Learning</h3>
                <p className="text-sm text-gray-500 mb-6 max-w-[240px]">
                    Generate a personalized roadmap to bridge your skill gaps with AI-curated content.
                </p>
                <button
                    onClick={() => router.push('/roadmap')}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md flex items-center gap-2"
                >
                    Generate Roadmap
                    <ArrowRight size={18} />
                </button>
            </div>
        );
    }

    const { latest } = status;

    return (
        <div className="card-simple border-blue-100 shadow-sm overflow-hidden group relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Play size={80} />
            </div>

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <span className="flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                        </div>
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Live Monitoring</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{latest.roadmap_type} Path</span>
                </div>

                <div className="mb-6">
                    <h3 className="text-xl font-black text-gray-900 mb-1">{latest.target_role}</h3>
                    {latest.active_milestone && (
                        <div className="flex items-center gap-1.5 text-blue-600">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Studying:</span>
                            <span className="text-xs font-bold truncate max-w-[200px]">{latest.active_milestone.name}</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                            <Clock size={12} />
                            <span className="text-[10px] font-bold uppercase">Time Spent</span>
                        </div>
                        <p className="text-lg font-black text-gray-900">{latest.hours_spent}h</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                            <CheckCircle2 size={12} />
                            <span className="text-[10px] font-bold uppercase">Progress</span>
                        </div>
                        <p className="text-lg font-black text-gray-900">{latest.progress_percent}%</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-50">
                        <div
                            className="h-full bg-blue-600 rounded-full shadow-lg transition-all duration-1000"
                            style={{ width: `${latest.progress_percent}%` }}
                        />
                    </div>

                    <button
                        onClick={() => router.push('/roadmap')}
                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-blue-200"
                    >
                        Resume Journey
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}

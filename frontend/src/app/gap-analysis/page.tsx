'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, Skill, GapAnalysis, MarketSkill } from '../../lib/api';
import {
    TrendingUp,
    Award,
    Target,
    AlertCircle,
    ChevronRight,
    BookOpen,
    Search,
    Zap,
    RefreshCw,
    CheckCircle2,
    Clock,
    ArrowUpRight,
    Star,
    Layers,
    Sparkles,
    Wifi
} from 'lucide-react';

interface SkillGap {
    skill: string;
    gap: number;
    demand_percentage: string;
    requirement_level: string;
    priority_label?: string;
    priority_id?: string;
    reasoning?: string;
    transferability?: number;
    market_demand?: number;
    user_proficiency?: number;
    impact?: string;
}

// The GapAnalysisResult interface is likely meant to be the GapAnalysis type.
// Assuming the imported GapAnalysis from '../../lib/api' is the canonical one,
// this local interface might be redundant or needs to be renamed if it represents
// a different structure. For now, keeping it as per instruction to only make specified changes.
interface GapAnalysisResult {
    target_role: { id: string; title: string };
    readiness: { score: number; interpretation: string; level: string };
    skills_analysis: {
        total_role_skills: number;
        user_skills_matched: number;
        skills_missing: number;
        match_percentage: number;
    };
    skill_gaps: {
        critical: SkillGap[];
        important: SkillGap[];
        emerging: SkillGap[];
    };
    immediate_learning?: SkillGap[];
    skill_learning?: SkillGap[];
    missing_skills: any[];
    matched_skills: any[];
    strengths: any[];
    course_recommendations: any[];
    skills_source?: string;
    learning_path: {
        immediate_focus: string[];
        next_steps: string[];
        future_skills: string[];
        estimated_months: number;
    };
    fetched_market_skills?: MarketSkill[];
}

export default function GapAnalysisPage() {
    const router = useRouter();
    const { user, profile, loading: authLoading } = useAuth();
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [analysis, setAnalysis] = useState<GapAnalysis | null>(null);
    const [userSkills, setUserSkills] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoAnalyzed, setAutoAnalyzed] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const targetRole = user?.target_role;
        if (targetRole && !selectedRole) {
            setSelectedRole(targetRole);
        }
    }, [user, profile, selectedRole]);

    useEffect(() => {
        if (selectedRole && user && !autoAnalyzed && !analysis) {
            setAutoAnalyzed(true);
            analyzeGaps();
        }
    }, [selectedRole, user, autoAnalyzed, analysis]);

    const analyzeGaps = async () => {
        if (!user || !selectedRole) return;
        setLoading(true);
        setError(null);
        setAnalysis(null);
        try {
            // Fetch raw user skills for the 'User Skill' section
            const rawSkills = await api.getUserSkills(user.id || '');
            setUserSkills(rawSkills);

            // Trigger the role analysis (which now has simplified logic)
            const result = await api.analyzeUserForRole(user.id || '', selectedRole);
            setAnalysis(result);

            // NEW: Automatically trigger roadmap regeneration for the personal path in background
            // This ensures that clicking "Analyze" also keeps the personalized roadmap in sync.
            api.generateRoadmap({
                user_id: user.id || '',
                target_role: selectedRole,
                roadmap_type: 'personal',
                language: "English"
            }).catch(e => console.error("Roadmap auto-sync failed:", e));
        } catch (err: any) {
            setError(err.message || 'Failed to analyze gaps');
        } finally {
            setLoading(false);
        }
    };

    const getReadinessColor = (level: string) => {
        switch (level) {
            case 'ready': return 'text-green-600 bg-green-50';
            case 'developing': return 'text-amber-600 bg-amber-50';
            default: return 'text-red-600 bg-red-50';
        }
    };


    if (loading || authLoading) {
        return (
            <>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
                    <p className="text-gray-400 text-sm animate-pulse">Scanning market signals...</p>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="space-y-8 animate-fade-in">
                {/* Minimalist Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold uppercase tracking-wider mb-3">
                            <Target size={12} />
                            Strategic Alignment
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                            Gap Analysis
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Direct comparison between your profile and global market demand.
                        </p>
                    </div>
                </div>

                {/* Target Role Input */}
                <div className="card-simple">
                    <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Sparkles size={12} className="text-green-600" />
                        Target Vector
                    </h2>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-green-600 transition-colors" size={18} />
                            <input
                                type="text"
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                placeholder="e.g. Backend Engineer, Data Scientist..."
                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent focus:border-green-500 focus:bg-white rounded-xl font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all text-sm"
                            />
                        </div>
                        <button
                            onClick={analyzeGaps}
                            disabled={!selectedRole.trim() || loading}
                            className="px-8 py-3.5 bg-gray-900 text-white rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-gray-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 min-w-[160px]"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                            Analyze IQ
                        </button>
                    </div>
                    <p className="text-[9px] font-bold text-gray-400 mt-4 uppercase tracking-widest text-center">
                        Our engine will index the latest high-fidelity market data via live web search.
                    </p>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 animate-slide-down">
                        <AlertCircle size={18} />
                        <span className="text-sm font-bold">{error}</span>
                    </div>
                )}

                {analysis && (
                    <div className="space-y-8">
                        {/* Readiness Metric Card */}
                        <div className="card-simple overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -mr-20 -mt-20"></div>

                            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
                                <div className="space-y-4 text-center lg:text-left">
                                    <div className="space-y-1">
                                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{analysis.target_role?.title || 'Target Role'}</h2>
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Market Readiness Profile</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-start">
                                        <div className={`px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider ${getReadinessColor(analysis.readiness?.level || 'early')}`}>
                                            {analysis.readiness?.level || 'Developing'}
                                        </div>
                                        {analysis.skills_source && (
                                            <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 border border-blue-100">
                                                <Wifi size={12} />
                                                Live Analytics
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm font-medium text-gray-500 max-w-lg leading-relaxed">{analysis.readiness?.interpretation || analysis.interpretation || "We've analyzed your skills against market data."}</p>
                                </div>

                                <div className="flex flex-col items-center">
                                    <div className="relative w-40 h-40 flex items-center justify-center">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="80" cy="80" r="70" stroke="#f3f4f6" strokeWidth="12" fill="none" />
                                            <circle
                                                cx="80" cy="80" r="70"
                                                stroke="#22c55e"
                                                strokeWidth="12"
                                                fill="none"
                                                strokeDasharray={`${(analysis.readiness?.score || analysis.overall_readiness) * 4.4} 440`}
                                                strokeLinecap="round"
                                                className="transition-all duration-1000"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-4xl font-black text-gray-900">{Math.round(analysis.readiness?.score || analysis.overall_readiness)}%</span>
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Compatibility</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mt-12 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                                {[
                                    { label: 'Resume Skills', value: userSkills.length, icon: CheckCircle2, color: 'text-green-600' },
                                    { label: 'Market Skills', value: analysis.fetched_market_skills?.length || 0, icon: Target, color: 'text-blue-600' },
                                ].map((stat, i) => (
                                    <div key={i} className="text-center md:text-left space-y-1">
                                        <div className="flex items-center gap-2 justify-center md:justify-start">
                                            <stat.icon size={14} className={stat.color} />
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</span>
                                        </div>
                                        <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gap Analysis Sections */}
                        <div className="grid grid-cols-1 gap-12">
                            {/* 1. User Skill Section */}
                            <div className="card-simple animate-fade-in">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center justify-between">
                                    User Skill (Your Raw Fetched Skills)
                                    <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[9px] rounded-lg border border-green-100 italic">Fetched from Profile</span>
                                </h3>
                                <div className="flex flex-wrap gap-4">
                                    {userSkills.length > 0 ? (
                                        userSkills.map((s, i) => (
                                            <div key={i} className="group px-6 py-4 bg-green-50/50 hover:bg-white hover:shadow-lg text-green-700 border border-green-100 rounded-2xl text-[12px] font-bold flex flex-col gap-2 transition-all min-w-[200px] animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-green-100 text-green-700 rounded-lg flex items-center justify-center">
                                                        <CheckCircle2 size={16} />
                                                    </div>
                                                    {s.skill_name || s.skill}
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[9px] uppercase tracking-widest text-gray-400">Proficiency</span>
                                                        <span className="text-[10px] font-black">{Math.round((s.proficiency || s.user_proficiency || 0) * (s.proficiency <= 1 ? 100 : 1))}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-green-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-green-600 rounded-full" style={{ width: `${(s.proficiency || s.user_proficiency || 0) * (s.proficiency <= 1 ? 100 : 1)}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="w-full text-center py-12 opacity-20">
                                            <TrendingUp size={32} className="mx-auto mb-3" />
                                            <p className="text-[10px] font-bold uppercase tracking-widest">No verified skills found in profile</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 2. Market Skill Section */}
                            <div className="card-simple relative overflow-hidden group animate-fade-in">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <TrendingUp size={64} className="text-green-600" />
                                </div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center justify-between relative z-10">
                                    Market Skill (Industry Required Competencies)
                                    <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[9px] rounded-lg border border-green-100 flex items-center gap-1 uppercase italic">
                                        <TrendingUp size={8} />
                                        Demand Spectrum
                                    </span>
                                </h3>

                                <div className="space-y-4 relative z-10">
                                    {analysis.fetched_market_skills && analysis.fetched_market_skills.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                            {analysis.fetched_market_skills.map((marketSkill: MarketSkill, i: number) => (
                                                <div key={i} className="flex flex-col p-3.5 bg-gray-50/50 rounded-xl border border-transparent hover:border-gray-200 hover:bg-white transition-all group/item shadow-sm">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${marketSkill.requirement_level === 'critical' ? 'bg-red-500' :
                                                                marketSkill.requirement_level === 'important' ? 'bg-amber-500' : 'bg-blue-500'
                                                                }`}></div>
                                                            <span className="text-xs font-bold text-gray-800">{marketSkill.skill}</span>
                                                            {marketSkill.llm_validated && (
                                                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[8px] font-black uppercase tracking-tighter border border-indigo-100/50">
                                                                    AI ✦
                                                                </span>
                                                            )}
                                                            {marketSkill.trending && (
                                                                <Sparkles size={10} className="text-amber-500 animate-pulse" />
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">
                                                            {marketSkill.demand_percentage}
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ${marketSkill.demand >= 0.7 ? 'bg-green-500' :
                                                                marketSkill.demand >= 0.4 ? 'bg-amber-500' : 'bg-blue-400'
                                                                }`}
                                                            style={{ width: marketSkill.demand_percentage }}
                                                        ></div>
                                                    </div>
                                                    <div className="flex justify-between items-center mt-2">
                                                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{marketSkill.requirement_level}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 opacity-30">
                                            <Search size={48} className="mx-auto mb-4" />
                                            <p className="text-[10px] font-bold uppercase tracking-widest">No market signals captured</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. Gap Section */}
                            <div className="card-simple relative overflow-hidden group animate-fade-in">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Target size={64} className="text-red-600" />
                                </div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center justify-between relative z-10">
                                    Skill Gaps (Top Priorities for Growth)
                                    <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[9px] rounded-lg border border-red-100 flex items-center gap-1 uppercase italic">
                                        <AlertCircle size={8} />
                                        Priority Gaps
                                    </span>
                                </h3>

                                <div className="space-y-6 relative z-10">
                                    {analysis.skill_gaps && (analysis.skill_gaps.critical.length > 0 || analysis.skill_gaps.important.length > 0) ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                            {/* Critical Gaps */}
                                            {analysis.skill_gaps.critical.map((gap: MarketSkill, i: number) => (
                                                <div key={`critical-${i}`} className="flex flex-col p-4 bg-red-50/40 rounded-2xl border border-red-100 hover:border-red-200 hover:bg-white transition-all group/item shadow-sm">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                                                            <span className="text-sm font-bold text-gray-800 tracking-tight">{gap.skill}</span>
                                                        </div>
                                                        <span className="text-[10px] font-black text-red-600 bg-red-100/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                            {gap.demand_percentage}
                                                        </span>
                                                    </div>

                                                    {gap.reasoning && (
                                                        <p className="text-[10px] text-gray-500 leading-relaxed mb-3 italic line-clamp-2 group-hover/item:line-clamp-none transition-all duration-300">
                                                            "{gap.reasoning}"
                                                        </p>
                                                    )}

                                                    <div className="w-full h-1.5 bg-red-100/50 rounded-full overflow-hidden mb-3">
                                                        <div className="h-full bg-red-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(239,68,68,0.3)]" style={{ width: gap.demand_percentage }}></div>
                                                    </div>

                                                    <div className="mt-auto flex justify-between items-center">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest leading-none">
                                                                    {gap.priority_label || 'Critical'}
                                                                </span>
                                                                {gap.transferability !== undefined && gap.transferability > 0.4 && (
                                                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[7px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-0.5">
                                                                        <Wifi size={8} /> Transferable
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {gap.priority_id === 'immediate' && (
                                                                <span className="text-[7px] font-bold text-red-400 uppercase tracking-tighter">
                                                                    Action Required
                                                                </span>
                                                            )}
                                                        </div>
                                                        <Zap size={12} className="text-amber-500 fill-amber-500 opacity-50 group-hover/item:opacity-100 transition-opacity" />
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Important Gaps */}
                                            {analysis.skill_gaps.important.map((gap: MarketSkill, i: number) => (
                                                <div key={`important-${i}`} className="flex flex-col p-4 bg-amber-50/40 rounded-2xl border border-amber-100 hover:border-amber-200 hover:bg-white transition-all group/item shadow-sm">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                                            <span className="text-sm font-bold text-gray-800 tracking-tight">{gap.skill}</span>
                                                        </div>
                                                        <span className="text-[10px] font-black text-amber-600 bg-amber-100/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                            {gap.demand_percentage}
                                                        </span>
                                                    </div>

                                                    {gap.reasoning && (
                                                        <p className="text-[10px] text-gray-600/70 leading-relaxed mb-3 line-clamp-2 group-hover/item:line-clamp-none transition-all duration-300">
                                                            {gap.reasoning}
                                                        </p>
                                                    )}

                                                    <div className="w-full h-1.5 bg-amber-100/50 rounded-full overflow-hidden mb-3">
                                                        <div className="h-full bg-amber-500 rounded-full transition-all duration-1000" style={{ width: gap.demand_percentage }}></div>
                                                    </div>

                                                    <div className="mt-auto flex justify-between items-center">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${gap.priority_id === 'low' ? 'text-blue-500' : 'text-amber-500'
                                                                    }`}>
                                                                    {gap.priority_label || 'Important'}
                                                                </span>
                                                                {gap.transferability !== undefined && gap.transferability > 0.6 && (
                                                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[7px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-0.5">
                                                                        <Wifi size={8} /> High Transfer
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {gap.priority_id === 'low' && (
                                                                <span className="text-[7px] font-bold text-gray-400 uppercase tracking-tighter">
                                                                    Maintenance Level
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 opacity-30">
                                            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
                                            <p className="text-[10px] font-bold uppercase tracking-widest">No significant gaps detected</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </>
    );
}

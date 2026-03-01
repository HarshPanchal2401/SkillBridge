'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import {
    Target,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    ChevronRight,
    Loader2,
    Zap,
    Clock,
    Wifi,
    RefreshCw,
    Search,
    ArrowUpRight,
    Sparkles
} from 'lucide-react';

interface SkillGap {
    skill: string;
    gap: number;
    demand_percentage: number;
    requirement_level: string;
    market_demand?: number;
    user_proficiency?: number;
    impact?: string;
}

interface MarketSkill {
    skill: string;
    demand: number;
    demand_percentage: string;
    requirement_level: string;
    trending: boolean;
}

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
    const [analysis, setAnalysis] = useState<GapAnalysisResult | null>(null);
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
            const result = await api.analyzeUserForRole(user.id || '', selectedRole);
            setAnalysis(result);
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

    if (authLoading) {
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
                        <AlertTriangle size={18} />
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
                                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{analysis.target_role.title}</h2>
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Market Readiness Profile</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-start">
                                        <div className={`px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider ${getReadinessColor(analysis.readiness.level)}`}>
                                            {analysis.readiness.level}
                                        </div>
                                        {analysis.skills_source && (
                                            <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 border border-blue-100">
                                                <Wifi size={12} />
                                                Live Analytics
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm font-medium text-gray-500 max-w-lg leading-relaxed">{analysis.readiness.interpretation}</p>
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
                                                strokeDasharray={`${analysis.readiness.score * 4.4} 440`}
                                                strokeLinecap="round"
                                                className="transition-all duration-1000"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-4xl font-black text-gray-900">{Math.round(analysis.readiness.score)}%</span>
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Compatibility</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                                {[
                                    { label: 'Verified Nodes', value: analysis.skills_analysis.user_skills_matched, icon: CheckCircle, color: 'text-green-600' },
                                    { label: 'Identified Gaps', value: analysis.skills_analysis.skills_missing, icon: Zap, color: 'text-amber-600' },
                                    { label: 'Time To Mastery', value: `${analysis.learning_path.estimated_months}m`, icon: Clock, color: 'text-blue-600' },
                                    { label: 'Match Ratio', value: `${Math.round(analysis.skills_analysis.match_percentage)}%`, icon: Target, color: 'text-purple-600' },
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

                        {/* Gaps Grid */}
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Critical Node Gaps */}
                            <div className="card-simple">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center justify-between">
                                    Critical Deficiencies ({'>'}70% Gap)
                                    <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[9px] rounded-lg">{analysis.skill_gaps.critical.length}</span>
                                </h3>
                                {analysis.skill_gaps.critical.length === 0 ? (
                                    <div className="text-center py-10 opacity-30">
                                        <CheckCircle size={32} className="mx-auto mb-3" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest">Minimal Friction</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {analysis.skill_gaps.critical.map((gap: any, i: number) => (
                                            <div key={i} className="group p-4 bg-gray-50 hover:bg-white border border-transparent hover:border-red-100 rounded-xl transition-all">
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-sm font-bold text-gray-900">{gap.skill}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-red-600 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                                                            {Math.round(gap.gap)}% Gap
                                                        </span>
                                                        <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest">Urgent</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-red-500 rounded-full transition-all duration-1000"
                                                            style={{ width: `${gap.demand_percentage || gap.market_demand}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter w-12 text-right">
                                                        {Math.round(gap.demand_percentage || gap.market_demand)}% Demand
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Learning Velocity (Learning Path) */}
                            <div className="card-simple">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center justify-between">
                                    Skill Gap Bridge
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] rounded-lg">Priority Learning</span>
                                </h3>
                                <div className="space-y-6">
                                    {[
                                        {
                                            id: 'immediate',
                                            label: 'Immediate Learning (>70%)',
                                            items: analysis.immediate_learning || [],
                                            color: 'text-red-500',
                                            bg: 'bg-red-50',
                                            border: 'border-red-100'
                                        },
                                        {
                                            id: 'next',
                                            label: 'Skill Learning (30-70%)',
                                            items: analysis.skill_learning || [],
                                            color: 'text-amber-500',
                                            bg: 'bg-amber-50',
                                            border: 'border-amber-100'
                                        },
                                    ].map((stage) => (
                                        <div key={stage.id} className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1 h-6 rounded-full ${stage.color} bg-current`}></div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stage.label}</span>
                                            </div>
                                            <div className="flex flex-col gap-2 pl-3">
                                                {stage.items && stage.items.length > 0 ? (
                                                    stage.items.map((gap: any, i: number) => (
                                                        <div key={i} className={`p-2 rounded-lg border ${stage.border} ${stage.bg} flex justify-between items-center`}>
                                                            <span className={`text-[11px] font-bold ${stage.color} uppercase tracking-tight`}>
                                                                {gap.skill}
                                                            </span>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase">
                                                                    {Math.round(gap.demand_percentage || gap.market_demand || 0)}% Demand
                                                                </span>
                                                                <span className={`text-[10px] font-black ${stage.color} bg-white/50 px-2 py-0.5 rounded border border-current/10`}>
                                                                    {Math.round(gap.gap)}% GAP
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] font-bold text-gray-300 italic">No nodes identified</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        onClick={() => router.push('/roadmap')}
                                        className="w-full mt-4 py-3.5 bg-gray-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                                    >
                                        Execute Path
                                        <ArrowUpRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Competencies and Market Intelligence Grid */}
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Inventory Context (Matched) */}
                            <div className="card-simple">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 px-1">Verified Competencies</h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.strengths.length > 0 ? (
                                        analysis.strengths.map((s, i) => (
                                            <div key={i} className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-100 rounded-xl text-[10px] font-bold flex items-center gap-2 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                                                <CheckCircle size={12} />
                                                {s.skill}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="w-full text-center py-6 opacity-20">
                                            <TrendingUp size={24} className="mx-auto mb-2" />
                                            <p className="text-[10px] font-bold uppercase">Zero confirmed nodes</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* LIVE MARKET PLUS Section */}
                            <div className="card-simple relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <TrendingUp size={48} className="text-green-600" />
                                </div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center justify-between relative z-10">
                                    LIVE MARKET PLUS
                                    <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[9px] rounded-lg border border-green-100 flex items-center gap-1">
                                        <TrendingUp size={8} />
                                        Demand Spectrum
                                    </span>
                                </h3>

                                <div className="space-y-4 relative z-10">
                                    {analysis.fetched_market_skills && analysis.fetched_market_skills.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {analysis.fetched_market_skills.map((marketSkill, i) => (
                                                <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50/50 rounded-xl border border-transparent hover:border-gray-200 hover:bg-white transition-all group/item">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${marketSkill.requirement_level === 'critical' ? 'bg-red-500' :
                                                            marketSkill.requirement_level === 'important' ? 'bg-amber-500' : 'bg-blue-500'
                                                            }`}></div>
                                                        <span className="text-xs font-bold text-gray-700">{marketSkill.skill}</span>
                                                        {marketSkill.trending && (
                                                            <Sparkles size={10} className="text-amber-500 animate-pulse" />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                                                            {marketSkill.demand_percentage}
                                                        </span>
                                                        <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-1000 ${marketSkill.demand >= 0.7 ? 'bg-green-500' :
                                                                    marketSkill.demand >= 0.4 ? 'bg-amber-500' : 'bg-blue-400'
                                                                    }`}
                                                                style={{ width: marketSkill.demand_percentage }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 opacity-30">
                                            <Search size={32} className="mx-auto mb-3" />
                                            <p className="text-[10px] font-bold uppercase tracking-widest">No market signals</p>
                                        </div>
                                    )}
                                </div>
                                <p className="text-[9px] font-bold text-gray-400 mt-6 uppercase tracking-widest text-center">
                                    Real-time indices sorted by global industry demand
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

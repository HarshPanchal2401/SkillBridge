'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, Skill, GapAnalysis } from '../../lib/api';
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
    SearchCode,
    ChevronDown,
    ChevronUp,
    Briefcase,
    Globe
} from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    AreaChart,
    Area,
} from 'recharts';

const PROFICIENCY_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#6366f1', '#ec4899', '#f43f5e'];

interface SkillCourseInfo {
    loading: boolean;
    courses: any[];
}

export default function SkillsPage() {
    const { user, loading: authLoading, userId, gapAnalysis: globalGapAnalysis, refreshGapAnalysis } = useAuth();
    const router = useRouter();
    const [skills, setSkills] = useState<Skill[]>([]);
    const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [roleInput, setRoleInput] = useState('');
    const [skillCourses, setSkillCourses] = useState<Record<string, SkillCourseInfo>>({});
    const [filter, setFilter] = useState<'all' | 'matches' | 'gaps'>('all');

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        } else if (userId) {
            loadData();
        }
    }, [user, authLoading, userId]);

    const loadData = async () => {
        if (!userId) return;
        try {
            // First check if we have global gapAnalysis
            let currentGap = globalGapAnalysis;

            const [skillsData] = await Promise.all([
                api.getUserSkills(userId).catch(() => []),
            ]);

            if (!currentGap) {
                // If not in global state, fetch it once
                currentGap = await refreshGapAnalysis();
            }

            setSkills(skillsData);
            setGapAnalysis(currentGap);

            if (currentGap?.target_role?.title) {
                setRoleInput(currentGap.target_role.title);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleAnalysis = async (roleToAnalyze: string) => {
        if (!userId || !roleToAnalyze.trim()) return;
        setIsAnalyzing(true);
        setSkillCourses({});
        try {
            const result = await api.analyzeUserForRole(userId, roleToAnalyze);
            setGapAnalysis(result);
        } catch (error) {
            console.error('Role analysis failed:', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleCourseRecommendations = async (skillName: string) => {
        if (skillCourses[skillName]) {
            // Toggle logic can be added here if needed to collapse
            return;
        }

        setSkillCourses(prev => ({
            ...prev,
            [skillName]: { loading: true, courses: [] }
        }));

        try {
            const result = await api.searchCoursesForSkill(skillName);
            setSkillCourses(prev => ({
                ...prev,
                [skillName]: { loading: false, courses: result.courses || result || [] }
            }));
        } catch (error) {
            console.error(`Failed to fetch courses for ${skillName}:`, error);
            setSkillCourses(prev => ({
                ...prev,
                [skillName]: { loading: false, courses: [] }
            }));
        }
    };

    const analyticsData = useMemo(() => {
        const topSkills = [...skills]
            .sort((a, b) => b.proficiency - a.proficiency)
            .slice(0, 6)
            .map(s => ({
                name: s.skill_name,
                proficiency: Math.round(s.proficiency * 100)
            }));

        const sourceCounts: Record<string, number> = {};
        skills.forEach(skill => {
            let sources: string[] = ['other'];
            if (typeof skill.sources === 'string') {
                try {
                    const parsed = JSON.parse(skill.sources);
                    sources = Array.isArray(parsed) ? parsed : [skill.sources];
                } catch {
                    sources = skill.sources.split(',').map(s => s.trim());
                }
            } else if (Array.isArray(skill.sources)) {
                sources = skill.sources;
            }
            sources.forEach(src => {
                const type = src.split(':')[0] || 'other';
                sourceCounts[type] = (sourceCounts[type] || 0) + 1;
            });
        });

        const sourceData = Object.entries(sourceCounts).map(([name, value], i) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
            color: PROFICIENCY_COLORS[i % PROFICIENCY_COLORS.length],
        }));

        return { topSkills, sourceData };
    }, [skills]);

    if (authLoading || loading) {
        return (
            <>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
                    <p className="text-gray-400 text-sm animate-pulse">Syncing your skills...</p>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="space-y-8 animate-fade-in">
                {/* Minimal Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold uppercase tracking-wider mb-3">
                            <Sparkles size={12} />
                            Skills Analytics
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                            Market Readiness
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Analyze your expertise against current industry demands.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto max-w-md">
                        <div className="relative flex-1 group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                <SearchCode size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="Target Role..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 focus:border-green-500 rounded-xl outline-none transition-all text-sm shadow-sm"
                                value={roleInput}
                                onChange={(e) => setRoleInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleRoleAnalysis(roleInput)}
                            />
                        </div>
                        <button
                            onClick={() => handleRoleAnalysis(roleInput)}
                            disabled={isAnalyzing}
                            className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {isAnalyzing ? <RefreshCw className="animate-spin" size={16} /> : 'Analyze'}
                        </button>
                    </div>
                </div>

                {/* Key Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Proficiency', value: skills.length, icon: Award, color: 'text-green-600', bg: 'bg-green-50' },
                        { label: 'Market Matches', value: gapAnalysis?.matched_skills?.length || 0, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Growth Areas', value: gapAnalysis?.missing_skills?.length || 0, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
                        { label: 'Readiness', value: `${Math.round(gapAnalysis?.overall_readiness || 0)}%`, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50' },
                    ].map((stat, i) => (
                        <div key={i} className="card-simple">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                                    <stat.icon size={20} />
                                </div>
                                <ArrowUpRight className="text-gray-300" size={16} />
                            </div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
                            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="grid lg:grid-cols-12 gap-8">

                    {/* Left: Skill Explorer */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-900">Skill Inventory</h3>
                            <div className="flex p-1 bg-gray-50 rounded-lg border border-gray-100">
                                {['all', 'matches', 'gaps'].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setFilter(t as any)}
                                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${filter === t ? 'bg-white text-green-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Skill Gaps */}
                                {(filter === 'all' || filter === 'gaps') && gapAnalysis?.missing_skills?.map((gap: any, i: number) => (
                                    <div key={`gap-${i}`} className="card-simple border-l-4 border-l-amber-400 group p-5 flex flex-col h-full transition-all">
                                        <div className="flex items-start justify-between gap-4 min-w-0">
                                            <div className="flex items-start gap-4 min-w-0">
                                                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm mt-0.5">
                                                    {gap.skill.charAt(0)}
                                                </div>
                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4 className="font-bold text-gray-900 uppercase text-xs tracking-tight break-words">{gap.skill}</h4>
                                                        {gap.matched_as && gap.matched_as !== gap.skill && (
                                                            <span className="text-[9px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded italic">
                                                                Matched as: {gap.matched_as}
                                                            </span>
                                                        )}
                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider flex-shrink-0 ${gap.requirement_level === 'critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                                            {gap.requirement_level}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 font-medium truncate">Required for {gapAnalysis?.target_role?.title || 'Target Role'}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleCourseRecommendations(gap.skill)}
                                                className="p-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-sm flex-shrink-0 mt-0.5"
                                                title="Explore Courses"
                                            >
                                                <BookOpen size={16} />
                                            </button>
                                        </div>

                                        {/* Proficiency Level */}
                                        <div className="mt-3 space-y-1.5">
                                            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest px-0.5">
                                                <span className="text-gray-400">Your Proficiency</span>
                                                <span className={`font-black ${(gap.user_proficiency || 0) > 0 ? 'text-amber-600' : 'text-red-500'}`}>{Math.round((gap.user_proficiency || 0) * 100)}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${(gap.user_proficiency || 0) > 0 ? 'bg-amber-400' : 'bg-red-300'}`}
                                                    style={{ width: `${Math.max((gap.user_proficiency || 0) * 100, 2)}%` }}
                                                />
                                            </div>
                                        </div>

                                        {skillCourses[gap.skill] && (
                                            <div className="mt-4 pt-4 border-t border-gray-50 space-y-3 animate-fade-in">
                                                {skillCourses[gap.skill].loading ? (
                                                    <div className="flex items-center justify-center py-2">
                                                        <RefreshCw className="animate-spin text-gray-300" size={14} />
                                                    </div>
                                                ) : skillCourses[gap.skill].courses.length > 0 ? (
                                                    <div className="grid gap-2">
                                                        {skillCourses[gap.skill].courses.slice(0, 3).map((c: any, ci: number) => (
                                                            <a key={ci} href={c.url} target="_blank" className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 transition-all group">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <div className="space-y-1">
                                                                        <p className="text-[10px] font-bold text-gray-700 line-clamp-1 leading-tight">{c.title}</p>
                                                                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{c.platform || 'Learning Platform'}</p>
                                                                    </div>
                                                                    <ArrowUpRight size={10} className="text-gray-300 group-hover:text-green-500 flex-shrink-0" />
                                                                </div>
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[9px] text-gray-400 italic text-center">No curated courses found currently.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Existing Skills / Matches */}
                                {filter === 'matches' && gapAnalysis?.matched_skills?.map((match, i) => (
                                    <div key={`match-${i}`} className="card-simple border-l-4 border-l-green-400 group p-5 flex flex-col h-full transition-all">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center font-bold text-sm">
                                                {match.skill.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-900 uppercase text-xs tracking-tight truncate">{match.skill}</h4>
                                                {match.matched_as && match.matched_as !== match.skill && (
                                                    <p className="text-[10px] text-green-600 font-bold italic">Matched as: {match.matched_as}</p>
                                                )}
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="flex items-center gap-1">
                                                        <CheckCircle2 size={10} className="text-green-500" />
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Market Match</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest px-0.5">
                                                <span className="text-gray-400">Your Proficiency</span>
                                                <span className="text-green-600 font-black">{Math.round((match.user_proficiency || 0) * 100)}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                                <div
                                                    className="h-full bg-green-500 rounded-full transition-all duration-1000"
                                                    style={{ width: `${(match.user_proficiency || 0) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {filter === 'all' && skills.sort((a, b) => b.proficiency - a.proficiency).map((skill, i) => (
                                    <div key={skill.id || i} className="card-simple group p-5 flex flex-col h-full transition-all">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center font-bold text-sm">
                                                {skill.skill_name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-900 uppercase text-xs tracking-tight truncate">{skill.skill_name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="flex items-center gap-1">
                                                        <Star size={10} className="text-amber-400 fill-amber-400" />
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Verified</span>
                                                    </div>
                                                    <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                                        {Array.isArray(skill.sources) ? (typeof skill.sources[0] === 'string' ? skill.sources[0].split(':')[0] : 'Portfolio') : 'Portfolio'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest px-0.5">
                                                <span className="text-gray-400">Expertise Level</span>
                                                <span className="text-green-600 font-black">{Math.round(skill.proficiency * 100)}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                                <div
                                                    className="h-full bg-green-500 rounded-full transition-all duration-1000"
                                                    style={{ width: `${skill.proficiency * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Insights Sidebar */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Forecast Card */}
                        <div className="card-simple bg-gray-50 border-gray-100 space-y-6 shadow-sm">
                            <div className="flex items-center gap-2 text-blue-600">
                                <Clock size={16} />
                                <h4 className="text-[10px] font-bold uppercase tracking-widest">Learning Forecast</h4>
                            </div>
                            <div className="space-y-1">
                                <p className="text-4xl font-bold tracking-tight text-gray-900">4.2<span className="text-base text-gray-500 ml-2 font-medium uppercase tracking-widest text-[10px]">Months</span></p>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Projected timeline to achieve full readiness for your target role based on your current learning velocity.
                                </p>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full w-2/3 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]"></div>
                            </div>
                            <button
                                onClick={() => router.push('/roadmap')}
                                className="w-full py-3 bg-white border border-gray-200 text-gray-900 rounded-xl text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Globe size={14} />
                                View Roadmap
                            </button>
                        </div>

                        {/* Composition Chart */}
                        <div className="card-simple h-[320px] flex flex-col">
                            <div className="flex items-center gap-2 mb-6">
                                <Layers className="text-green-600" size={16} />
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-900">Skill Origin</h4>
                            </div>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analyticsData.sourceData}
                                            innerRadius={55}
                                            outerRadius={80}
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {analyticsData.sourceData.map((entry, index) => (
                                                <Cell key={index} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '12px' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                                {analyticsData.sourceData.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div>
                                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tight truncate">{s.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Market Intelligence */}
                        {gapAnalysis?.fetched_market_skills && gapAnalysis.fetched_market_skills.length > 0 && (
                            <div className="card-simple">
                                <div className="flex items-center gap-2 text-blue-600 mb-4">
                                    <TrendingUp size={16} />
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest">Live Market Pulse</h4>
                                </div>
                                <div className="space-y-2">
                                    {gapAnalysis.fetched_market_skills.slice(0, 5).map((ms: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-100 transition-colors">
                                            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">{ms.skill}</span>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 rounded-lg">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                                <span className="text-[9px] font-black text-blue-600 uppercase">Hot</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button className="w-full mt-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-green-600 transition-colors">
                                    Comprehensive Report
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

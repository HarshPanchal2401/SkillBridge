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
    Globe,
    Wifi
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

/**
 * Check if a skill was refined by the Groq LLM.
 * The sources array contains 'llm_refined' as a marker when Groq refined the score.
 */
function isLlmRefined(skill: Skill): boolean {
    let sources: string[] = [];
    if (typeof skill.sources === 'string') {
        try {
            const parsed = JSON.parse(skill.sources);
            sources = Array.isArray(parsed) ? parsed : [skill.sources];
        } catch {
            sources = [skill.sources];
        }
    } else if (Array.isArray(skill.sources)) {
        sources = skill.sources as string[];
    }
    return sources.includes('llm_refined');
}

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
    const [filter, setFilter] = useState<'User Skill' | 'Market Skill' | 'Gap'>('User Skill');

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

            if (!currentGap || !currentGap.missing_skills) {
                // If not in global state or if it's the old cached version without missing_skills
                currentGap = await refreshGapAnalysis(true);
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
                        { label: 'Profile Skills', value: skills.length, icon: Award, color: 'text-green-600', bg: 'bg-green-50' },
                        { label: 'Market Skills', value: gapAnalysis?.fetched_market_skills?.length || 0, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Growth Tracking', value: 'Active', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
                        { label: 'Market Readiness', value: `${Math.round(gapAnalysis?.overall_readiness || 0)}%`, icon: Star, color: 'text-purple-600', bg: 'bg-purple-50' },
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
                                {['User Skill', 'Market Skill', 'Gap'].map((t) => (
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
                                {/* Gap Filter (Actual Gaps) */}
                                {filter === 'Gap' && (
                                    <>
                                        {gapAnalysis?.missing_skills && gapAnalysis.missing_skills.length > 0 ? (
                                            gapAnalysis.missing_skills.map((ms: any, i: number) => (
                                                <div key={`gap-${i}`} className="card-simple border-l-4 border-l-red-400 group p-5 flex flex-col h-full transition-all">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-bold text-sm">
                                                            {ms.skill.charAt(0)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="font-bold text-gray-900 uppercase text-xs tracking-tight truncate">{ms.skill}</h4>
                                                                {ms.llm_validated && (
                                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[8px] font-black uppercase tracking-widest flex-shrink-0">
                                                                        AI ✦
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <AlertCircle size={10} className="text-red-500" />
                                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Priority Gap</span>
                                                                    {ms.transferability !== undefined && ms.transferability > 0.4 && (
                                                                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[7px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-0.5">
                                                                            <Wifi size={8} /> Transferable
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {ms.reasoning && (
                                                        <p className="text-[10px] text-gray-500 leading-relaxed mb-4 italic line-clamp-2 hover:line-clamp-none transition-all">
                                                            "{ms.reasoning}"
                                                        </p>
                                                    )}

                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest px-0.5">
                                                            <span className="text-gray-400">Industry Frequency</span>
                                                            <span className="text-red-600 font-black">{ms.demand_percentage}</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-red-500 rounded-full transition-all duration-1000"
                                                                style={{ width: ms.demand_percentage }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-full py-20 text-center opacity-30">
                                                <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
                                                <p className="text-[10px] font-bold uppercase tracking-widest">No critical gaps captured</p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Market Skill Filter (Full Market Requirements) */}
                                {filter === 'Market Skill' && gapAnalysis?.fetched_market_skills?.map((ms: any, i: number) => (
                                    <div key={`market-${i}`} className="card-simple border-l-4 border-l-blue-400 group p-5 flex flex-col h-full transition-all">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-sm">
                                                {ms.skill.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-bold text-gray-900 uppercase text-xs tracking-tight truncate">{ms.skill}</h4>
                                                    {ms.llm_validated && (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[8px] font-black uppercase tracking-widest flex-shrink-0">
                                                            AI ✦
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="flex items-center gap-1">
                                                        <TrendingUp size={10} className="text-blue-500" />
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Market Demand</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest px-0.5">
                                                <span className="text-gray-400">Industry Frequency</span>
                                                <span className="text-blue-600 font-black">{ms.demand_percentage}</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                                                    style={{ width: ms.demand_percentage }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* User Skill Filter (Only Raw Skills) */}
                                {filter === 'User Skill' && skills.sort((a, b) => b.proficiency - a.proficiency).map((skill, i) => {
                                    const aiRefined = isLlmRefined(skill);
                                    const prof = (skill.proficiency || 0) * (skill.proficiency <= 1 ? 100 : 1);
                                    return (
                                        <div key={skill.id || i} className={`card-simple group p-5 flex flex-col h-full transition-all ${aiRefined ? 'hover:border-purple-100' : ''}`}>
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${aiRefined ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-600'}`}>
                                                    {skill.skill_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="font-bold text-gray-900 uppercase text-xs tracking-tight truncate">{skill.skill_name}</h4>
                                                        {aiRefined && (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-50 text-purple-600 border border-purple-100 rounded text-[8px] font-black uppercase tracking-widest flex-shrink-0">
                                                                AI ✦
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className="flex items-center gap-1">
                                                            {aiRefined ? (
                                                                <Sparkles size={10} className="text-purple-400" />
                                                            ) : (
                                                                <Star size={10} className="text-amber-400 fill-amber-400" />
                                                            )}
                                                            <span className={`text-[9px] font-bold uppercase tracking-widest ${aiRefined ? 'text-purple-400' : 'text-gray-400'}`}>
                                                                {aiRefined ? 'LLM Verified' : 'Resume Detected'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest px-0.5">
                                                    <span className="text-gray-400">Expertise Level</span>
                                                    <span className={`font-black ${aiRefined ? 'text-purple-600' : 'text-green-600'}`}>{Math.round(prof)}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ${aiRefined ? 'bg-purple-500' : 'bg-green-500'}`}
                                                        style={{ width: `${prof}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
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
                                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                                    {gapAnalysis.fetched_market_skills.map((ms: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-100 transition-colors">
                                            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">{ms.skill}</span>
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg">
                                                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${ms.demand >= 0.7 ? 'bg-green-500' :
                                                    ms.demand >= 0.4 ? 'bg-blue-500' : 'bg-amber-500'
                                                    }`}></div>
                                                <span className="text-[9px] font-black text-blue-600 uppercase">
                                                    {ms.demand_percentage || `${Math.round((ms.demand || 0) * 100)}%`}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => router.push('/gap-analysis')}
                                    className="w-full mt-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-green-600 transition-colors"
                                >
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

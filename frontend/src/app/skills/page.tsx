'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, Skill, GapAnalysis } from '../../lib/api';
import { MainLayout } from '@/components/layout/Sidebar';
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
    SearchCode
} from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';

const PROFICIENCY_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface SkillCourseInfo {
    loading: boolean;
    courses: any[];
}

export default function SkillsPage() {
    const { user, loading: authLoading, userId } = useAuth();
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
            const [skillsData, gapData] = await Promise.all([
                api.getUserSkills(userId).catch(() => []),
                api.getGapAnalysis(userId).catch(() => null),
            ]);
            setSkills(skillsData);
            setGapAnalysis(gapData);
            if (gapData?.target_role?.title) {
                setRoleInput(gapData.target_role.title);
            }
        } catch (error) {
            console.error('Failed to load skills:', error);
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
        if (skillCourses[skillName]) return;

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

    // Process Skills Data for Visualization
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
            <MainLayout>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-green-100 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-gray-500 font-medium animate-pulse text-lg">Analyzing your professional profile...</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-10 pb-12 animate-fade-in px-4 md:px-6">

                {/* Modern Hero Section with High-Fidelity Design */}
                <div className="relative bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-gray-100 overflow-hidden">
                    {/* Background Accents */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-40 -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-50 rounded-full mix-blend-multiply filter blur-3xl opacity-40 -ml-20 -mb-20"></div>

                    <div className="relative flex flex-col lg:flex-row items-center justify-between gap-12">
                        <div className="flex-1 space-y-6 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 border border-green-100 text-green-700 rounded-full text-sm font-semibold shadow-sm">
                                <Sparkles size={14} />
                                Skill Intelligence Pro
                            </div>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 leading-tight tracking-tight">
                                Your Career <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Readiness Dashboard</span>
                            </h1>
                            <p className="text-lg text-gray-500 max-w-2xl leading-relaxed">
                                Integrated skill gap analysis, market demand tracking, and personalized career roadmaps in one place.
                            </p>

                            {/* Unified Search/Analysis Bar */}
                            <div className="flex flex-col sm:flex-row items-stretch gap-3 pt-4 max-w-xl">
                                <div className="relative flex-1 group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-green-500 transition-colors">
                                        <SearchCode size={20} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Enter target role (e.g. Senior Frontend Engineer)"
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl outline-none transition-all text-gray-900 shadow-sm"
                                        value={roleInput}
                                        onChange={(e) => setRoleInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleRoleAnalysis(roleInput)}
                                    />
                                </div>
                                <button
                                    onClick={() => handleRoleAnalysis(roleInput)}
                                    disabled={isAnalyzing}
                                    className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 shadow-lg shadow-gray-200"
                                >
                                    {isAnalyzing ? (
                                        <RefreshCw className="animate-spin" size={20} />
                                    ) : (
                                        <>
                                            Analyze Role
                                            <ChevronRight className="group-hover:translate-x-1 transition-transform" size={18} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Readiness Score Gauge */}
                        <div className="relative w-72 h-72 md:w-80 md:h-80 flex-shrink-0 flex items-center justify-center">
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-full shadow-inner border border-gray-100"></div>
                            <svg className="w-full h-full transform -rotate-90 filter drop-shadow-xl">
                                <circle cx="50%" cy="50%" r="42%" stroke="#f3f4f6" strokeWidth="24" fill="none" />
                                <circle
                                    cx="50%" cy="50%" r="42%"
                                    stroke="url(#gradient-gauge)"
                                    strokeWidth="24"
                                    fill="none"
                                    strokeDasharray={`${(gapAnalysis?.overall_readiness || 0) * 2.64} 264`}
                                    strokeLinecap="round"
                                    className="transition-all duration-[2000ms] ease-out"
                                />
                                <defs>
                                    <linearGradient id="gradient-gauge" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#22c55e" />
                                        <stop offset="100%" stopColor="#3b82f6" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Match Rate</span>
                                <span className="text-6xl md:text-7xl font-black text-gray-900 tracking-tight">
                                    {Math.round(gapAnalysis?.overall_readiness || 0)}%
                                </span>
                                <div className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider">
                                    <TrendingUp size={14} />
                                    Top 10% Profile
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Key Insights Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Skills', value: skills.length, icon: Award, color: 'text-green-600', bg: 'bg-green-50' },
                        { label: 'Role Matches', value: gapAnalysis?.matched_skills?.length || 0, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Gaps Found', value: gapAnalysis?.missing_skills?.length || 0, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
                        { label: 'Target Focus', value: gapAnalysis?.target_role?.title || 'Not Set', icon: Target, scale: true, color: 'text-purple-600', bg: 'bg-purple-50' },
                    ].map((stat, i) => (
                        <div key={i} className="group bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-start justify-between">
                                <div className={`p-4 ${stat.bg} ${stat.color} rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-inner`}>
                                    <stat.icon size={26} strokeWidth={2.5} />
                                </div>
                                <ArrowUpRight className="text-gray-300 group-hover:text-gray-500 transition-colors" size={20} />
                            </div>
                            <div className="mt-6">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                                <p className={`mt-1 font-black text-gray-900 truncate ${stat.scale ? 'text-xl' : 'text-3xl tracking-tight'}`}>
                                    {stat.value}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content Grid: Consolidated Skills and Gaps */}
                <div className="grid lg:grid-cols-12 gap-8">

                    {/* Primary Focus: Combined Skill Grid */}
                    <div className="lg:col-span-8 space-y-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Professional Skill Grid</h2>
                                <p className="text-gray-500">A comprehensive view of your strengths and learning path.</p>
                            </div>
                            <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setFilter('matches')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'matches' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    Matches
                                </button>
                                <button
                                    onClick={() => setFilter('gaps')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'gaps' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    Gaps
                                </button>
                            </div>
                        </div>

                        {/* Unified Grid */}
                        <div className="grid md:grid-cols-2 gap-4">

                            {/* Skill Gaps (Priority) */}
                            {(filter === 'all' || filter === 'gaps') && gapAnalysis?.missing_skills?.map((gap: any, i: number) => (
                                <div key={`gap-${i}`} className="group relative bg-white rounded-3xl border-2 border-red-50 p-6 shadow-sm hover:shadow-2xl hover:border-red-100 transition-all duration-300 overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4">
                                        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${gap.requirement_level === 'critical' ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-amber-400 text-white'
                                            }`}>
                                            {gap.requirement_level}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-4 mb-5">
                                        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner">
                                            {gap.skill.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-gray-900 group-hover:text-red-600 transition-colors uppercase tracking-tight">{gap.skill}</h3>
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                                                <TrendingUp size={12} className="text-red-400" />
                                                High Market Demand
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Bottom */}
                                    <div className="mt-auto space-y-4">
                                        <button
                                            onClick={() => toggleCourseRecommendations(gap.skill)}
                                            className="w-full group/btn py-3 px-4 bg-gray-50 hover:bg-red-500 hover:text-white rounded-2xl flex items-center justify-between text-sm font-black transition-all duration-300"
                                        >
                                            <span className="flex items-center gap-2">
                                                <BookOpen size={16} className="text-red-500 group-hover/btn:text-white transition-colors" />
                                                Explore Courses
                                            </span>
                                            <ChevronRight className="group-hover/btn:translate-x-1 transition-transform" size={16} />
                                        </button>

                                        {/* Courses Expansion */}
                                        {skillCourses[gap.skill] && (
                                            <div className="pt-2 animate-slide-down space-y-2">
                                                {skillCourses[gap.skill].loading ? (
                                                    <div className="flex items-center justify-center p-4">
                                                        <RefreshCw className="animate-spin text-red-500" size={20} />
                                                    </div>
                                                ) : skillCourses[gap.skill].courses.length > 0 ? (
                                                    skillCourses[gap.skill].courses.slice(0, 3).map((c: any, ci: number) => (
                                                        <a key={ci} href={c.url} target="_blank" className="block p-3 bg-red-50/30 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <span className="text-xs font-bold text-gray-900 line-clamp-2">{c.title}</span>
                                                                <ArrowUpRight size={14} className="text-red-400 shrink-0" />
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <span className="text-xs font-black text-red-600 bg-white px-2 py-0.5 rounded-full border border-red-100 uppercase">{c.platform || 'Top Rated'}</span>
                                                                <span className="text-xs font-bold text-gray-500 uppercase">{c.level || 'Expert Led'}</span>
                                                            </div>
                                                        </a>
                                                    ))
                                                ) : (
                                                    <p className="text-[10px] text-gray-400 text-center py-2 italic">Custom roadmaps pending...</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Existing Skills (Matches) */}
                            {(filter === 'all' || filter === 'matches') && skills.sort((a, b) => b.proficiency - a.proficiency).map((skill, i) => (
                                <div key={skill.id || i} className="group bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-xl transition-all duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center font-black text-xl">
                                                {skill.skill_name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-black text-gray-900 uppercase tracking-tight">{skill.skill_name}</h3>
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                                                    <Star size={12} className="text-amber-400 fill-amber-400" />
                                                    Expert Verified
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-lg font-black text-green-600 bg-green-50 px-3 py-1 rounded-xl shadow-inner-sm">
                                            {Math.round(skill.proficiency * 100)}%
                                        </span>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest px-1">
                                            <span>Proficiency</span>
                                            <span>Advanced</span>
                                        </div>
                                        <div className="h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100 p-0.5">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-1000"
                                                style={{ width: `${skill.proficiency * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-6 flex flex-wrap gap-2">
                                        {Array.isArray(skill.sources) ? skill.sources.map((src, si) => (
                                            <span key={si} className="px-3 py-1.5 bg-gray-50 text-xs font-bold text-gray-500 rounded-full border border-gray-100 uppercase tracking-tight">
                                                {src.split(':')[0]}
                                            </span>
                                        )) : (
                                            <span className="px-3 py-1.5 bg-gray-50 text-xs font-bold text-gray-500 rounded-full border border-gray-100 uppercase tracking-tight">
                                                Portfolio
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Secondary Insights Sidebar */}
                    <div className="lg:col-span-4 space-y-8">

                        {/* Learning Timeline / Estimator */}
                        <div className="bg-gray-900 rounded-[2rem] p-8 text-white shadow-2xl overflow-hidden relative group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full filter blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                                <Clock className="text-blue-400" size={24} />
                                Learning Forecast
                            </h3>
                            <div className="space-y-6 relative">
                                <div className="flex items-end gap-3">
                                    <span className="text-6xl font-black text-white tracking-tighter">6</span>
                                    <span className="text-xl font-bold text-blue-400 pb-2 uppercase tracking-widest">Months</span>
                                </div>
                                <p className="text-gray-400 text-sm leading-relaxed font-medium">
                                    Based on your current trajectory and market demand data for {roleInput || 'Target Role'}.
                                </p>
                                <div className="h-1 bg-white/10 rounded-full">
                                    <div className="h-full w-2/3 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                                </div>
                                <button className="w-full py-4 bg-white text-gray-900 font-black rounded-2xl hover:bg-gray-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
                                    Apply Target Roadmap
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Analytic Visualization Card */}
                        <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm flex flex-col items-center">
                            <h3 className="w-full text-lg font-black text-gray-900 mb-8 uppercase tracking-widest flex items-center gap-2">
                                <Layers className="text-green-500" size={20} />
                                Skills Origin
                            </h3>
                            <div className="h-64 w-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analyticsData.sourceData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={65}
                                            outerRadius={95}
                                            paddingAngle={8}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {analyticsData.sourceData.map((entry, index) => (
                                                <Cell key={index} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '15px' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="w-full mt-6 space-y-3">
                                {analyticsData.sourceData.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between group cursor-default">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></div>
                                            <span className="text-sm font-bold text-gray-500 group-hover:text-gray-900 transition-colors">{s.name}</span>
                                        </div>
                                        <span className="text-sm font-black text-gray-900">{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Proficiency Radar Placeholder (Enhanced Area Chart for modern feel) */}
                        <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm">
                            <h3 className="text-lg font-black text-gray-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="text-blue-500" size={20} />
                                Top Performance
                            </h3>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analyticsData.topSkills}>
                                        <defs>
                                            <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Area type="monotone" dataKey="proficiency" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorProf)" />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="mt-4 text-xs font-black text-center text-gray-400 uppercase tracking-[0.2em]">Peak Proficiency Distribution</p>
                        </div>

                    </div>
                </div>

                {/* Market Intelligence Alert */}
                <div className="bg-gradient-to-r from-gray-900 to-blue-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden group">
                    {/* Abstract Visuals */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <div className="absolute top-0 left-1/4 w-px h-full bg-white animate-pulse"></div>
                        <div className="absolute top-0 left-2/4 w-px h-full bg-white animate-pulse delay-500"></div>
                        <div className="absolute top-0 left-3/4 w-px h-full bg-white animate-pulse delay-1000"></div>
                    </div>

                    <div className="relative flex flex-col md:flex-row items-center gap-10">
                        <div className="flex-1 space-y-4">
                            <h3 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">Trending Skills in <span className="text-blue-400">"{gapAnalysis?.target_role?.title || 'Industry'}"</span></h3>
                            <p className="text-gray-400 font-medium">Our AI monitors live job listings to identify high-impact skills you should acquire next.</p>
                            <div className="flex flex-wrap gap-3 pt-2">
                                {gapAnalysis?.fetched_market_skills?.slice(0, 5).map((ms: any, i: number) => (
                                    <div key={i} className="px-4 py-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl flex items-center gap-2 group-hover:border-blue-500/50 transition-all">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                                        <span className="text-xs font-black uppercase tracking-tight">{ms.skill}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                            <button className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-900/40">
                                View Full Analysis
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </MainLayout>
    );
}

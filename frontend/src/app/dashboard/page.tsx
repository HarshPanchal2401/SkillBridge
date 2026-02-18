'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api, Skill } from '../../lib/api';
import { MainLayout } from '@/components/layout/Sidebar';
import {
    TrendingUp,
    Target,
    BookOpen,
    Award,
    ArrowRight,
    ChevronRight,
    FileText,
    Briefcase,
    Zap,
    Sparkles,
    CheckCircle2,
    ArrowUpRight,
    Clock,
} from 'lucide-react';
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
    AreaChart,
    Area
} from 'recharts';

interface DashboardData {
    profile_completion: number;
    total_skills: number;
    total_projects: number;
    total_courses: number;
    skills: Skill[];
    gapAnalysis: any | null;
}

const SKILL_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardPage() {
    const { user, profile, loading: authLoading, userId } = useAuth();
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (userId) {
            loadDashboard();
        }
    }, [userId]);

    const loadDashboard = async () => {
        if (!userId) return;

        try {
            const [skills, gapAnalysis] = await Promise.all([
                api.getUserSkills(userId).catch(() => []),
                api.getGapAnalysis(userId).catch(() => null),
            ]);

            setData({
                profile_completion: profile?.profile_completion || 0,
                total_skills: profile?.total_skills || skills.length,
                total_projects: profile?.total_projects || 0,
                total_courses: profile?.total_courses || 0,
                skills,
                gapAnalysis,
            });
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const analyticsData = useMemo(() => {
        if (!data?.skills) return { skillsData: [], radarData: [] };

        const skillsData = data.skills.slice(0, 8).map((s, i) => ({
            name: s.skill_name,
            proficiency: Math.round(s.proficiency * 100),
            color: SKILL_COLORS[i % SKILL_COLORS.length],
        }));

        const radarData = data.skills.slice(0, 6).map(s => ({
            skill: s.skill_name.substring(0, 10),
            value: Math.round(s.proficiency * 100),
            fullMark: 100,
        }));

        return { skillsData, radarData };
    }, [data?.skills]);

    if (authLoading || loading) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-green-100 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-gray-500 font-medium animate-pulse text-lg">Curating your career dashboard...</p>
                </div>
            </MainLayout>
        );
    }

    const matchPercentage =
        data?.gapAnalysis?.overall_readiness ??
        data?.gapAnalysis?.match_percentage ??
        data?.gapAnalysis?.readiness_score ??
        0;

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-10 pb-12 animate-fade-in px-4 md:px-6">

                {/* Modern Dashboard Hero */}
                <div className="relative bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-gray-100 overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-40 -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-50 rounded-full mix-blend-multiply filter blur-3xl opacity-40 -ml-20 -mb-20"></div>

                    <div className="relative flex flex-col lg:flex-row items-center justify-between gap-12">
                        <div className="flex-1 space-y-6 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 border border-green-100 text-green-700 rounded-full text-sm font-semibold shadow-sm">
                                <Sparkles size={14} />
                                Welcome back, {user?.name?.split(' ')[0] || 'there'}!
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-tight tracking-tight">
                                Your Professional <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Growth Engine</span>
                            </h1>
                            <p className="text-lg text-gray-500 max-w-xl leading-relaxed">
                                You're making great progress. Here's how your skill profile compares to current market demands.
                            </p>

                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-4">
                                <button
                                    onClick={() => router.push('/skills')}
                                    className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 active:scale-95 transition-all flex items-center gap-2 group shadow-lg shadow-gray-200"
                                >
                                    Deep Analysis
                                    <ChevronRight className="group-hover:translate-x-1 transition-transform" size={18} />
                                </button>
                                {(data?.total_skills || 0) === 0 && (
                                    <button
                                        onClick={() => router.push('/profile')}
                                        className="px-8 py-4 bg-white text-gray-900 border-2 border-gray-100 rounded-2xl font-bold hover:bg-gray-50 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <FileText size={18} />
                                        Upload Resume
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Readiness Score Gauge */}
                        <div className="relative w-64 h-64 md:w-72 md:h-72 flex-shrink-0 flex items-center justify-center">
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-full shadow-inner border border-gray-100"></div>
                            <svg className="w-full h-full transform -rotate-90 filter drop-shadow-xl">
                                <circle cx="50%" cy="50%" r="42%" stroke="#f3f4f6" strokeWidth="20" fill="none" />
                                <circle
                                    cx="50%" cy="50%" r="42%"
                                    stroke="url(#dash-gradient-gauge)"
                                    strokeWidth="20"
                                    fill="none"
                                    strokeDasharray={`${matchPercentage * 2.64} 264`}
                                    strokeLinecap="round"
                                    className="transition-all duration-[2000ms] ease-out"
                                />
                                <defs>
                                    <linearGradient id="dash-gradient-gauge" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#10b981" />
                                        <stop offset="100%" stopColor="#3b82f6" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Role Match</span>
                                <span className="text-5xl md:text-6xl font-black text-gray-900 tracking-tight">
                                    {Math.round(matchPercentage)}%
                                </span>
                                <div className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                    <TrendingUp size={12} />
                                    Active Growth
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* High-Fidelity Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Profile Build', value: `${Math.round(data?.profile_completion || 0)}%`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', bar: true },
                        { label: 'Skills Found', value: data?.total_skills || 0, icon: Award, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Projects', value: data?.total_projects || 0, icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-50' },
                        { label: 'Next Goal', value: data?.gapAnalysis?.target_role?.title?.split(' ')[0] || 'Set Role', icon: Target, color: 'text-amber-600', bg: 'bg-amber-50' },
                    ].map((stat, i) => (
                        <div key={i} className="group bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-start justify-between">
                                <div className={`p-4 ${stat.bg} ${stat.color} rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-inner`}>
                                    <stat.icon size={24} strokeWidth={2.5} />
                                </div>
                                <ArrowUpRight className="text-gray-300 group-hover:text-gray-500 transition-colors" size={18} />
                            </div>
                            <div className="mt-6">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
                                <p className="font-black text-gray-900 text-3xl tracking-tight truncate">{stat.value}</p>
                                {stat.bar && (
                                    <div className="mt-4 h-2 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                        <div
                                            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${data?.profile_completion || 0}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Dashboard Content */}
                <div className="grid lg:grid-cols-12 gap-8">

                    {/* Insights Area */}
                    <div className="lg:col-span-8 space-y-8">
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Skill Radar */}
                            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm flex flex-col h-full">
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Skill Balance</h3>
                                {analyticsData.radarData.length > 0 ? (
                                    <div className="h-64 mt-auto">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart data={analyticsData.radarData}>
                                                <PolarGrid stroke="#f3f4f6" />
                                                <PolarAngleAxis dataKey="skill" tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 700 }} />
                                                <Radar
                                                    name="Current"
                                                    dataKey="value"
                                                    stroke="#10b981"
                                                    fill="#10b981"
                                                    fillOpacity={0.2}
                                                    strokeWidth={3}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center">
                                            <Zap size={24} className="text-gray-400" />
                                        </div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">Analysis Pending</p>
                                    </div>
                                )}
                            </div>

                            {/* Top Proficiency Area Chart */}
                            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm flex flex-col h-full">
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Performance peaks</h3>
                                {analyticsData.skillsData.length > 0 ? (
                                    <div className="h-64 mt-auto">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={analyticsData.skillsData}>
                                                <defs>
                                                    <linearGradient id="dashProf" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <Area type="monotone" dataKey="proficiency" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#dashProf)" />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                                                    cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5 5' }}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                        <p className="mt-4 text-xs font-black text-center text-gray-300 uppercase tracking-widest">Strength Distribution</p>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center">
                                            <Award size={24} className="text-gray-400" />
                                        </div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">No Data Uploaded</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Learning Gaps */}
                        {data?.gapAnalysis?.missing_skills && (
                            <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-8">
                                    <BookOpen className="text-green-50/50" size={80} />
                                </div>
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h3 className="text-xl font-black text-gray-900 tracking-tight">Active Learning Path</h3>
                                            <p className="text-sm text-gray-500">Highest priority skills based on your target role.</p>
                                        </div>
                                        <button
                                            onClick={() => router.push('/recommendations')}
                                            className="text-xs font-black text-green-600 uppercase tracking-widest hover:text-green-700 flex items-center gap-1 group"
                                        >
                                            View All
                                            <ChevronRight className="group-hover:translate-x-1 transition-transform" size={14} />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {data.gapAnalysis.missing_skills.slice(0, 8).map((gap: any, i: number) => (
                                            <div key={i} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-white hover:shadow-md border border-gray-100 rounded-2xl transition-all group cursor-default">
                                                <span className={`w-2 h-2 rounded-full ${gap.requirement_level === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`}></span>
                                                <span className="text-xs font-bold text-gray-700 group-hover:text-gray-900">{gap.skill}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick Launch Sidebar */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="flex flex-col gap-6">
                            {[
                                {
                                    title: 'Analyze Gap',
                                    desc: 'Find market requirements',
                                    route: '/skills',
                                    gradient: 'from-blue-600 to-indigo-700',
                                    icon: Target
                                },
                                {
                                    title: 'Explore Roadmaps',
                                    desc: 'Find your career path',
                                    route: '/roadmap',
                                    gradient: 'from-purple-600 to-pink-700',
                                    icon: Clock
                                },
                                {
                                    title: 'Find Courses',
                                    desc: 'Learn high-impact skills',
                                    route: '/recommendations',
                                    gradient: 'from-orange-500 to-red-600',
                                    icon: BookOpen
                                },
                            ].map((action, i) => (
                                <button
                                    key={i}
                                    onClick={() => router.push(action.route)}
                                    className={`relative group h-32 w-full overflow-hidden rounded-[2rem] bg-gradient-to-br ${action.gradient} p-8 text-left text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300`}
                                >
                                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                                        <action.icon size={120} />
                                    </div>
                                    <div className="relative h-full flex flex-col justify-between">
                                        <div>
                                            <h4 className="font-black text-2xl tracking-tight leading-none mb-1">{action.title}</h4>
                                            <p className="text-xs font-bold text-white/70 uppercase tracking-widest">{action.desc}</p>
                                        </div>
                                        <ArrowRight className="group-hover:translate-x-2 transition-transform" size={24} />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Profile Prompt */}
                        <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                <Sparkles size={60} />
                            </div>
                            <h3 className="text-lg font-black text-gray-900 tracking-tight mb-2">Resume Intelligence</h3>
                            <p className="text-xs text-gray-500 leading-relaxed mb-6">
                                Keep your profile updated for more accurate AI market matching and role analysis.
                            </p>
                            <button
                                onClick={() => router.push('/profile')}
                                className="w-full py-4 px-6 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-900 transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 size={16} className="text-green-500" />
                                Updated Profile
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </MainLayout>
    );
}

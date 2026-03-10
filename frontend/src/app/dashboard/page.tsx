'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api, Skill } from '../../lib/api';
import {
    TrendingUp,
    Target,
    BookOpen,
    Award,
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
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    PieChart,
    Pie,
    Cell
} from 'recharts';

interface DashboardData {
    total_skills: number;
    total_projects: number;
    total_courses: number;
    skills: Skill[];
    gapAnalysis: any | null;
}

const SKILL_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardPage() {
    const { user, profile, gapAnalysis, loading: authLoading, userId, refreshGapAnalysis } = useAuth();
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
            // First check if we already have gapAnalysis in global state
            let currentGapAnalysis = gapAnalysis;

            if (!currentGapAnalysis) {
                // If not, fetch it (this will also update the global state)
                currentGapAnalysis = await refreshGapAnalysis();
            }

            const [skills] = await Promise.all([
                api.getUserSkills(userId).catch(() => []),
                // api.getGapAnalysis(userId) is now handled by refreshGapAnalysis if needed
            ]);

            setData({
                total_skills: skills.length,
                total_projects: profile?.total_projects || 0,
                total_courses: profile?.total_courses || 0,
                skills,
                gapAnalysis: currentGapAnalysis,
            });
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const analyticsData = useMemo(() => {
        if (!data?.gapAnalysis) return { comparisonData: [], gapPieData: [] };

        const strengths = data.gapAnalysis.strengths || [];
        const missing = data.gapAnalysis.missing_skills || [];

        // Top 5 skills comparison (User vs Market)
        const topSkills = strengths.slice(0, 5).map((s: any) => ({
            name: s.skill.length > 15 ? s.skill.substring(0, 15) + '...' : s.skill,
            user: Math.round(s.user_proficiency * 100),
            market: Math.round(s.demand * 100),
        }));

        // Fill with gaps if we don't have enough strengths
        if (topSkills.length < 5) {
            const extra = missing.slice(0, 5 - topSkills.length).map((g: any) => ({
                name: g.skill.length > 15 ? g.skill.substring(0, 15) + '...' : g.skill,
                user: Math.round((g.user_proficiency || 0) * 100),
                market: Math.round(g.demand * 100),
            }));
            topSkills.push(...extra);
        }

        const gapMap = {
            Critical: (data.gapAnalysis.skill_gaps?.critical || []).length,
            Important: (data.gapAnalysis.skill_gaps?.important || []).length,
            Emerging: (data.gapAnalysis.skill_gaps?.emerging || []).length,
        };

        const gapPieData = [
            { name: 'Critical Gaps', value: gapMap.Critical, color: '#ef4444' },
            { name: 'Important Gaps', value: gapMap.Important, color: '#f59e0b' },
            { name: 'Emerging Gaps', value: gapMap.Emerging, color: '#3b82f6' },
        ].filter(d => d.value > 0);

        return { comparisonData: topSkills, gapPieData };
    }, [data?.gapAnalysis]);

    if (authLoading || loading) {
        return (
            <>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
                    <p className="text-gray-400 text-sm animate-pulse">Loading dashboard...</p>
                </div>
            </>
        );
    }

    const matchPercentage =
        data?.gapAnalysis?.overall_readiness ??
        data?.gapAnalysis?.match_percentage ??
        data?.gapAnalysis?.readiness_score ??
        0;

    return (
        <>
            <div className="space-y-8 animate-fade-in">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold uppercase tracking-wider mb-3">
                            <Sparkles size={12} />
                            Dashboard Overview
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                            Welcome back, {user?.name?.split(' ')[0] || 'User'}
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Here's what's happening with your professional growth.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/skills')}
                            className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all shadow-sm flex items-center gap-2"
                        >
                            Analyze Skills
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid lg:grid-cols-12 gap-8">
                    {/* Left Column: Stats & Charts */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Market Match', value: `${Math.round(matchPercentage)}%`, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { label: 'Total Skills', value: data?.total_skills || 0, icon: Award, color: 'text-green-600', bg: 'bg-green-50' },
                                { label: 'Strengths', value: data?.gapAnalysis?.strengths?.length || 0, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
                                { label: 'Skill Gaps', value: data?.gapAnalysis?.summary?.total_gaps || 0, icon: CheckCircle2, color: 'text-amber-600', bg: 'bg-amber-50' },
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

                        {/* Charts Area */}
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="card-simple h-[320px] flex flex-col">
                                <h3 className="text-sm font-bold text-gray-900 mb-6 px-1">Top Skills: You vs Market</h3>
                                {analyticsData.comparisonData.length > 0 ? (
                                    <div className="flex-1 min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analyticsData.comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '12px' }} />
                                                <Bar dataKey="user" name="Your Level" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
                                                <Bar dataKey="market" name="Market Demand" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">Analyze a role to see market comparison</div>
                                )}
                            </div>

                            <div className="card-simple h-[320px] flex flex-col">
                                <h3 className="text-sm font-bold text-gray-900 mb-6 px-1">Gap Severity Breakdown</h3>
                                {analyticsData.gapPieData.length > 0 ? (
                                    <div className="flex-1 min-h-0 relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={analyticsData.gapPieData}
                                                    innerRadius={60}
                                                    outerRadius={90}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    stroke="none"
                                                >
                                                    {analyticsData.gapPieData.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '12px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-3xl font-black text-gray-900">{data?.gapAnalysis?.summary?.total_gaps || 0}</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total Gaps</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">Analyze a role to see gap breakdown</div>
                                )}
                            </div>
                        </div>

                        {/* Learning Path Section */}
                        {data?.gapAnalysis?.missing_skills && (
                            <div className="card-simple">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-bold text-gray-900">Priority Skill Gaps</h3>
                                    <button
                                        onClick={() => router.push('/recommendations')}
                                        className="text-xs font-bold text-green-600 hover:text-green-700 flex items-center gap-1 transition-colors"
                                    >
                                        View Recommendations
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {data.gapAnalysis.missing_skills.slice(0, 6).map((gap: any, i: number) => (
                                        <div key={i} className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${gap.requirement_level === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`}></div>
                                            <span className="text-xs font-medium text-gray-700">{gap.skill}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Actions & Profile */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Quick Actions */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Quick Actions</h3>
                            <button
                                onClick={() => router.push('/roadmap')}
                                className="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-green-100 hover:bg-green-50/30 transition-all group shadow-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                        <Clock size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-gray-900">Career Roadmap</p>
                                        <p className="text-[11px] text-gray-500">View your step-by-step path</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-gray-300 group-hover:text-green-600" />
                            </button>

                            <button
                                onClick={() => router.push('/recommendations')}
                                className="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-green-100 hover:bg-green-50/30 transition-all group shadow-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                        <BookOpen size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-gray-900">Skill Gap Training</p>
                                        <p className="text-[11px] text-gray-500">Explore recommended courses</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-gray-300 group-hover:text-green-600" />
                            </button>
                        </div>

                        {/* Detailed Skill Summary */}
                        <div className="card-simple bg-blue-50/30 border-blue-100 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Your Skill Summary</h3>
                            <div className="space-y-4 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                {data?.skills?.slice().sort((a, b) => b.proficiency - a.proficiency).map((skill, index) => (
                                    <div key={index} className="flex flex-col gap-1.5">
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-xs font-bold text-gray-700 uppercase">{skill.skill_name}</span>
                                            <span className="text-[10px] font-black text-green-600">{Math.round(skill.proficiency * 100)}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-green-500 rounded-full"
                                                style={{ width: `${Math.round(skill.proficiency * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {!data?.skills?.length && (
                                    <p className="text-sm text-gray-500 italic text-center py-4">No skills detected yet. Upload your resume or add projects.</p>
                                )}
                            </div>
                        </div>

                        {/* Tips Card */}
                        <div className="card-simple">
                            <div className="flex items-center gap-2 text-amber-600 mb-3">
                                <Zap size={16} fill="currentColor" />
                                <h4 className="text-sm font-bold uppercase tracking-wider">Fast Access</h4>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Use the sidebar to quickly toggle between your identity management, skill intelligence, and journey progress.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}


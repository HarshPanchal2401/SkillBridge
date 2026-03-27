'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api, Skill } from '../../lib/api';
import {
    TrendingUp,
    Target,
    BookOpen,
    Award,
    ChevronRight,
    Briefcase,
    Zap,
    Sparkles,
    CheckCircle2,
    ArrowUpRight,
    Clock,
    Map,
    Rocket,
    Play,
    Activity,
    PieChart as PieIcon,
    BarChart2,
    BarChart3
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    Cell,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    PieChart,
    Pie,
    AreaChart,
    Area,
    Legend
} from 'recharts';

interface DashboardData {
    total_skills: number;
    total_projects: number;
    total_courses: number;
    skills: Skill[];
    gapAnalysis: any | null;
    roadmap: any | null;
    videoProgress: Record<string, any>;
    analytics: any | null;
}

export default function DashboardPage() {
    const { user, profile, gapAnalysis, loading: authLoading, userId, refreshGapAnalysis } = useAuth();
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/');
        }
    }, [user, authLoading, router]);

    const loadDashboard = useCallback(async () => {
        if (!userId) return;

        try {
            // Using individual awaits or explicit typing to resolve Promise.all tuple issues
            const gapData = await (gapAnalysis || refreshGapAnalysis());
            const skills = await api.getUserSkills(userId).catch(() => [] as Skill[]);
            const roadmapRes = await api.getLatestRoadmap(userId).catch(() => null);
            const progressRes = await api.getVideoProgress(userId).catch(() => [] as any[]);
            const videoAnalytics = await api.getVideoAnalytics(userId).catch(() => null);

            const progressMap: Record<string, any> = {};
            const progressList = Array.isArray(progressRes) ? progressRes : (progressRes?.progress || []);
            progressList.forEach((p: any) => {
                if (p?.video_id) progressMap[p.video_id] = p;
            });

            setData({
                total_skills: skills.length,
                total_projects: profile?.total_projects || 0,
                total_courses: profile?.total_courses || 0,
                skills,
                gapAnalysis: gapData,
                roadmap: roadmapRes?.roadmap_data || null,
                videoProgress: progressMap,
                analytics: videoAnalytics
            });
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, gapAnalysis, refreshGapAnalysis, profile]);

    useEffect(() => {
        if (userId) {
            loadDashboard();
        }
    }, [userId, loadDashboard]);

    // PREPARE ALL CHART DATA
    const charts = useMemo(() => {
        if (!data?.gapAnalysis) return { radar: [], pie: [], momentum: [] };

        // 1. Radar Data (Domain Mastery)
        const strengths = data.gapAnalysis.strengths || [];
        const gaps = data.gapAnalysis.critical_gaps || [];
        const radar = [...strengths.slice(0, 3), ...gaps.slice(0, 3)].map(s => ({
            subject: s.skill.length > 10 ? s.skill.substring(0, 10) + '..' : s.skill,
            user: Math.round((s.user_proficiency || 0) * 100),
            market: Math.round((s.demand || 0) * 100),
            fullMark: 100,
        }));

        // 2. Pie Data (Gap Severity)
        const summary = data.gapAnalysis.summary || {};
        const pie = [
            { name: 'Critical', value: summary.critical_gap_count || data.gapAnalysis.critical_gaps?.length || 0, fill: '#ef4444' },
            { name: 'Important', value: summary.important_gap_count || data.gapAnalysis.important_gaps?.length || 0, fill: '#f59e0b' },
            { name: 'Emerging', value: summary.emerging_gap_count || data.gapAnalysis.emerging_gaps?.length || 0, fill: '#3b82f6' },
            { name: 'Mastered', value: summary.strength_count || data.gapAnalysis.strengths?.length || 0, fill: '#22c55e' },
        ].filter(v => v.value > 0);

        // 3. Momentum Data (Real Data only - zeros if empty)
        const rawMomentum = data.analytics?.daily_progress || [];
        const momentum = rawMomentum.length > 0 ? rawMomentum : [
            { day: 'Mon', minutes: 0 },
            { day: 'Tue', minutes: 0 },
            { day: 'Wed', minutes: 0 },
            { day: 'Thu', minutes: 0 },
            { day: 'Fri', minutes: 0 },
            { day: 'Sat', minutes: 0 },
            { day: 'Sun', minutes: 0 },
        ];

        return { radar, pie, momentum };
    }, [data?.gapAnalysis, data?.analytics]);

    const roadmapInfo = useMemo(() => {
        if (!data?.roadmap) return null;
        
        const fullRoadmap = data.roadmap.full_roadmap || {};
        const allMilestones = [
            ...(fullRoadmap.beginner_milestones || []),
            ...(fullRoadmap.intermediate_milestones || []),
            ...(fullRoadmap.advanced_milestones || [])
        ];

        if (allMilestones.length === 0) return null;

        const nextMilestones = allMilestones.filter(m => {
            const videoId = m.oneshot?.video_id;
            const progress = data.videoProgress[videoId]?.completion_percentage || 0;
            return progress < 100;
        }).slice(0, 3);

        const totalProgress = allMilestones.reduce((acc: number, m: any) => {
            const videoId = m.oneshot?.video_id;
            return acc + (data.videoProgress[videoId]?.completion_percentage || 0);
        }, 0);

        return {
            total: allMilestones.length,
            overallProgress: Math.round(totalProgress / allMilestones.length),
            next: nextMilestones,
            targetRole: data.roadmap.target_role?.replace(/\*/g, '') || user?.target_role
        };
    }, [data?.roadmap, data?.videoProgress, user?.target_role]);

    if (authLoading || loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
                <p className="text-gray-400 text-[10px] animate-pulse font-black uppercase tracking-[0.2em]">Syncing Intelligence...</p>
            </div>
        );
    }

    const matchPercentage = data?.gapAnalysis?.overall_readiness || 0;

    return (
        <div className="max-w-screen-2xl mx-auto space-y-10 pb-20 animate-fade-in lg:px-6">
            {/* COMPACT STYLED HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-gray-100 pb-10">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-gray-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl rotate-3 shrink-0">
                        <Sparkles size={28} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">
                            Intelligence <span className="text-green-600">Overview</span>
                        </h1>
                        <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">
                            Welcome back, {user?.name?.split(' ')[0]} • System Active
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                         onClick={() => router.push('/roadmap')}
                         className="px-6 py-4 bg-gray-900 text-white rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95 flex items-center gap-2"
                    >
                        <Rocket size={16} className="text-green-400" />
                        Enter Journey
                    </button>
                    <button 
                        onClick={() => router.push('/skills')}
                        className="p-4 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all shadow-sm group"
                    >
                        <Activity size={20} className="text-gray-400 group-hover:text-green-500 transition-colors" />
                    </button>
                </div>
            </div>

            {/* TOP ROW: JOURNEY & READINESS */}
            <div className="grid lg:grid-cols-12 gap-6">
                
                {/* HERO: THE JOURNEY (8 cols) */}
                <div className="lg:col-span-8 glass-card p-10 relative overflow-hidden group border-white/50">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-green-500/5 blur-[100px] -mr-40 -mt-40 rounded-full" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                        {/* PROGRESS RING */}
                        <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-gray-100/50" />
                                <circle 
                                    cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="10" fill="transparent" 
                                    strokeDasharray="100 100" 
                                    strokeDashoffset={100 - (roadmapInfo?.overallProgress ?? 0)} 
                                    pathLength="100"
                                    strokeLinecap="round" 
                                    className="text-green-500 transition-all duration-1000 ease-out drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]" 
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center">
                                <span className="text-5xl font-black text-gray-900 tracking-tighter">{roadmapInfo?.overallProgress ?? 0}%</span>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mastery</span>
                            </div>
                        </div>

                        <div className="flex-1 space-y-8 text-center md:text-left">
                            <div>
                                <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tight leading-none mb-3">
                                    Current <span className="text-green-600">Goal</span>
                                </h2>
                                <p className="text-lg font-bold text-gray-500 tracking-tight leading-relaxed max-w-md">
                                    Architecting your path as a <span className="text-gray-900">{roadmapInfo?.targetRole || 'Future Talent'}</span>
                                </p>
                            </div>
                            
                            <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                <div className="px-5 py-3 bg-white/40 backdrop-blur-md border border-white rounded-2xl shadow-sm">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${(roadmapInfo?.overallProgress ?? 0) > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                                        <p className="text-sm font-black text-gray-900 uppercase">
                                            {(roadmapInfo?.overallProgress ?? 0) === 0 ? 'Not Started' : (roadmapInfo?.overallProgress ?? 0) < 50 ? 'In Progress' : 'Advanced'}
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-white/50 backdrop-blur-sm p-3 rounded-xl border border-white/20 shadow-sm flex flex-col justify-center min-w-[120px]">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Activity</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-bold tracking-tight ${(roadmapInfo?.overallProgress ?? 0) > 0 ? 'text-blue-600' : 'text-gray-400 opacity-50'}`}>
                                            {(roadmapInfo?.overallProgress ?? 0) > 0 ? 'ACTIVE LEARNING' : 'PENDING'}
                                        </span>
                                    </div>
                                </div>
                                
                                {(roadmapInfo?.overallProgress ?? 0) > 0 && (
                                    <button 
                                        onClick={() => router.push('/roadmap')}
                                        className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 group flex items-center gap-2"
                                    >
                                        Resume
                                        <ChevronRight size={14} className="text-green-400 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* READINESS WIDGET (4 cols) */}
                <div className="lg:col-span-4 p-10 bg-blue-600 text-white rounded-[2.5rem] shadow-2xl shadow-blue-200 overflow-hidden relative border border-white/20">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 blur-[60px] -mr-24 -mt-24 rounded-full" />
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-100 mb-2">Market Matching</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-7xl font-black tracking-tighter text-white">{Math.round(matchPercentage)}</span>
                                <span className="text-2xl font-black text-blue-200">%</span>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                             <div className="flex items-center justify-between text-[11px] font-bold text-blue-100">
                                <span>Demand Sync</span>
                                <span>High Priority</span>
                            </div>
                            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white transition-all duration-1000" style={{ width: `${matchPercentage}%` }} />
                            </div>
                            <p className="text-xs font-bold text-white leading-relaxed italic">
                                "{data?.gapAnalysis?.summary?.interpretation || 'Matched with core requirements.'}"
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* DATA GRID: MULTIPLE CHARTS & ANALYTICS */}
            <div className="grid lg:grid-cols-12 gap-6">
                
                {/* 1. DOMAIN MASTERY HORIZONTAL BARS (4 cols) */}
                <div className="lg:col-span-4 glass-card p-8 border-white group">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                             <Target size={14} className="text-red-500" />
                             Domain Intelligence
                        </h3>
                    </div>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                layout="vertical" 
                                data={charts.radar} 
                                margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
                                barSize={10}
                                barGap={4}
                            >
                                <XAxis type="number" hide />
                                <YAxis 
                                    type="category" 
                                    dataKey="subject" 
                                    tick={{ fontSize: 9, fontWeight: '900', fill: '#9ca3af' }} 
                                    axisLine={false} 
                                    tickLine={false}
                                    width={70}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold' }}
                                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                />
                                <Bar dataKey="user" fill="#22c55e" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="market" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mastery</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Market</span>
                        </div>
                    </div>
                </div>

                {/* 2. GAP SEVERITY DONUT (4 cols) */}
                <div className="lg:col-span-4 glass-card p-8 border-white relative">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                             <PieIcon size={14} className="text-purple-500" />
                             Gap Distribution
                        </h3>
                    </div>
                    <div className="h-[200px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={charts.pie}
                                    cx="50%" cy="50%"
                                    innerRadius={65}
                                    outerRadius={90}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {charts.pie.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* CENTER LABEL FOR DONUT */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                            <p className="text-2xl font-black text-gray-900 leading-none">{charts.pie.reduce((acc, curr) => curr.name !== 'Mastered' ? acc + curr.value : acc, 0)}</p>
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Total<br/>Gaps</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        {charts.pie.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 bg-gray-50/50 p-2 rounded-xl">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.fill }} />
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter truncate">{item.name}</span>
                                <span className="text-[9px] font-black text-gray-900 ml-auto">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. MOMENTUM AREA CHART (4 cols) */}
                <div className="lg:col-span-4 glass-card p-8 border-white">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                             <Clock size={14} className="text-green-500" />
                             Learning Momentum
                        </h3>
                    </div>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={charts.momentum} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorMin" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#9ca3af' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#9ca3af' }} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                                <Area type="monotone" dataKey="minutes" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorMin)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between opacity-50 grayscale transition-all hover:opacity-100 hover:grayscale-0">
                        <div>
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Intelligence Stream</p>
                             <span className="text-xs font-black text-gray-900 uppercase">Live Processing</span>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Sync Status</p>
                            <span className="text-[10px] font-black text-green-600 uppercase">Real-time Verified</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* BOTTOM ROW: PATH AHEAD & MASTERY OVERVIEW */}
            <div className="grid lg:grid-cols-12 gap-6">
                
                {/* 4. THE PATH AHEAD (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                     <div className="flex items-center justify-between px-2">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                            <Rocket size={18} className="text-blue-500" />
                            Accelerated Path
                        </h3>
                        <button onClick={() => router.push('/roadmap')} className="text-[10px] font-black text-gray-400 hover:text-green-600 uppercase tracking-[0.2em] transition-all">Deep Dive Map</button>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-5">
                        {roadmapInfo?.next && roadmapInfo.next.length > 0 ? (
                            roadmapInfo.next.map((m: any, i: number) => (
                                <div key={i} className="glass-card p-6 border-white/40 hover:scale-[1.03] transition-all flex flex-col justify-between min-h-[180px] cursor-pointer group/card" onClick={() => router.push('/roadmap')}>
                                    <div className="space-y-4">
                                        <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center group-hover/card:bg-gray-900 group-hover/card:text-white transition-all">
                                            <span className="text-xs font-black">{i + 1}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-black text-gray-900 group-hover/card:text-green-600 transition-colors">{m.skill}</h4>
                                            <p className="text-[10px] text-gray-400 font-bold leading-relaxed">{m.importance}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-4">
                                        <div className="flex items-center gap-2">
                                            <Clock size={12} className="text-gray-300" />
                                            <span className="text-[9px] font-black text-gray-400 uppercase">Locked</span>
                                        </div>
                                        <ChevronRight size={14} className="text-gray-300 group-hover/card:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="md:col-span-3 glass-card p-12 bg-green-50/30 border-dashed border-green-200 flex flex-col items-center justify-center text-center space-y-6">
                                <div className="w-20 h-20 bg-green-500 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-green-200">
                                    <CheckCircle2 size={40} />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Mastery Achieved</h4>
                                    <p className="text-sm text-gray-500 font-bold max-w-sm">Every stone on this path has been turned. Your expertise is documented.</p>
                                </div>
                                <button onClick={() => router.push('/roadmap')} className="px-10 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all">Start New Project</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. TOP SKILLS LIST (5 cols) */}
                <div className="lg:col-span-5 glass-card p-8 border-white">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                             <TrendingUp size={16} className="text-amber-500" />
                             Skill Proficiency
                        </h3>
                        <button onClick={() => router.push('/skills')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ArrowUpRight size={18} className="text-gray-300" /></button>
                    </div>
                    <div className="space-y-6 max-h-[280px] overflow-y-auto pr-4 custom-scrollbar">
                        {data?.skills?.filter(s => s.proficiency > 0).sort((a, b) => b.proficiency - a.proficiency).slice(0, 10).map((skill, index) => (
                            <div key={index} className="space-y-2 group/skill cursor-default">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 group-hover/skill:scale-150 transition-transform" />
                                        <span className="text-[11px] font-black text-gray-700 uppercase tracking-wide group-hover/skill:text-gray-900 transition-colors">{skill.skill_name}</span>
                                    </div>
                                    <span className="text-[11px] font-black text-green-600">{Math.round(skill.proficiency * 100)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100/50">
                                    <div 
                                        className="h-full bg-green-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(34,197,94,0.4)]" 
                                        style={{ width: `${Math.round(skill.proficiency * 100)}%` }} 
                                    />
                                </div>
                            </div>
                        ))}
                        {(!data?.skills || data.skills.length === 0) && (
                            <div className="py-20 text-center space-y-4 opacity-40">
                                <BookOpen size={32} className="mx-auto" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Skill Extraction</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* QUICK NAVIGATION SECTION - RE-REFINING FOR COMPREHENSIVENESS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-10 border-t border-gray-100/50">
                {[
                    { label: 'Market Skills', path: '/skills', icon: Zap, color: 'text-amber-500', desc: 'Sync with demand' },
                    { label: 'Job Tracker', path: '/jobs', icon: Briefcase, color: 'text-blue-500', desc: 'Active bridge' },
                    { label: 'Career Growth', path: '/profile', icon: Target, color: 'text-purple-500', desc: 'Identity & Focus' },
                    { label: 'Path Settings', path: '/roadmap', icon: Map, color: 'text-green-500', desc: 'Modify nodes' },
                ].map((action, i) => (
                    <button
                        key={i}
                        onClick={() => router.push(action.path)}
                        className="p-6 bg-white/40 backdrop-blur-sm border border-white rounded-[2.5rem] hover:border-green-400 hover:shadow-2xl hover:shadow-green-500/10 transition-all flex flex-col items-start gap-4 group shadow-sm active:scale-95 text-left"
                    >
                        <div className={`w-12 h-12 rounded-[1.25rem] bg-gray-50 ${action.color} flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white transition-all shadow-sm`}>
                            <action.icon size={20} />
                        </div>
                        <div>
                            <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest block mb-0.5">{action.label}</span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{action.desc}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

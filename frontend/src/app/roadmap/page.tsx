'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Sparkles, Map, Rocket, Clock, ShieldCheck, Zap,
    ChevronRight, ChevronDown, Play, CheckCircle2, Circle,
    MessageSquare, Layout, BarChart3 as BarChart, BookOpen,
    ArrowRight, Award, BrainCircuit, Globe,
    X, MonitorPlay, Bot, Languages, ListVideo,
    Eye, Timer, TrendingUp, PlayCircle, Milestone,
    Trophy, Flag, Construction, Target, Star, RefreshCw,
    MessageCircle, ThumbsUp, Check, Layers, User,
    ArrowUpRight, ExternalLink, Info, Filter, Search
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import TutorChat from '@/components/TutorChat';
import YouTubePlayer from '@/components/YouTubePlayer';

// ── Types ──

interface PlaylistVideo {
    video_id: string;
    title: string;
    thumbnail: string;
    position: number;
}

interface Playlist {
    playlist_id: string;
    title: string;
    channel: string;
    thumbnail: string;
    video_count: number;
    videos: PlaylistVideo[];
}

interface Oneshot {
    video_id: string;
    title: string;
    channel: string;
    thumbnail: string;
    duration: string;
    duration_text: string;
    view_count: number;
    view_count_text: string;
    score?: number;
}

interface SkillItem {
    skill: string;
    importance: string;
    difficulty: string;
    estimated_time: string;
    target_proficiency: number;
    attained_proficiency: number;
    demand?: number;
    playlist?: Playlist | null;
    oneshot?: Oneshot | null;
    verification_reason?: string;
}

export default function RoadmapPage() {
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [roadmap, setRoadmap] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'full' | 'fast-track'>('full');
    const [language, setLanguage] = useState<'English' | 'Hindi'>('English');
    const [searchQuery, setSearchQuery] = useState('');

    // Video player state
    const [playerOpen, setPlayerOpen] = useState(false);
    const [activeVideo, setActiveVideo] = useState<{ id: string; title: string; skillName?: string } | null>(null);
    const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
    const [tutorOverlayOpen, setTutorOverlayOpen] = useState(false);

    // Analytics
    const [videoProgressMap, setVideoProgressMap] = useState<Record<string, any>>({});
    const [activeMilestone, setActiveMilestone] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (user?.id) {
            fetchRoadmap();
            fetchProgress();
        }
    }, [user]);

    const fetchRoadmap = async () => {
        setLoading(true);
        try {
            const userId = user?.id;
            if (!userId) return;
            const data = await api.getLatestRoadmap(userId);
            if (data.roadmap_data) {
                const rd = data.roadmap_data;
                // Defensive synchronization: Sync oneshot resources between fast-track and full roadmap if missing
                const resourceSyncMap: Record<string, any> = {};
                rd.fast_track_roadmap?.forEach((item: any) => {
                    if (item.oneshot) resourceSyncMap[item.skill.toLowerCase()] = item.oneshot;
                });

                const phases = ['beginner_milestones', 'intermediate_milestones', 'advanced_milestones'];
                phases.forEach(p => {
                    rd.full_roadmap?.[p]?.forEach((item: any) => {
                        if (!item.oneshot && resourceSyncMap[item.skill.toLowerCase()]) {
                            item.oneshot = resourceSyncMap[item.skill.toLowerCase()];
                        }
                    });
                });

                setRoadmap(rd);
                if (rd.language) {
                    setLanguage(rd.language === 'Hindi' ? 'Hindi' : 'English');
                }
            }
        } catch (err) {
            setError('Failed to load roadmap.');
        } finally {
            setLoading(false);
        }
    };

    // ── AUTO-RECOVERY: Fetch missing videos on the fly ──
    useEffect(() => {
        if (!roadmap || generating) return;

        const fetchMissingVideos = async () => {
            const fullRoadmap = roadmap.full_roadmap || {};
            const phases = ['beginner_milestones', 'intermediate_milestones', 'advanced_milestones'];
            const allMilestones = phases.flatMap(p => fullRoadmap[p] || []);

            // Only fetch for milestones without oneshot and not already being fetched (pseudo-local check)
            const missing = allMilestones.filter((m: any) => !m.oneshot && !m.isFetching);

            if (missing.length === 0) return;

            // Mark as fetching to avoid duplicate triggers
            missing.forEach((m: any) => m.isFetching = true);

            for (const item of missing) {
                try {
                    const result = await api.getSkillVideo(item.skill, language);
                    if (result?.oneshot) {
                        setRoadmap((prev: any) => {
                            if (!prev) return prev;
                            const next = { ...prev };
                            phases.forEach(p => {
                                next.full_roadmap[p] = next.full_roadmap[p]?.map((m: any) =>
                                    m.skill === item.skill ? { ...m, oneshot: result.oneshot } : m
                                );
                            });
                            return next;
                        });
                    }
                } catch (err) {
                    console.error(`Failed to recover video for ${item.skill}`);
                } finally {
                    item.isFetching = false;
                }
            }
        };

        fetchMissingVideos();
    }, [roadmap, language, generating]);

    const fetchProgress = async () => {
        try {
            const userId = user?.id;
            if (!userId) return;
            const progressData = await api.getVideoProgress(String(userId));
            const map: Record<string, any> = {};
            for (const p of progressData.progress || []) {
                map[p.video_id] = p;
            }
            setVideoProgressMap(map);
        } catch (err) { }
    };

    const handleGenerate = async (customRole?: string) => {
        setGenerating(true);
        setError(null);
        try {
            const data = await api.generateRoadmap(String(user?.id), language, customRole || searchQuery);
            // Refresh user profile to ensure target_role is in sync if it was changed elsewhere
            if (refreshUser) refreshUser();
            const rd = data.roadmap;

            // Defensive synchronization: Sync oneshot resources between fast-track and full roadmap if missing
            const resourceSyncMap: Record<string, any> = {};
            rd.fast_track_roadmap?.forEach((item: any) => {
                if (item.oneshot) resourceSyncMap[item.skill.toLowerCase()] = item.oneshot;
            });

            const phases = ['beginner_milestones', 'intermediate_milestones', 'advanced_milestones'];
            phases.forEach(p => {
                rd.full_roadmap?.[p]?.forEach((item: any) => {
                    if (!item.oneshot && resourceSyncMap[item.skill.toLowerCase()]) {
                        item.oneshot = resourceSyncMap[item.skill.toLowerCase()];
                    }
                });
            });

            setRoadmap(rd);
            setSearchQuery('');
            fetchProgress();
        } catch (err) {
            setError('Could not build roadmap. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    const getSkillProgress = (item: any) => {
        // ALWAYS start at 0% until the video is watched, as requested
        let videoCompletion = 0;
        if (item.oneshot) {
            videoCompletion = videoProgressMap[item.oneshot.video_id]?.completion_percentage || 0;
        }
        return Math.min(100, videoCompletion);
    };

    const calculateOverallProgress = useCallback(() => {
        if (!roadmap) return 0;
        const fullRoadmap = roadmap.full_roadmap || {};
        const allMilestones = [
            ...(fullRoadmap.beginner_milestones || []),
            ...(fullRoadmap.intermediate_milestones || []),
            ...(fullRoadmap.advanced_milestones || [])
        ];

        if (allMilestones.length === 0) return 0;

        const totalProgress = allMilestones.reduce((acc: number, item: any) => acc + getSkillProgress(item), 0);
        return totalProgress / allMilestones.length;
    }, [roadmap, videoProgressMap]);

    const handlePlayOneshot = async (oneshot: Oneshot, skillName: string) => {
        if (!oneshot?.video_id) return;
        setCurrentPlaylist(null);
        setActiveVideo({ id: oneshot.video_id, title: oneshot.title, skillName });
        setPlayerOpen(true);
        if (user?.id) api.incrementPlayCount(String(user.id), oneshot.video_id).catch(() => { });
    };

    const handleSaveProgress = useCallback(async (videoId: string, data: any) => {
        if (!user?.id) return;
        try {
            const res = await api.saveVideoProgress(String(user.id), videoId, data);
            setVideoProgressMap(prev => ({
                ...prev,
                [videoId]: {
                    ...prev[videoId],
                    video_id: videoId,
                    completion_percentage: res?.accumulated_percent || data.completion_percentage,
                    is_completed: res?.is_completed ? 1 : 0,
                    last_position_seconds: data.last_position_seconds,
                }
            }));
            return res;
        } catch (err) { }
    }, [user]);

    const handleGetProgress = useCallback(async (videoId: string) => {
        if (!user?.id) return { progress: null };
        return api.getSingleVideoProgress(String(user.id), videoId);
    }, [user]);

    const toggleTutor = () => setTutorOverlayOpen(!tutorOverlayOpen);
    const handleClosePlayer = () => {
        setPlayerOpen(false);
        setActiveVideo(null);
        setTutorOverlayOpen(false);
        fetchProgress();
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[70vh] space-y-6">
            <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="text-green-500 animate-spin" size={24} />
                </div>
            </div>
            <div className="text-center">
                <h3 className="text-gray-900 font-bold">Syncing Your Career Map</h3>
                <p className="text-gray-400 text-xs mt-1 uppercase tracking-widest font-black">Connecting to Intelligence Engine</p>
            </div>
        </div>
    );

    if (!roadmap) return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="relative overflow-hidden bg-gray-900 rounded-[3rem] p-12 md:p-20 shadow-2xl">
                {/* Background effects */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-500/10 blur-[120px] rounded-full -mr-64 -mt-64" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full -ml-64 -mb-64" />

                <div className="relative z-10 text-center">
                    <div className="w-20 h-20 bg-green-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-900/20 animate-float">
                        <Map size={40} />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Engineer Your <span className="text-green-400">Future.</span></h1>
                    <p className="text-gray-400 mb-12 max-w-lg mx-auto text-sm md:text-base font-medium leading-relaxed">
                        Transform your career with an AI-architected learning journey. We analyze market demands and your unique profile to build a bulletproof path to mastery.
                    </p>

                    <div className="max-w-md mx-auto space-y-6">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-green-400 transition-colors" size={20} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Target Role (e.g. AI/ML Engineer)"
                                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all font-medium"
                                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => handleGenerate()}
                                disabled={generating}
                                className="flex-1 h-14 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {generating ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                {generating ? 'Architecting...' : 'Build Roadmap'}
                            </button>
                        </div>

                        <div className="flex items-center justify-center gap-6 pt-4">
                            <button onClick={() => setLanguage('English')} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${language === 'English' ? 'text-green-400' : 'text-gray-500 hover:text-white'}`}>English</button>
                            <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                            <button onClick={() => setLanguage('Hindi')} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${language === 'Hindi' ? 'text-green-400' : 'text-gray-500 hover:text-white'}`}>Hindi</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const overallProgress = calculateOverallProgress();

    return (
        <div className="min-h-screen bg-transparent">
            {/* STICKY DASHBOARD HEADER - top-16 to avoid profile header overlap */}
            <div className="sticky top-16 z-40 w-full glass-panel border-b border-gray-100 px-6 py-1.5 mb-8">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center shadow-lg transform rotate-3 shrink-0">
                            <Map size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0">
                                <h1 className="text-sm font-black text-gray-900 tracking-tight uppercase truncate">Career <span className="text-green-600">Bridge</span></h1>
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-md text-[9px] font-black uppercase tracking-widest">Active</span>
                            </div>
                            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wide truncate max-w-[120px] md:max-w-[200px]">Target: {roadmap.target_role}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Overall Path</p>
                                <p className="text-sm font-black text-gray-900 leading-none">{Math.round(overallProgress)}% Complete</p>
                            </div>
                            <div className="w-10 h-10 relative flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-100" />
                                    <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="100.5" strokeDashoffset={100.5 - (100.5 * overallProgress / 100)} strokeLinecap="round" className="text-green-500 transition-all duration-1000" />
                                </svg>
                                <Target className="absolute text-green-600" size={14} />
                            </div>
                        </div>

                        <div className="flex bg-gray-100 p-0.5 rounded-xl shadow-inner shrink-0">
                            <button onClick={() => setActiveTab('full')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'full' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Full Path</button>
                            <button onClick={() => setActiveTab('fast-track')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'fast-track' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Target Gaps</button>
                        </div>

                        <button
                            onClick={() => handleGenerate()}
                            className="p-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 shrink-0"
                            title="Refresh Roadmap"
                        >
                            <RefreshCw size={18} className={generating ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 pb-20">
                <div className="max-w-3xl space-y-12">
                    {/* CUSTOM GENERATION INPUT - Moved outside tabs for consistency and perfect width alignment */}
                    <div className="text-left">
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2 uppercase">Your <span className="text-green-600">Career</span> Roadmap</h2>
                        <p className="text-gray-500 font-medium text-xs leading-relaxed">
                            The absolute beginner to master journey for **{roadmap.target_role}**.
                        </p>

                        <div className="mt-8 flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1 group min-w-0">
                                <div className="absolute inset-y-0 left-4 flex items-center text-gray-400 group-focus-within:text-green-500 transition-colors">
                                    <Search size={18} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Generate roadmap for e.g. DevOps, Data Science..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                    className="w-full h-12 pl-12 pr-4 bg-white border border-gray-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm"
                                />
                            </div>
                            <button
                                onClick={() => handleGenerate()}
                                disabled={generating || !searchQuery.trim()}
                                className="h-11 px-6 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-gray-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shrink-0"
                            >
                                {generating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} className="text-green-400" />}
                                GENERATE
                            </button>

                            {user?.target_role && roadmap.target_role?.toLowerCase() !== user.target_role.toLowerCase() && (
                                <button
                                    onClick={() => { setSearchQuery(''); handleGenerate(user.target_role); }}
                                    disabled={generating}
                                    className="h-11 px-5 bg-white border-2 border-green-500/10 text-green-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-50 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-95 animate-fade-in group shrink-0"
                                >
                                    <RefreshCw size={14} className={`group-hover:rotate-180 transition-transform ${generating ? 'animate-spin' : ''}`} />
                                    RESET TO: {user.target_role}
                                </button>
                            )}
                        </div>
                    </div>

                    {activeTab === 'full' ? (
                        <div className="relative">
                            {/* VERTICAL PATHWAY RAIL */}
                            <div className="absolute left-6 top-0 bottom-0 w-1 ml-[-2px] border-l-2 border-dashed border-gray-200 z-0" />

                            <div className="space-y-16">
                                {[
                                    { name: 'Beginner', milestones: roadmap.full_roadmap?.beginner_milestones || [], color: 'blue', icon: <Map size={18} /> },
                                    { name: 'Intermediate', milestones: roadmap.full_roadmap?.intermediate_milestones || [], color: 'green', icon: <Rocket size={18} /> },
                                    { name: 'Advanced', milestones: roadmap.full_roadmap?.advanced_milestones || [], color: 'amber', icon: <Award size={18} /> }
                                ].filter(p => p.milestones.length > 0).map((phase, pIdx) => (
                                    <div key={pIdx} className="relative z-10 animate-fade-in">
                                        {/* PHASE DIVIDER */}
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className={`w-10 h-10 rounded-xl bg-white border-2 border-${phase.color}-100 flex items-center justify-center text-${phase.color}-600 shadow-sm relative z-20`}>
                                                {phase.icon}
                                            </div>
                                            <div className="flex flex-col">
                                                <h3 className={`text-sm font-black text-gray-900 tracking-widest uppercase`}>{phase.name} <span className={`text-${phase.color}-600`}>Phase</span></h3>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{phase.milestones.length} Strategic Milestones</p>
                                            </div>
                                            <div className="flex-1 h-[1px] bg-gradient-to-r from-gray-100 to-transparent" />
                                        </div>

                                        <div className="grid gap-6 ml-1.5 border-l-2 border-transparent">
                                            {phase.milestones.map((item: any, idx: number) => {
                                                const progress = getSkillProgress(item);
                                                const isGap = roadmap.fast_track_roadmap?.some((g: any) => g.skill.toLowerCase() === item.skill.toLowerCase());
                                                const isLive = playerOpen && activeVideo?.skillName === item.skill;
                                                const displayOneshot = item.oneshot || roadmap.fast_track_roadmap?.find((g: any) => g.skill.toLowerCase() === item.skill.toLowerCase())?.oneshot;

                                                // Calculate global index for accurate numbering
                                                const prevPhasesLength = [
                                                    roadmap.full_roadmap?.beginner_milestones || [],
                                                    roadmap.full_roadmap?.intermediate_milestones || [],
                                                    roadmap.full_roadmap?.advanced_milestones || []
                                                ].slice(0, pIdx).reduce((acc, curr) => acc + curr.length, 0);
                                                const globalIdx = prevPhasesLength + idx + 1;

                                                return (
                                                    <div key={idx} className={`glass-card p-6 flex flex-col md:flex-row items-start gap-6 group transition-all min-h-[160px] relative overflow-hidden ${isLive ? 'border-cyan-500/50 shadow-[0_0_40px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30' : 'hover:border-gray-200 shadow-sm hover:shadow-md'}`}>
                                                        {/* LIVE BACKGROUND PULSE */}
                                                        {isLive && (
                                                            <div className="absolute inset-0 bg-cyan-500/5 animate-pulse pointer-events-none" />
                                                        )}

                                                        <div className="relative shrink-0 flex flex-col items-center">
                                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shrink-0 shadow-xl transition-all relative z-20 ${isLive ? 'bg-cyan-600 text-white scale-110' : 'bg-gray-900 text-white group-hover:scale-110'}`}>
                                                                {globalIdx}
                                                            </div>

                                                            {/* COMPLETION FILL RAIL - Bridges to next milestone/divider */}
                                                            <div
                                                                className={`absolute top-12 -bottom-6 w-1 ml-[-2px] z-10 transition-all duration-1000 origin-top ${progress === 100 ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`}
                                                                style={{
                                                                    background: phase.color === 'blue' ? 'linear-gradient(to bottom, #2563eb, #60a5fa)' :
                                                                        phase.color === 'green' ? 'linear-gradient(to bottom, #059669, #34d399)' :
                                                                            'linear-gradient(to bottom, #d97706, #fbbf24)',
                                                                    boxShadow: progress === 100 ? `0 0 15px ${phase.color === 'blue' ? 'rgba(37,99,235,0.4)' : phase.color === 'green' ? 'rgba(5,150,105,0.4)' : 'rgba(217,119,6,0.4)'}` : 'none'
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="flex-1 relative z-10 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                                <h4 className="text-xl font-black text-gray-900 tracking-tight lowercase">{item.skill}</h4>
                                                                {isLive && (
                                                                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-50 text-cyan-600 rounded text-[9px] font-black uppercase tracking-widest border border-cyan-100 animate-fade-in shadow-sm">
                                                                        <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-ping" />
                                                                        Live
                                                                    </span>
                                                                )}
                                                                {isGap ? (
                                                                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[8px] font-black uppercase tracking-widest border border-rose-100">Critical Gap</span>
                                                                ) : (
                                                                    <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[8px] font-black uppercase tracking-widest border border-green-100 italic font-medium">Foundational</span>
                                                                )}
                                                            </div>
                                                            <p className="text-gray-500 text-xs font-medium leading-relaxed max-w-xl line-clamp-2 group-hover:line-clamp-none transition-all">{item.importance}</p>

                                                            {item.verification_reason && (
                                                                <div className="mt-2 flex items-start gap-2 text-[9px] text-green-600 font-bold bg-green-50/50 px-2 py-1 rounded-md border border-green-100/50">
                                                                    <ShieldCheck size={10} className="shrink-0 mt-0.5" />
                                                                    <p className="leading-tight italic">AI Verified: {item.verification_reason}</p>
                                                                </div>
                                                            )}

                                                            {displayOneshot ? (
                                                                <div className="mt-4 p-3 bg-gray-50 rounded-xl flex items-center gap-3 border border-gray-100/50 hover:bg-gray-100/50 transition-colors">
                                                                    <div className="w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white shadow-sm shrink-0">
                                                                        <Play size={10} fill="currentColor" className="ml-0.5" />
                                                                    </div>
                                                                    <p className="text-[10px] font-bold text-gray-700 truncate flex-1 leading-relaxed">
                                                                        <span className="text-red-600 font-extrabold mr-2">TOP PREP:</span>
                                                                        {displayOneshot.title}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <div className="mt-4 p-3 bg-gray-50 rounded-xl flex items-center gap-3 border border-gray-100/50 opacity-50">
                                                                    <div className="w-7 h-7 bg-gray-400 rounded-full flex items-center justify-center text-white shrink-0">
                                                                        <Play size={10} fill="currentColor" className="ml-0.5" />
                                                                    </div>
                                                                    <p className="text-[10px] font-bold text-gray-400 truncate flex-1">
                                                                        <span className="font-extrabold mr-2 uppercase">PREP:</span>
                                                                        Fetching masterclass resources...
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="w-full md:w-56 shrink-0 space-y-4 md:mt-1.5">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</span>
                                                                <span className="text-sm font-black text-gray-900">{Math.round(progress)}%</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                <div className={`h-full transition-all duration-1000 ${isLive ? 'bg-cyan-500 relative after:absolute after:inset-0 after:bg-white/30 after:animate-pulse' : 'bg-gray-900'}`} style={{ width: `${progress}%` }} />
                                                            </div>

                                                            {displayOneshot ? (
                                                                <button
                                                                    onClick={() => handlePlayOneshot(displayOneshot!, item.skill)}
                                                                    className={`w-full h-11 rounded-xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all group/play shadow-xl active:scale-95 ${isLive ? 'bg-cyan-600 text-white hover:bg-cyan-500 ring-2 ring-cyan-500/20' : 'bg-gray-900 text-white hover:bg-black'}`}
                                                                >
                                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isLive ? 'border-white/50 animate-pulse' : 'border-green-400/50'}`}>
                                                                        <Play size={10} fill="currentColor" className={`${isLive ? 'text-white' : 'text-green-400'} ml-0.5`} />
                                                                    </div>
                                                                    {isLive ? 'PLAYING LIVE' : 'START'}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    disabled
                                                                    className="w-full h-11 bg-gray-100 text-gray-400 rounded-xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest cursor-not-allowed border border-gray-200"
                                                                >
                                                                    <Clock size={14} className="opacity-40" />
                                                                    FETCHING
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* TARGET ACHIEVEMENT */}
                            <div className="relative pt-10">
                                <div className="absolute -left-5 top-10 w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-yellow-500 shadow-xl ring-4 ring-white transform hover:scale-110 transition-all">
                                    <Trophy size={16} />
                                </div>
                                <div className="pt-12 pb-8 px-8">
                                    <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Goal Reached</h3>
                                    <p className="text-gray-400 text-[9px] font-black uppercase tracking-[0.1em] mt-1">Ready for industry benchmark roles</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* VERTICAL PATHWAY RAIL */}
                            <div className="absolute left-6 top-0 bottom-0 w-1 ml-[-2px] border-l-2 border-dashed border-gray-200 z-0" />

                            <div className="animate-fade-in space-y-8 relative z-10">
                                <div className="grid gap-6">
                                    {(() => {
                                        const filteredGaps = roadmap.fast_track_roadmap?.filter((item: SkillItem) => {
                                            const progress = getSkillProgress(item);
                                            return progress < 100 && progress <= 25;
                                        }) || [];

                                        if (filteredGaps.length === 0) {
                                            return (
                                                <div className="glass-card p-12 flex flex-col items-center text-center gap-6 animate-fade-in border-green-100 bg-green-50/20">
                                                    <div className="w-20 h-20 bg-green-500 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-green-200">
                                                        <Trophy size={32} />
                                                    </div>
                                                    <div className="max-w-md">
                                                        <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase leading-none mb-3">All Gaps <span className="text-green-600">Addressed</span></h3>
                                                        <p className="text-gray-500 text-sm font-medium leading-relaxed">
                                                            You've successfully moved all critical gaps into your active career journey. Keep building your momentum!
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => setActiveTab('full')}
                                                        className="h-12 px-8 bg-gray-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-xl shadow-gray-200 active:scale-95"
                                                    >
                                                        View Full Career Path
                                                        <ArrowRight size={14} />
                                                    </button>
                                                </div>
                                            );
                                        }

                                        return filteredGaps.map((item: SkillItem, idx: number) => {
                                            const progress = getSkillProgress(item);
                                            const isLive = playerOpen && activeVideo?.skillName === item.skill;
                                            return (
                                                <div key={idx} className={`glass-card p-6 flex flex-col md:flex-row items-start gap-6 group transition-all min-h-[160px] relative overflow-hidden ${isLive ? 'border-cyan-500/50 shadow-[0_0_40px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30' : 'hover:border-gray-200 shadow-sm hover:shadow-md'}`}>
                                                    {/* LIVE BACKGROUND PULSE */}
                                                    {isLive && (
                                                        <div className="absolute inset-0 bg-cyan-500/5 animate-pulse pointer-events-none" />
                                                    )}

                                                    <div className="relative shrink-0 flex flex-col items-center">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shrink-0 shadow-xl transition-all relative z-20 ${isLive ? 'bg-cyan-600 text-white scale-110' : 'bg-gray-900 text-white group-hover:scale-110'}`}>
                                                            {idx + 1}
                                                        </div>

                                                        {/* COMPLETION FILL RAIL */}
                                                        <div
                                                            className={`absolute top-12 -bottom-6 w-1 ml-[-2px] z-10 transition-all duration-1000 origin-top ${progress === 100 ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`}
                                                            style={{
                                                                background: 'linear-gradient(to bottom, #2563eb, #60a5fa)',
                                                                boxShadow: progress === 100 ? '0 0 15px rgba(37,99,235,0.4)' : 'none'
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="flex-1 relative z-10 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                            <h4 className="text-xl font-black text-gray-900 tracking-tight lowercase">{item.skill}</h4>
                                                            {isLive && (
                                                                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-50 text-cyan-600 rounded text-[9px] font-black uppercase tracking-widest border border-cyan-100 animate-fade-in shadow-sm">
                                                                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-ping" />
                                                                    Live
                                                                </span>
                                                            )}
                                                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[8px] font-black uppercase tracking-widest border border-rose-100">Critical Gap</span>
                                                        </div>
                                                        <p className="text-gray-500 text-xs font-medium leading-relaxed max-w-xl line-clamp-2 group-hover:line-clamp-none transition-all">{item.importance}</p>

                                                        {item.verification_reason && (
                                                            <div className="mt-2 flex items-start gap-2 text-[9px] text-green-600 font-bold bg-green-50/50 px-2 py-1 rounded-md border border-green-100/50">
                                                                <ShieldCheck size={10} className="shrink-0 mt-0.5" />
                                                                <p className="leading-tight italic">AI Verified: {item.verification_reason}</p>
                                                            </div>
                                                        )}

                                                        {item.oneshot && (
                                                            <div className="mt-4 p-3 bg-gray-50 rounded-xl flex items-center gap-3 border border-gray-100/50 hover:bg-gray-100/50 transition-colors">
                                                                <div className="w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white shadow-sm shrink-0">
                                                                    <Play size={10} fill="currentColor" className="ml-0.5" />
                                                                </div>
                                                                <p className="text-[10px] font-bold text-gray-700 truncate flex-1">
                                                                    <span className="text-red-600 font-extrabold mr-2">TOP PREP:</span>
                                                                    {item.oneshot.title}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="w-full md:w-56 shrink-0 space-y-4 md:mt-1.5">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</span>
                                                            <span className="text-sm font-black text-gray-900">{Math.round(progress)}%</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div className={`h-full transition-all duration-1000 ${isLive ? 'bg-cyan-500 relative after:absolute after:inset-0 after:bg-white/30 after:animate-pulse' : 'bg-gray-900'}`} style={{ width: `${progress}%` }} />
                                                        </div>

                                                        {item.oneshot && (
                                                            <button
                                                                onClick={() => handlePlayOneshot(item.oneshot!, item.skill)}
                                                                className={`w-full h-11 rounded-xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all group/play shadow-xl active:scale-95 ${isLive ? 'bg-cyan-600 text-white hover:bg-cyan-500 ring-2 ring-cyan-500/20' : 'bg-gray-900 text-white hover:bg-black'}`}
                                                            >
                                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isLive ? 'border-white/50 animate-pulse' : 'border-green-400/50'}`}>
                                                                    <Play size={10} fill="currentColor" className={`${isLive ? 'text-white' : 'text-green-400'} ml-0.5`} />
                                                                </div>
                                                                {isLive ? 'PLAYING LIVE' : 'START'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ====== FLOATING PIP PLAYER ====== */}
                    {/* ====== FULL-SCREEN PRO THEATER OVERLAY ====== */}
                    {playerOpen && activeVideo && (
                        <div className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl animate-fade-in flex flex-col font-sans overflow-hidden">
                            {/* Pro Theater Header */}
                            <div className="h-20 bg-black/40 border-b border-white/5 flex items-center justify-between px-8 backdrop-blur-2xl shrink-0 gap-8">
                                <div className="flex items-center gap-6 flex-1 min-w-0">
                                    <div className="flex-none hidden md:flex items-center gap-3">
                                        <div className="px-3 py-1 bg-green-500 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-md shadow-lg shadow-green-500/20">Masterclass</div>
                                        <div className="w-[1px] h-8 bg-white/10" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-white font-black text-base tracking-tight truncate lowercase flex items-center gap-2">
                                            <span className="text-green-500 opacity-50 shrink-0">#</span>
                                            {activeVideo.skillName}
                                        </h3>
                                        <p className="text-white/40 text-[10px] font-bold tracking-widest truncate uppercase mt-0.5">{activeVideo.title}</p>
                                    </div>
                                </div>

                                {/* Central Status Indicators */}
                                <div className="hidden lg:flex items-center gap-8 flex-1 justify-center max-w-xl">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-end mb-1.5 px-1">
                                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/30">Milestone Mastery</span>
                                            <span className="text-[11px] font-black text-green-400 tabular-nums">
                                                {videoProgressMap[activeVideo.id]?.completion_percentage || 0}%
                                            </span>
                                        </div>
                                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
                                            <div
                                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-600 to-emerald-400 transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                                                style={{ width: `${videoProgressMap[activeVideo.id]?.completion_percentage || 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 shrink-0">
                                    <button
                                        onClick={toggleTutor}
                                        className={`h-11 px-5 flex items-center gap-3 rounded-xl transition-all border group active:scale-95 ${tutorOverlayOpen ? 'bg-green-600 border-green-500 text-white shadow-xl shadow-green-600/20' : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'}`}
                                    >
                                        <Bot size={16} className={tutorOverlayOpen ? 'animate-bounce' : ''} />
                                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">AI Tutor</span>
                                    </button>

                                    <button
                                        onClick={handleClosePlayer}
                                        className="h-11 px-5 flex items-center gap-3 bg-red-600/10 hover:bg-red-600/20 rounded-xl text-red-400 transition-all border border-red-500/20 group active:scale-95"
                                    >
                                        <X size={16} />
                                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Exit</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 flex overflow-hidden lg:flex-row flex-col">
                                {/* Cinema Area - Aspect Ratio Box */}
                                <div className={`flex-1 relative bg-black flex items-center justify-center p-4 lg:p-8 transition-all duration-700 ease-in-out ${tutorOverlayOpen ? 'lg:pr-4' : ''}`}>
                                    <div className="w-full h-full max-w-[1400px] max-h-[800px] aspect-video bg-zinc-900 rounded-3xl overflow-hidden shadow-[0_48px_100px_rgba(0,0,0,0.8)] border border-white/10 relative group/player">
                                        <YouTubePlayer
                                            videoId={activeVideo.id}
                                            userId={user?.id || ''}
                                            milestoneId={activeVideo.skillName || ''}
                                            saveProgress={handleSaveProgress}
                                            getProgress={handleGetProgress}
                                            onProgressUpdate={(percent, currentTime) => {
                                                setVideoProgressMap(prev => ({
                                                    ...prev,
                                                    [activeVideo.id]: {
                                                        ...prev[activeVideo.id],
                                                        video_id: activeVideo.id,
                                                        completion_percentage: percent,
                                                        last_position_seconds: currentTime
                                                    }
                                                }));
                                            }}
                                        />
                                        
                                        {/* Cinematic Vignette */}
                                        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.6)] group-hover/player:shadow-[inset_0_0_60px_rgba(0,0,0,0.3)] transition-shadow duration-700" />
                                    </div>
                                </div>

                                {/* Sidebar System - Side-by-side flex item */}
                                <div className={`bg-zinc-900/40 backdrop-blur-2xl border-l border-white/5 flex flex-col transition-all duration-700 ease-in-out relative z-[210] shrink-0 h-full ${tutorOverlayOpen ? 'w-full lg:w-[480px] translate-x-0' : 'w-0 translate-x-full overflow-hidden pointer-events-none'}`}>
                                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50 shrink-0">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-green-500/10">
                                                <Bot size={24} className="animate-pulse" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-white leading-none lowercase tracking-tight">AI PROCTOR</h4>
                                                <p className="text-[10px] font-bold text-white/30 mt-1.5 uppercase tracking-widest">Interactive Video Analysis</p>
                                            </div>
                                        </div>
                                        <button onClick={toggleTutor} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90 border border-white/5">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <TutorChat
                                            isOpen={true}
                                            onClose={toggleTutor}
                                            videoId={activeVideo.id}
                                            videoTitle={activeVideo.title}
                                            language={language}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

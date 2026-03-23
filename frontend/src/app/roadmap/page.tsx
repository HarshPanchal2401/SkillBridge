'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Sparkles, Map, Rocket, Clock, ShieldCheck, Zap,
    ChevronRight, ChevronDown, Play, CheckCircle2, Circle,
    MessageSquare, Layout, BarChart3 as BarChart, BookOpen,
    ArrowRight, Award, BrainCircuit, Globe,
    X, MonitorPlay, Bot, Languages, ListVideo,
    Eye, Timer, TrendingUp, PlayCircle, Milestone,
    Trophy, Flag, Construction, Target, Star, RefreshCw,
    MessageCircle, ThumbsUp, Check, Layers
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
    current_proficiency: number;
    playlist?: Playlist | null;
    oneshot?: Oneshot | null;
}

export default function RoadmapPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [roadmap, setRoadmap] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'fast-track' | 'full'>('fast-track');
    const [language, setLanguage] = useState<'English' | 'Hindi'>('English');

    // Video player state
    const [playerOpen, setPlayerOpen] = useState(false);
    const [activeVideo, setActiveVideo] = useState<{ id: string; title: string; skillName?: string } | null>(null);
    const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);

    const [tutorOverlayOpen, setTutorOverlayOpen] = useState(false);

    // Analytics
    const [analytics, setAnalytics] = useState<any>(null);
    const [videoProgressMap, setVideoProgressMap] = useState<Record<string, any>>({});

    useEffect(() => {
        if (user?.id) {
            fetchRoadmap();
            fetchAnalytics();
        }
    }, [user]);

    const fetchRoadmap = async () => {
        setLoading(true);
        try {
            const userId = user?.id;
            if (!userId) return;
            const data = await api.getLatestRoadmap(userId);
            if (data.roadmap_data) {
                setRoadmap(data.roadmap_data);
                if (data.roadmap_data.language) {
                    setLanguage(data.roadmap_data.language === 'Hindi' ? 'Hindi' : 'English');
                }
            }
        } catch (err) {
            setError('Failed to load roadmap.');
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalytics = async () => {
        try {
            const userId = user?.id;
            if (!userId) return;
            const data = await api.getVideoAnalytics(String(userId));
            setAnalytics(data.analytics);
            const progressData = await api.getVideoProgress(String(userId));
            const map: Record<string, any> = {};
            for (const p of progressData.progress || []) {
                map[p.video_id] = p;
            }
            setVideoProgressMap(map);

            // Recalculate readiness based on fresh progress
            if (roadmap) {
                const newScore = calculateOverallScore(roadmap, map);
                setRoadmap((prev: any) => prev ? {
                    ...prev,
                    readiness_summary: {
                        ...prev.readiness_summary,
                        current_score: newScore
                    }
                } : null);
            }
        } catch (err) { }
    };

    const calculateOverallScore = (currentRoadmap: any, progressMap: Record<string, any>) => {
        const gaps = currentRoadmap.fast_track_roadmap || [];

        // FOCUS ONLY ON ROADMAP COMPLETION TO ENSURE 0% START AFTER RESET
        let sumProf = 0;
        let totalItems = gaps.length;

        if (totalItems === 0) return 100; // Ready if no gaps

        for (const item of gaps) {
            let videoPercent = 0;
            if (item.oneshot) {
                videoPercent = (progressMap[item.oneshot.video_id]?.completion_percentage || 0) / 100;
            }
            sumProf += videoPercent;
        }

        return (sumProf / totalItems) * 100;
    };

    const handleResetProgress = async () => {
        if (!user?.id || !window.confirm("Are you sure you want to reset ALL your progress? This will clear all video history and set your readiness score back to 0%.")) return;

        try {
            await api.resetAllProgress(String(user.id));
            await fetchAnalytics();
        } catch (err) {
            console.error("Reset failed", err);
            alert("Failed to reset progress.");
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        try {
            const data = await api.generateRoadmap(String(user?.id), language);
            setRoadmap(data.roadmap);
            fetchAnalytics();
        } catch (err) {
            setError('Generation failed.');
        } finally {
            setGenerating(false);
        }
    };

    const handlePlayPlaylist = async (playlist: Playlist, skillName: string) => {
        if (!playlist?.videos?.length) return;
        const firstVideo = playlist.videos[0];
        setCurrentPlaylist(playlist);
        setActiveVideo({ id: firstVideo.video_id, title: firstVideo.title, skillName });
        setPlayerOpen(true);
        setTutorOverlayOpen(false);
        if (user?.id) api.incrementPlayCount(String(user.id), firstVideo.video_id).catch(() => { });
    };

    const handlePlayOneshot = async (oneshot: Oneshot, skillName: string) => {
        if (!oneshot?.video_id) return;
        setCurrentPlaylist(null);
        setActiveVideo({ id: oneshot.video_id, title: oneshot.title, skillName });
        setPlayerOpen(true);
        setTutorOverlayOpen(false);
        if (user?.id) api.incrementPlayCount(String(user.id), oneshot.video_id).catch(() => { });
    };

    const handleSwitchVideo = (video: PlaylistVideo) => {
        setActiveVideo({ id: video.video_id, title: video.title, skillName: activeVideo?.skillName });
        if (user?.id) api.incrementPlayCount(String(user.id), video.video_id).catch(() => { });
    };

    const handleClosePlayer = () => {
        setPlayerOpen(false);
        setActiveVideo(null);
        setCurrentPlaylist(null);
        setTutorOverlayOpen(false);
        fetchAnalytics();
    };

    // Progress API callbacks for YouTubePlayer
    const handleSaveProgress = useCallback(async (videoId: string, data: any) => {
        if (!user?.id) return;
        try {
            const res = await api.saveVideoProgress(String(user.id), videoId, data);

            // Update local map for real-time UI response (unlocking/progress)
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
        } catch (err) {
            console.error("Save progress failed", err);
        }
    }, [user]);

    const handleGetProgress = useCallback(async (videoId: string) => {
        if (!user?.id) return { progress: null };
        return api.getSingleVideoProgress(String(user.id), videoId);
    }, [user]);

    const toggleTutor = () => {
        setTutorOverlayOpen(!tutorOverlayOpen);
    };

    const getSkillProgress = (item: SkillItem) => {
        let videoCompletion = 0;
        if (item.oneshot) {
            videoCompletion = videoProgressMap[item.oneshot.video_id]?.completion_percentage || 0;
        }
        return Math.min(100, videoCompletion);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
            <p className="text-gray-400 text-sm animate-pulse">Syncing your journey...</p>
        </div>
    );

    if (!roadmap) return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center shadow-sm">
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Map size={32} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Build Your AI Roadmap</h1>
                <p className="text-gray-500 mb-8 max-w-sm mx-auto text-sm">We'll map out a professional learning path based on your target role and skill gaps.</p>
                <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                    <button onClick={() => setLanguage('English')} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${language === 'English' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>🇬🇧 English</button>
                    <button onClick={() => setLanguage('Hindi')} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${language === 'Hindi' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>🇮🇳 Hindi</button>
                </div>
                <button onClick={handleGenerate} disabled={generating} className="px-8 py-3.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-sm flex items-center gap-2 mx-auto disabled:opacity-50">
                    {generating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} className="text-green-200" />}
                    {generating ? 'Mapping Journey...' : 'Generate Roadmap'}
                </button>
            </div>
        </div>
    );

    return (
        <>
            <div className="max-w-7xl mx-auto py-6 px-6 animate-fade-in space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold uppercase tracking-wider mb-3">
                            <Map size={12} />
                            Personalized Journey
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Skill <span className="text-green-600">Roadmap</span></h1>
                        <p className="text-gray-500 mt-1">Strategic learning path for {roadmap.readiness_summary?.top_gap_category || "Industry Success"}.</p>
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner shrink-0">
                        <button onClick={() => setActiveTab('fast-track')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'fast-track' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Target Gaps</button>
                        <button onClick={() => setActiveTab('full')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'full' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Full Path</button>
                    </div>
                </div>

                {activeTab === 'fast-track' ? (
                    <div className="grid lg:grid-cols-12 gap-8">
                        {/* ── PATH COLUMN (Left) ── */}
                        <div className="lg:col-span-8 relative pl-12 md:pl-20 py-4">
                            <div className="absolute left-6 md:left-10 top-0 bottom-0 w-[2px] bg-gray-200 rounded-full" />
                            <div className="space-y-16">
                                {roadmap.fast_track_roadmap?.map((item: SkillItem, idx: number) => {
                                    const skillProgress = getSkillProgress(item);
                                    const isReady = skillProgress >= 90;

                                    return (
                                        <div key={idx} className="relative group">
                                            <div className={`absolute -left-6 md:-left-10 top-2 w-10 h-10 -ml-5 rounded-full border-2 z-10 flex items-center justify-center transition-all bg-white shadow-sm ${isReady ? 'border-green-500 text-green-600' : 'border-gray-200 text-gray-400'}`}>
                                                {isReady ? <CheckCircle2 size={18} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                                            </div>
                                            <div className="card-simple p-6 hover:border-green-200 transition-all group-hover:shadow-md">
                                                <div className="flex flex-col md:flex-row gap-4 mb-5 pb-5 border-b border-gray-50">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-600 transition-colors uppercase tracking-tight">{item.skill}</h3>
                                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${item.difficulty === 'Advanced' ? 'bg-rose-50 text-rose-600' : 'bg-green-50 text-green-600'}`}>{item.difficulty}</span>
                                                        </div>
                                                        <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 md:line-clamp-none">{item.importance}</p>
                                                    </div>
                                                    <div className="flex md:flex-col gap-2 shrink-0">
                                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-600">
                                                            <Clock size={12} /> {item.estimated_time || "24h"}
                                                        </div>
                                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-lg text-[10px] font-bold text-green-600">
                                                            <TrendingUp size={12} /> {Math.round(skillProgress)}%
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    {item.oneshot && item.oneshot.video_id && (
                                                        <button
                                                            onClick={() => handlePlayOneshot(item.oneshot!, item.skill)}
                                                            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-amber-50 hover:border-amber-100 border border-transparent transition-all group/row"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-amber-600 group-hover/row:bg-amber-500 group-hover/row:text-white transition-all"><Zap size={16} /></div>
                                                                <div className="text-left">
                                                                    <p className="text-xs font-bold text-gray-900 line-clamp-1">{item.oneshot.title}</p>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Quick One-Shot</p>
                                                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                                                            <Eye size={10} /> {item.oneshot.view_count_text || "Popular"}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Play className="text-gray-300 group-hover/row:text-amber-500" size={14} fill="currentColor" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="relative pt-4">
                                    <div className="absolute -left-6 md:-left-10 top-0 w-10 h-10 -ml-5 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center animate-bounce-slow"><Trophy size={18} /></div>
                                    <div className="pl-6">
                                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Market Readiness Target</h4>
                                        <p className="text-xs text-gray-400">Complete the course work to unlock the certification exam.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── SIDEBAR (Right) ── */}
                        <div className="lg:col-span-4 space-y-6">
                            <div className="card-simple space-y-6">
                                <div className="flex items-center gap-2 text-green-600">
                                    <Award size={18} />
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest">Market Preparedness</h4>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-4xl font-bold text-gray-900">{(roadmap.readiness_summary?.current_score ?? 0).toFixed(0)}%</p>
                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Overall Score</p>
                                    </div>
                                    <div className="relative w-20 h-20">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
                                            <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="251" strokeDashoffset={251 - (251 * (roadmap.readiness_summary?.current_score ?? 0) / 100)} strokeLinecap="round" className="text-green-500 transition-all duration-1000" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleGenerate} disabled={generating} className="py-3 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                                        {generating ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
                                    </button>
                                    <button onClick={handleResetProgress} className="py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2">
                                        <X size={14} /> Reset All
                                    </button>
                                </div>
                            </div>

                            {analytics && (
                                <div className="card-simple">
                                    <div className="flex items-center gap-2 text-blue-600 mb-6 font-black uppercase tracking-widest text-[10px]"><BarChart size={16} /> Learning Metrics</div>
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Time</p>
                                            <p className="text-sm font-bold text-gray-900">{analytics.total_watch_time_text || '0m'}</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Items</p>
                                            <p className="text-sm font-bold text-gray-900">{analytics.total_completed || 0}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Skill Progress</p>
                                        <div className="space-y-3">
                                            {roadmap.fast_track_roadmap?.slice(0, 5).map((item: SkillItem, i: number) => {
                                                const progress = getSkillProgress(item);
                                                return (
                                                    <div key={i} className="space-y-1.5">
                                                        <div className="flex justify-between text-[10px] font-bold uppercase">
                                                            <span className="text-gray-700 truncate">{item.skill}</span>
                                                            <span className="text-green-600">{Math.round(progress)}%</span>
                                                        </div>
                                                        <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-green-500 transition-all duration-500"
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="relative max-w-5xl mx-auto py-12 px-6">
                        {/* ROLE HEADER */}
                        <div className="text-center mb-20 animate-fade-in font-sans">
                            <h2 className="text-sm font-black text-green-600 uppercase tracking-[0.4em] mb-4">Complete Career Journey</h2>
                            <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">The {roadmap?.target_role || 'Career'} Bridge</h1>
                            <p className="mt-4 text-gray-500 font-medium max-w-2xl mx-auto italic">
                                From foundational basics to industry-leading expertise. Follow the map to achieve market readiness.
                            </p>
                        </div>

                        {/* THE PREMIUM BRIDGE LINE */}
                        <div className="absolute left-8 md:left-[50%] top-48 bottom-48 w-[6px] bg-gray-100 rounded-full md:-translate-x-1/2 shadow-inner" />
                        <div
                            className="absolute left-8 md:left-[50%] top-48 w-[6px] bg-gradient-to-b from-green-400 via-blue-500 to-purple-600 rounded-full md:-translate-x-1/2 transition-all duration-1000 origin-top shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                            style={{ height: `${roadmap.readiness_summary?.current_score ?? 0}%`, transition: 'height 2s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        />
                        <div className="space-y-40">
                            {[
                                { key: 'beginner_milestones', label: 'THE FOUNDATIONAL PHASE', desc: 'Core principles and syntax essential for every professional.', color: 'green', icon: <Sparkles size={24} /> },
                                { key: 'intermediate_milestones', label: 'THE PROFESSIONAL CORE', desc: 'Real-world application, logic systems, and architectural standards.', color: 'blue', icon: <Layers size={24} /> },
                                { key: 'advanced_milestones', label: 'INDUSTRY EXCELLENCE', desc: 'Enterprise scaling, optimization, and advanced leadership patterns.', color: 'purple', icon: <Zap size={24} /> }
                            ].map((phase, pIdx) => (
                                <div key={phase.key} className="relative z-10">
                                    {/* PHASE LANDMARK */}
                                    <div className="flex flex-col items-center mb-20 md:mb-32">
                                        <div className={`w-16 h-16 rounded-3xl ${phase.color === 'green' ? 'bg-green-600' : phase.color === 'blue' ? 'bg-blue-600' : 'bg-purple-600'} text-white flex items-center justify-center shadow-2xl transform rotate-12 mb-6 ring-8 ring-white`}>
                                            <div className="transform -rotate-12">{phase.icon}</div>
                                        </div>
                                        <h3 className={`text-xs font-black uppercase tracking-[0.4em] ${phase.color === 'green' ? 'text-green-600' : phase.color === 'blue' ? 'text-blue-600' : 'text-purple-600'}`}>{phase.label}</h3>
                                        <p className="text-xs text-center text-gray-400 mt-2 max-w-sm font-bold uppercase tracking-tighter">{phase.desc}</p>
                                    </div>
                                    <div className="space-y-16 md:space-y-24">
                                        {roadmap.full_roadmap?.[phase.key]?.map((milestone: any, mIdx: number) => {
                                            const progress = getSkillProgress(milestone);
                                            const isDone = progress >= 90;
                                            const isLeft = mIdx % 2 === 0;

                                            return (
                                                <div key={mIdx} className={`relative flex items-center w-full ${isLeft ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
                                                    {/* NODE MARKER */}
                                                    <div className={`absolute left-8 md:left-[50%] top-1/2 -translate-y-1/2 w-8 h-8 rounded-2xl border-4 md:-translate-x-1/2 z-30 transition-all duration-700 transform ${isLeft ? 'rotate-45' : '-rotate-12'} ${isDone ? 'bg-white border-green-500 shadow-[0_0_25px_rgba(34,197,94,0.4)]' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            {isDone ? <Check size={14} className="text-green-600" /> : <ChevronRight size={14} className="text-gray-300" />}
                                                        </div>
                                                    </div>

                                                    {/* CONTENT CARD */}
                                                    <div className={`flex-1 ${isLeft ? 'pl-20 md:pl-0 md:pr-24' : 'pl-20 md:pl-24'}`}>
                                                        <div className={`group relative p-8 rounded-[2.5rem] border transition-all duration-500 overflow-hidden font-sans ${isDone ? 'bg-green-50/10 border-green-100' : 'bg-white/70 backdrop-blur-xl border-gray-50 hover:border-gray-200 hover:shadow-2xl hover:-translate-y-2'}`}>
                                                            {/* Background Glow */}
                                                            <div className={`absolute top-0 right-0 w-48 h-48 blur-[80px] opacity-20 -mr-24 -mt-24 transition-all group-hover:opacity-40 ${phase.color === 'green' ? 'bg-green-400' : phase.color === 'blue' ? 'bg-blue-400' : 'bg-purple-400'}`} />

                                                            <div className="relative z-10">
                                                                <div className="flex items-center gap-4 mb-4">
                                                                    <div className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>0{pIdx + 1}.0{mIdx + 1}</div>
                                                                    <h4 className={`text-xl font-black tracking-tight transition-colors ${isDone ? 'text-green-800' : 'text-gray-900 group-hover:text-blue-600'}`}>{milestone.skill}</h4>
                                                                </div>

                                                                <p className="text-[13px] text-gray-500 leading-relaxed font-medium mb-8 pr-6">
                                                                    {milestone.importance || milestone.outcome || "Critical competency required for high-level industry performance."}
                                                                </p>

                                                                {/* PREMIUM PROGRESS BAR */}
                                                                <div className="flex flex-col gap-3">
                                                                    <div className="flex justify-between items-end">
                                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Mastery Level</span>
                                                                        <span className={`text-sm font-black tracking-tighter ${isDone ? 'text-green-600' : 'text-gray-900'}`}>{Math.round(progress)}%</span>
                                                                    </div>
                                                                    <div className="h-2.5 w-full bg-gray-100/50 rounded-full overflow-hidden p-0.5 border border-gray-50">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-1000 ${isDone ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-gray-900'}`}
                                                                            style={{ width: `${progress}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* SPACER FOR MD LAYOUT */}
                                                    <div className="hidden md:block flex-1" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {/* GOAL: THE TROPHY */}
                            <div className="relative z-10 flex flex-col items-center pt-20">
                                <div className="absolute top-0 w-[4px] h-20 bg-gradient-to-b from-purple-200 to-transparent" />
                                <div className="group relative mt-20">
                                    <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse" />
                                    <div className="relative w-32 h-32 rounded-[3rem] bg-gray-900 border-4 border-white shadow-2xl flex items-center justify-center text-yellow-500 transform transition-transform group-hover:scale-110 duration-700 cursor-default">
                                        <Trophy size={64} />
                                    </div>
                                </div>
                                <div className="mt-12 text-center animate-bounce-slow font-sans">
                                    <h3 className="text-4xl font-black text-gray-900 uppercase tracking-[0.25em]">{roadmap?.target_role || 'Job'} READY</h3>
                                    <p className="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em]">Industry Preparedness Reached</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* ====== IMMERSIVE PLAYER MODAL (Outside animated div to ensure true fixed positioning) ====== */}
            {playerOpen && activeVideo && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden animate-fade-in font-sans">

                    {/* Dedicated Top Header (Solid background to prevent overlap) */}
                    <div className="flex-none h-16 bg-gray-900 border-b border-white/10 z-50 flex items-center justify-between px-6">
                        <div className="flex items-center gap-4">
                            <button onClick={handleClosePlayer} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all border border-white/5"><X size={20} /></button>
                            <div className="hidden md:block">
                                <h3 className="text-white font-bold text-sm tracking-tight">{activeVideo.skillName}</h3>
                                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest truncate max-w-md">{activeVideo.title}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={toggleTutor}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tutorOverlayOpen ? 'bg-green-600 text-white shadow-[0_0_20px_rgba(22,163,74,0.4)]' : 'bg-green-600/10 text-green-400 border border-green-500/30 hover:bg-green-600 hover:text-white'}`}
                            >
                                <Bot size={18} /> {tutorOverlayOpen ? 'Dismiss Tutor' : 'Ask AI Tutor'}
                            </button>
                        </div>
                    </div>

                    {/* MAIN CONTENT AREA */}
                    <div className="flex-1 flex flex-row overflow-hidden relative">
                        {/* MAIN STAGE (Blurred when Tutor is open) */}
                        <div className={`flex-1 relative bg-black transition-all duration-700`}>
                            <div className={`absolute inset-0 z-10 transition-all duration-500 pointer-events-none ${tutorOverlayOpen ? 'backdrop-blur-[12px] bg-black/40' : 'backdrop-blur-none bg-black/0'}`} />
                            <div className={`w-full h-full transition-all duration-500 ${tutorOverlayOpen ? 'scale-95 opacity-80' : 'scale-100 opacity-100'}`}>
                                <YouTubePlayer
                                    videoId={activeVideo.id}
                                    userId={user?.id || ''}
                                    milestoneId={activeVideo.skillName || ''}
                                    saveProgress={handleSaveProgress}
                                    getProgress={handleGetProgress}
                                />
                            </div>
                        </div>

                        {/* Unified Player already handles the sidebar if videos are provided */}

                        {/* TUTOR MODAL OVERLAY */}
                        {tutorOverlayOpen && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 animate-scale-in">
                                <div className="w-full max-w-4xl h-[90%] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-gray-100 ring-4 ring-black/5">
                                    <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-green-50/30">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-200"><Bot size={24} /></div>
                                            <div>
                                                <h4 className="text-lg font-bold text-gray-900 tracking-tight">AI Skills Tutor</h4>
                                                <p className="text-xs text-green-600 font-bold uppercase tracking-widest">{activeVideo.skillName} • Analysis Mode</p>
                                            </div>
                                        </div>
                                        <button onClick={toggleTutor} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors shadow-sm"><X size={20} /></button>
                                    </div>
                                    <div className="flex-1 overflow-hidden relative">
                                        <TutorChat
                                            isOpen={true}
                                            onClose={toggleTutor}
                                            videoId={activeVideo.id}
                                            videoTitle={activeVideo.title}
                                            language={language}
                                        />
                                    </div>
                                    <div className="px-6 py-3 bg-gray-50 flex items-center justify-between">
                                        <div className="flex items-center gap-2"><Sparkles className="text-amber-500" size={14} /><span className="text-[10px] text-gray-400 font-bold uppercase">Enhanced by Groq LLM & RAG</span></div>
                                        <p className="text-[10px] text-gray-400 font-bold">Ask about any timestamp or concept in the video.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import YouTubePlayer from '../../components/YouTubePlayer';
import RoadmapChat from '../../components/RoadmapChat';
import {
    Map,
    CheckCircle2,
    Circle,
    Clock,
    ChevronDown,
    ChevronUp,
    BookOpen,
    ExternalLink,
    Play,
    Award,
    ArrowRight,
    Sparkles,
    Target,
    Lock,
    ChevronRight,
    ArrowUpRight,
    Star,
    Zap,
    Flag,
    MessageSquare,
    Video,
    History,
    RefreshCcw,
    Gamepad2,
    BrainCircuit,
    Loader2,
    Layers
} from 'lucide-react';

interface Milestone {
    id: string;
    name: string;
    description: string;
    order: number;
    estimatedWeeks: number;
    prerequisites?: string[];
    skills: string[];
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    youtube_playlist_id?: string;
    resources?: any[];
    current_video_id?: string;
    current_video_time?: number;
    progress: {
        status: 'not_started' | 'in_progress' | 'completed';
        started_at: string | null;
        completed_at: string | null;
        watched_duration_seconds: number;
        total_duration_seconds: number;
    };
}

interface Roadmap {
    id: string;
    title: string;
    description: string;
    roadmap_type: 'personal' | 'full';
    target_role: string;
    language: string;
    milestones: Milestone[];
    created_at: string;
    last_accessed: string;
    overall_readiness?: number;
    trending_highlights?: string[];
}

export default function RoadmapPage() {
    const { user, loading: authLoading, userId } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [fullRoadmap, setFullRoadmap] = useState<Roadmap | null>(null);
    const [personalRoadmap, setPersonalRoadmap] = useState<Roadmap | null>(null);
    const [activeTab, setActiveTab] = useState<'personal' | 'full'>('personal');
    const [roadmapStatus, setRoadmapStatus] = useState<any>(null);
    const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [genType, setGenType] = useState<'personal' | 'full'>('personal');
    const [showChat, setShowChat] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        } else if (userId) {
            loadRoadmap();
        }
    }, [user, authLoading, userId]);

    const loadRoadmap = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const result = await api.getCurrentRoadmapStatus(String(userId));
            setRoadmapStatus(result);
            if (result.has_active_roadmap) {
                setFullRoadmap(result.full_path);
                setPersonalRoadmap(result.personal_path);

                // Determine which one to show
                const active = result.personal_path || result.full_path || result.latest;
                if (active) {
                    setActiveTab(active.roadmap_type);
                    const next = active.milestones.find((m: Milestone) => m.progress.status !== 'completed') || active.milestones[0];
                    setActiveMilestone(next);
                }
            }
        } catch (error) {
            console.error('Failed to load roadmap:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleTab = (tab: 'personal' | 'full') => {
        const r = tab === 'personal' ? personalRoadmap : fullRoadmap;
        if (r) {
            setActiveTab(tab);
            const next = r.milestones.find(m => m.progress.status !== 'completed') || r.milestones[0];
            setActiveMilestone(next);
        } else {
            // If roadmap doesn't exist, trigger generation
            generateRoadmap(tab);
        }
    };

    const roadmap = activeTab === 'personal' ? personalRoadmap : fullRoadmap;

    const generateRoadmap = async (type: 'personal' | 'full') => {
        if (!userId) return;
        setIsGenerating(true);
        setGenType(type);
        try {
            // Priority: 1. User Profile Role, 2. Roadmap Status Role (if not SW Engineer), 3. AI/ML Engineer default
            const targetRole = user?.target_role ||
                (roadmapStatus?.target_role !== "Software Engineer" ? roadmapStatus?.target_role : null) ||
                "AI/ML Engineer";

            console.log(`Generating ${type} roadmap for role: ${targetRole}`);

            await api.generateRoadmap({
                user_id: userId,
                target_role: targetRole,
                roadmap_type: type,
                language: "English"
            });
            await loadRoadmap();
        } catch (error) {
            console.error('Failed to generate roadmap:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-gray-400 font-medium animate-pulse">Building your learning path...</p>
            </div>
        );
    }

    if (!roadmap) {
        return (
            <div className="max-w-4xl mx-auto py-12 px-6">
                <div className="text-center space-y-6 mb-12">
                    <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-4xl shadow-sm border border-blue-100 mx-auto">
                        🚀
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                            Personalized Path to <span className="text-blue-600">Mastery</span>
                        </h1>
                        <p className="text-gray-500 font-medium max-w-xl mx-auto text-lg">
                            Ready to level up? Choose how you want to build your roadmap. We'll find the best resources and guide you with AI.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Personalized Option */}
                    <div className="group relative p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300">
                        <div className="absolute -top-4 -right-4 bg-blue-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg transform group-hover:scale-110 transition-transform">
                            RECOMMENDED
                        </div>
                        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                            <BrainCircuit size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">Gap-Filler Path</h3>
                        <p className="text-gray-500 text-sm leading-relaxed mb-8">
                            Analyzes your current skills and creates a path to bridge the gap to your target role. Efficiency focused.
                        </p>
                        <button
                            onClick={() => generateRoadmap('personal')}
                            disabled={isGenerating}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                        >
                            {isGenerating && genType === 'personal' ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                            Generate Gap-Filler Path
                        </button>
                    </div>

                    {/* Full Option */}
                    <div className="group p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-gray-200 transition-all duration-300">
                        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 mb-6 group-hover:bg-gray-900 group-hover:text-white transition-colors duration-300">
                            <Map size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">0-to-Mastery Path</h3>
                        <p className="text-gray-500 text-sm leading-relaxed mb-8">
                            A comprehensive roadmap covering everything needed for the role, from basics to expert level.
                        </p>
                        <button
                            onClick={() => generateRoadmap('full')}
                            disabled={isGenerating}
                            className="w-full py-4 bg-white text-gray-900 border-2 border-gray-100 rounded-2xl font-bold text-xs uppercase tracking-widest hover:border-gray-900 transition-all flex items-center justify-center gap-2"
                        >
                            {isGenerating && genType === 'full' ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                            Generate 0-to-Mastery Path
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                            <BrainCircuit size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 tracking-tight">{roadmap?.title || "Mastery Path"}</h1>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 px-1">
                                <span className="uppercase tracking-widest underline decoration-blue-500/30 underline-offset-4">{activeTab === 'personal' ? 'Gap-Filler' : '0-to-Mastery'} PATH</span>
                                <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                                <span className="uppercase tracking-widest">{roadmap?.milestones.length || 0} MILESTONES</span>
                                <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                                <span className="text-blue-600 uppercase tracking-widest">{roadmap?.overall_readiness || 0}% READY</span>
                            </div>
                        </div>
                    </div>

                    {/* Trending Highlights */}
                    {roadmap?.trending_highlights && roadmap.trending_highlights.length > 0 && (
                        <div className="hidden xl:flex items-center gap-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Trending:</span>
                            <div className="flex gap-1.5">
                                {roadmap.trending_highlights.slice(0, 3).map((skill: string, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-[9px] font-black uppercase tracking-tighter border border-amber-100 flex items-center gap-1">
                                        <Zap size={10} fill="currentColor" />
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Switcher Tabs */}
                    <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100 items-center">
                        <button
                            onClick={() => toggleTab('personal')}
                            disabled={isGenerating}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'personal'
                                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Sparkles size={12} />
                                {!personalRoadmap ? '✨ Generate Gap-Filler' : 'Gap-Filler'}
                            </div>
                        </button>
                        <button
                            onClick={() => toggleTab('full')}
                            disabled={isGenerating}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'full'
                                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Zap size={12} />
                                {!fullRoadmap ? '✨ Generate 0-to-Mastery' : '0-to-Mastery'}
                            </div>
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowChat(!showChat)}
                            className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 font-bold text-[10px] uppercase tracking-wider ${showChat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-100 hover:border-blue-200'
                                }`}
                        >
                            <MessageSquare size={16} />
                            {showChat ? 'Hide Tutor' : 'Ask AI Tutor'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Player Area */}
                <div className="lg:col-span-8 space-y-6">
                    {activeMilestone ? (
                        <>
                            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                                <YouTubePlayer
                                    videoId={activeMilestone.current_video_id || ''}
                                    userId={userId!}
                                    milestoneId={activeMilestone.id}
                                    playlistId={activeMilestone.youtube_playlist_id}
                                    initialTime={activeMilestone.current_video_time}
                                    onProgressUpdate={(p) => {
                                        // Update local state for immediate feedback
                                        const setter = activeTab === 'personal' ? setPersonalRoadmap : setFullRoadmap;
                                        setter(prev => {
                                            if (!prev) return null;
                                            return {
                                                ...prev,
                                                milestones: prev.milestones.map(m =>
                                                    m.id === activeMilestone.id
                                                        ? { ...m, progress: { ...m.progress, watched_duration_seconds: (p / 100) * (m.progress.total_duration_seconds || 100) } }
                                                        : m
                                                )
                                            };
                                        });
                                    }}
                                />
                                <div className="p-8">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                                    Active Milestone
                                                </div>
                                                <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${activeMilestone.difficulty === 'beginner' ? 'bg-green-50 text-green-600' : activeMilestone.difficulty === 'intermediate' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'}`}>
                                                    {activeMilestone.difficulty || 'intermediate'}
                                                </div>
                                            </div>
                                            <h2 className="text-2xl font-black text-gray-900">{activeMilestone.name}</h2>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Estimated</div>
                                            <div className="flex items-center gap-1.5 text-gray-900 font-bold">
                                                <Clock size={16} className="text-blue-500" />
                                                {activeMilestone.estimatedWeeks || 1} Weeks
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-gray-500 font-medium leading-relaxed mb-8">
                                        {activeMilestone.description}
                                    </p>
                                    {/* Skills list */}
                                    <div className="flex flex-wrap gap-2 mb-8">
                                        {activeMilestone.skills.map((skill, i) => (
                                            <span key={i} className="px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-[11px] font-bold border border-gray-100 flex items-center gap-1.5">
                                                {roadmap?.trending_highlights?.includes(skill.toLowerCase()) && <Zap size={10} className="text-amber-500" fill="currentColor" />}
                                                {skill}
                                            </span>
                                        ))}
                                    </div>

                                    {/* NEW: Multi-Resource Section */}
                                    {activeMilestone.resources && activeMilestone.resources.length > 0 && (
                                        <div className="mt-8 pt-8 border-t border-gray-100">
                                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                                                <Layers size={16} className="text-blue-600" />
                                                Recommended Mastery Paths
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {activeMilestone.resources.map((res: any, idx: number) => {
                                                    const isCurrent = activeMilestone.youtube_playlist_id === res.url;
                                                    return (
                                                        <div
                                                            key={idx}
                                                            onClick={() => {
                                                                // 1. Update active milestone immediately for UI responsiveness
                                                                setActiveMilestone({
                                                                    ...activeMilestone,
                                                                    youtube_playlist_id: res.url,
                                                                    current_video_id: '',
                                                                    current_video_time: 0
                                                                });

                                                                // 2. Persist in the roadmap list state
                                                                const setter = activeTab === 'personal' ? setPersonalRoadmap : setFullRoadmap;
                                                                setter(prev => {
                                                                    if (!prev) return null;
                                                                    return {
                                                                        ...prev,
                                                                        milestones: prev.milestones.map(m =>
                                                                            m.id === activeMilestone.id
                                                                                ? {
                                                                                    ...m,
                                                                                    youtube_playlist_id: res.url,
                                                                                    current_video_id: '',
                                                                                    current_video_time: 0
                                                                                }
                                                                                : m
                                                                        )
                                                                    };
                                                                });
                                                            }}
                                                            className={`p-4 rounded-2xl border transition-all cursor-pointer group hover:shadow-md ${isCurrent ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100'}`}
                                                        >
                                                            <div className="flex gap-4">
                                                                <div className="relative w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                                                    <img src={res.thumbnail} alt={res.title} className="w-full h-full object-cover" />
                                                                    <div className={`absolute inset-0 flex items-center justify-center bg-black/40 ${isCurrent ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 transition-opacity`}>
                                                                        <Play size={20} className="text-white fill-current" />
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter mb-1">{res.platform || 'YouTube'}</p>
                                                                    <h4 className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight mb-1">{res.title}</h4>
                                                                    {isCurrent && (
                                                                        <div className="flex items-center gap-1 text-green-600">
                                                                            <CheckCircle2 size={10} />
                                                                            <span className="text-[9px] font-bold">Currently Studying</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {!(activeMilestone.resources && activeMilestone.resources.length > 0) && (
                                        <div className="mt-10 p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-center">
                                            <p className="text-xs font-bold text-blue-800 mb-2">💡 Upgrade Available</p>
                                            <p className="text-[10px] text-blue-600 font-medium leading-relaxed">
                                                This roadmap was generated before multi-resource support.
                                                <button
                                                    onClick={() => generateRoadmap(activeTab)}
                                                    className="underline ml-1 font-black hover:text-blue-800"
                                                >
                                                    Regenerate now
                                                </button> to see 2-3 expert playlists per milestone!
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Chat Integration */}
                            {showChat && (
                                <RoadmapChat
                                    userId={userId!}
                                    milestoneId={activeMilestone.id}
                                    milestoneName={activeMilestone.name}
                                />
                            )}
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-[500px] bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400">
                            <p className="font-bold">Select a milestone to start learning</p>
                        </div>
                    )}
                </div>

                {/* Sidebar Milestones */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Milestones</h3>
                            <button className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1">
                                <History size={12} />
                                Timeline
                            </button>
                        </div>
                        <div className="space-y-3">
                            {roadmap.milestones.map((milestone, idx) => {
                                const isActive = activeMilestone?.id === milestone.id;
                                const isCompleted = milestone.progress.status === 'completed';

                                return (
                                    <button
                                        key={milestone.id}
                                        onClick={() => setActiveMilestone(milestone)}
                                        className={`w-full p-4 rounded-2xl border text-left transition-all duration-300 group ${isActive
                                            ? 'bg-blue-600 border-blue-600 shadow-blue-200 shadow-lg'
                                            : 'bg-white border-gray-100 hover:border-blue-200'
                                            }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={`mt-1 p-2 rounded-xl transition-colors ${isActive ? 'bg-white text-blue-600' : isCompleted ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
                                                }`}>
                                                {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                                    <h4 className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-gray-900'}`}>
                                                        {milestone.name}
                                                    </h4>
                                                    <span className={`text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-gray-50 text-gray-400'}`}>
                                                        {milestone.difficulty || 'int'}
                                                    </span>
                                                </div>
                                                <div className={`mt-1 flex items-center gap-2 text-[10px] font-bold ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
                                                    <span>{milestone.skills.length} skills</span>
                                                    <span className="w-0.5 h-0.5 bg-current opacity-30 rounded-full"></span>
                                                    <span className="uppercase">{milestone.estimatedWeeks || 1}w</span>
                                                </div>

                                                {/* Mini progress bar */}
                                                {!isCompleted && milestone.progress.watched_duration_seconds > 0 && (
                                                    <div className="mt-2 h-1 bg-black/10 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${isActive ? 'bg-white' : 'bg-blue-500'}`}
                                                            style={{ width: `${Math.min(100, (milestone.progress.watched_duration_seconds / (milestone.progress.total_duration_seconds || 100)) * 100)}%` }}
                                                        ></div>
                                                    </div>
                                                )}
                                            </div>
                                            {!isActive && !isCompleted && (
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ChevronRight size={16} className="text-gray-300" />
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-50">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">Total Progress</span>
                                <span className="text-xs font-black text-blue-600">
                                    {Math.round((roadmap.milestones.filter(m => m.progress.status === 'completed').length / roadmap.milestones.length) * 100)}%
                                </span>
                            </div>
                            <div className="h-3 bg-gray-50 rounded-full overflow-hidden p-0.5 border border-gray-100">
                                <div
                                    className="h-full bg-blue-600 rounded-full shadow-lg shadow-blue-200 transition-all duration-1000"
                                    style={{ width: `${(roadmap.milestones.filter(m => m.progress.status === 'completed').length / roadmap.milestones.length) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Overall Progress Gauge */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Readiness Score</h3>
                            <div className="text-xs font-black text-blue-600">{roadmap?.overall_readiness || 0}%</div>
                        </div>
                        <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden mb-3">
                            <div
                                className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)] transition-all duration-1000"
                                style={{ width: `${roadmap?.overall_readiness || 0}%` }}
                            ></div>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                            This score represents your current readiness for the **{roadmap?.target_role}** role based on your knowledge base.
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-3xl p-6 text-white shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-white/10 rounded-xl">
                                <Award size={20} className="text-blue-200" />
                            </div>
                            <h3 className="font-bold">Next Milestone</h3>
                        </div>
                        <p className="text-blue-100 text-sm font-medium mb-6">
                            Complete this roadmap to earn a "Verified {roadmap.target_role}" profile badge.
                        </p>
                        <button className="w-full py-3 bg-white text-indigo-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-colors">
                            Claim Reward
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
}


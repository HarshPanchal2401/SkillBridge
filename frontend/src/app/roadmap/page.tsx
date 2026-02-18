'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { MainLayout } from '@/components/layout/Sidebar';
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
    Flag
} from 'lucide-react';

interface Milestone {
    id: string;
    name: string;
    description: string;
    order: number;
    estimatedWeeks: number;
    prerequisites?: string[];
    skills: string[];
    courses: Array<{ name: string; platform: string; url: string }>;
    progress: {
        status: 'not_started' | 'in_progress' | 'completed';
        started_at: string | null;
        completed_at: string | null;
    };
    skillCompletion: number;
    skillDetails: Array<{ name: string; hasSkill: boolean; proficiency: number }>;
}

interface Roadmap {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    estimatedDuration: string;
    milestones: Milestone[];
}

interface RoadmapSummary {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    estimatedDuration: string;
    totalMilestones: number;
}

export default function RoadmapPage() {
    const { user, loading: authLoading, userId } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [hasRoadmap, setHasRoadmap] = useState(false);
    const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
    const [overallProgress, setOverallProgress] = useState(0);
    const [completedMilestones, setCompletedMilestones] = useState(0);
    const [totalMilestones, setTotalMilestones] = useState(0);
    const [availableRoadmaps, setAvailableRoadmaps] = useState<RoadmapSummary[]>([]);
    const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
    const [updatingMilestone, setUpdatingMilestone] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        } else if (userId) {
            loadUserRoadmap();
        }
    }, [user, authLoading, userId]);

    const loadUserRoadmap = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const result = await api.getUserRoadmap(userId);
            if (result.has_roadmap) {
                setHasRoadmap(true);
                setRoadmap(result.roadmap);
                setOverallProgress(result.overall_progress);
                setCompletedMilestones(result.completed_milestones);
                setTotalMilestones(result.total_milestones);
            } else {
                setHasRoadmap(false);
                const roadmapsResult = await api.getRoadmaps();
                setAvailableRoadmaps(roadmapsResult.roadmaps || []);
            }
        } catch (error) {
            console.error('Failed to load roadmap:', error);
            try {
                const roadmapsResult = await api.getRoadmaps();
                setAvailableRoadmaps(roadmapsResult.roadmaps || []);
            } catch (e) {
                console.error('Failed to load available roadmaps:', e);
            }
        } finally {
            setLoading(false);
        }
    };

    const selectRoadmap = async (domain: string) => {
        if (!userId) return;
        setLoading(true);
        try {
            await api.selectRoadmap(userId, domain);
            await loadUserRoadmap();
        } catch (error) {
            console.error('Failed to select roadmap:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateMilestoneStatus = async (milestoneId: string, status: string) => {
        if (!userId) return;
        setUpdatingMilestone(milestoneId);
        try {
            await api.updateMilestoneProgress(userId, milestoneId, status);
            await loadUserRoadmap();
        } catch (error) {
            console.error('Failed to update milestone:', error);
        } finally {
            setUpdatingMilestone(null);
        }
    };

    const isMilestoneLocked = (milestone: Milestone, milestones: Milestone[]) => {
        if (!milestone.prerequisites || milestone.prerequisites.length === 0) return false;
        return milestone.prerequisites.some(prereqId => {
            const prereq = milestones.find(m => m.id === prereqId);
            return prereq && prereq.progress.status !== 'completed';
        });
    };

    if (authLoading || loading) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-emerald-100 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-gray-500 font-medium animate-pulse text-lg">Charting your career path...</p>
                </div>
            </MainLayout>
        );
    }

    if (!hasRoadmap) {
        return (
            <MainLayout>
                <div className="max-w-6xl mx-auto space-y-12 pb-12 animate-fade-in px-4">
                    <div className="text-center space-y-6 max-w-3xl mx-auto py-12">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full text-sm font-semibold shadow-sm">
                            <Map size={14} />
                            Strategic Career Paths
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 leading-tight tracking-tight">
                            Design Your <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Professional Future</span>
                        </h1>
                        <p className="text-lg text-gray-500 leading-relaxed">
                            Choose a verified roadmap to guide your learning journey. Our AI tailors each path to market demands and your existing strengths.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {availableRoadmaps.map((rm) => (
                            <div
                                key={rm.id}
                                className="group relative bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden"
                                onClick={() => selectRoadmap(rm.id)}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16 group-hover:bg-emerald-50 transition-colors duration-500"></div>

                                <div className="relative space-y-6">
                                    <div
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner"
                                        style={{ backgroundColor: rm.color + '15' }}
                                    >
                                        {rm.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">{rm.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Clock size={14} className="text-gray-400" />
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{rm.estimatedDuration}</span>
                                        </div>
                                    </div>
                                    <p className="text-gray-500 text-sm leading-relaxed">{rm.description}</p>

                                    <div className="pt-4 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <Target size={16} className="text-emerald-500" />
                                            <span className="text-xs font-black text-gray-900">{rm.totalMilestones} Milestones</span>
                                        </div>
                                        <button className="flex items-center gap-2 py-3 px-6 bg-gray-900 text-white text-xs font-black rounded-2xl uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg group-hover:scale-105 active:scale-95">
                                            Begin Path
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-10 pb-12 animate-fade-in px-4 md:px-6">

                {/* Roadmap Header & Progress Hero */}
                <div className="relative bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-gray-100 overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-50 rounded-full mix-blend-multiply filter blur-3xl opacity-40 -mr-20 -mt-20"></div>

                    <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div
                                className="w-20 h-20 rounded-[2rem] flex items-center justify-center text-4xl shadow-2xl relative group"
                                style={{ backgroundColor: (roadmap?.color || '#10b981') + '15' }}
                            >
                                <div className="absolute inset-0 bg-white/20 blur-xl animate-pulse"></div>
                                <span className="relative">{roadmap?.icon || '📊'}</span>
                            </div>
                            <div className="space-y-2">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    <Sparkles size={12} />
                                    Active Roadmap
                                </div>
                                <h1 className="text-4xl font-black text-gray-900 tracking-tight">{roadmap?.name}</h1>
                                <p className="text-gray-500 max-w-md font-medium">{roadmap?.description}</p>
                            </div>
                        </div>

                        {/* High Fidelity Progress Gauge */}
                        <div className="relative flex flex-col items-center md:items-end justify-center">
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-5xl font-black text-gray-900 tracking-tighter">{overallProgress}%</span>
                                <span className="text-xs font-black text-emerald-600 uppercase tracking-widest pb-2">Mastery</span>
                            </div>
                            <div className="w-56 md:w-64 h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100 p-0.5">
                                <div
                                    className="h-full rounded-full transition-all duration-[2000ms] shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                    style={{
                                        width: `${overallProgress}%`,
                                        backgroundColor: roadmap?.color || '#10b981',
                                    }}
                                />
                            </div>
                            <p className="mt-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                {completedMilestones} of {totalMilestones} Milestones Completed
                            </p>
                        </div>
                    </div>

                    {/* Floating Change Button */}
                    <button
                        onClick={async () => {
                            if (userId) {
                                await api.removeUserRoadmap(userId);
                                setHasRoadmap(false);
                                loadUserRoadmap();
                            }
                        }}
                        className="absolute top-8 right-8 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                        Change Path
                    </button>
                </div>

                {/* Progressive Journey Timeline */}
                <div className="relative space-y-12 pl-4 py-8">
                    {/* Vertical Journey Line */}
                    <div className="absolute left-10 top-0 w-1 h-full bg-gray-100 rounded-full">
                        <div
                            className="absolute top-0 left-0 w-full transition-all duration-[1500ms] ease-in-out bg-emerald-500 rounded-full"
                            style={{ height: `${overallProgress}%` }}
                        />
                    </div>

                    {roadmap?.milestones.map((milestone, index) => {
                        const locked = isMilestoneLocked(milestone, roadmap.milestones);
                        const isExpanded = expandedMilestone === milestone.id;
                        const isCompleted = milestone.progress.status === 'completed';
                        const isCurrent = milestone.progress.status === 'in_progress';

                        return (
                            <div key={milestone.id} className={`relative pl-16 group transition-all duration-500 ${locked ? 'opacity-40 grayscale' : ''}`}>

                                {/* Milestone Point Indicator */}
                                <div className={`absolute left-0 top-6 w-12 h-12 rounded-[1.25rem] flex items-center justify-center -ml-6 z-10 
                                    transition-all duration-500 border-4 border-white shadow-xl
                                    ${isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-blue-500 animate-pulse' : locked ? 'bg-gray-200' : 'bg-white text-gray-400 border-gray-100'}`}
                                >
                                    {isCompleted ? (
                                        <CheckCircle2 className="text-white" size={24} />
                                    ) : locked ? (
                                        <Lock size={18} className="text-gray-400" />
                                    ) : isCurrent ? (
                                        <Zap className="text-white fill-white" size={20} />
                                    ) : (
                                        <span className="font-black text-lg">{index + 1}</span>
                                    )}
                                </div>

                                {/* Milestone Card */}
                                <div
                                    className={`bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden
                                        ${isExpanded ? 'shadow-2xl ring-2 ring-emerald-500/10' : 'shadow-sm border-gray-100 hover:shadow-xl hover:border-emerald-200 hover:-translate-y-1'}`}
                                >
                                    {/* Header Section */}
                                    <div
                                        className={`p-8 cursor-pointer relative ${isExpanded ? 'bg-emerald-50/20' : ''}`}
                                        onClick={() => !locked && setExpandedMilestone(isExpanded ? null : milestone.id)}
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-emerald-600 transition-colors uppercase">
                                                        {milestone.name}
                                                    </h3>
                                                    {isCompleted && (
                                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest rounded-full border border-emerald-100">
                                                            Mastered
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-gray-500 font-medium leading-relaxed max-w-2xl">
                                                    {milestone.description}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-4 flex-wrap">
                                                <div className="flex items-center gap-4 px-6 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                                                    <div className="text-center">
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Duration</p>
                                                        <p className="text-sm font-black text-gray-900">{milestone.estimatedWeeks}w</p>
                                                    </div>
                                                    <div className="w-px h-6 bg-gray-200"></div>
                                                    <div className="text-center">
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Skills</p>
                                                        <p className="text-sm font-black text-gray-900">{milestone.skills.length}</p>
                                                    </div>
                                                </div>
                                                <div className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-emerald-100 text-emerald-600' : 'text-gray-300'}`}>
                                                    {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Progress Bar (only if in progress) */}
                                        {isCurrent && (
                                            <div className="mt-8 h-2 bg-gray-100 rounded-full overflow-hidden p-0.5">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-sm"
                                                    style={{ width: `${milestone.skillCompletion}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Expanded Detail View */}
                                    {isExpanded && (
                                        <div className="px-8 pb-8 space-y-10 animate-fade-in">

                                            {/* Skills Grid */}
                                            <div className="pt-6">
                                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                    <Award size={14} className="text-emerald-500" />
                                                    Competency Framework
                                                </h4>
                                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {milestone.skillDetails.map((skill, i) => (
                                                        <div
                                                            key={i}
                                                            className={`p-4 rounded-2xl border transition-all flex items-center justify-between group/skill
                                                                ${skill.hasSkill ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${skill.hasSkill ? 'bg-white shadow-sm' : 'bg-gray-100'}`}>
                                                                    {skill.hasSkill ? <CheckCircle2 className="text-emerald-500" size={16} /> : <Circle className="text-gray-300" size={16} />}
                                                                </div>
                                                                <span className="text-xs font-bold text-gray-900">{skill.name}</span>
                                                            </div>
                                                            {skill.hasSkill && (
                                                                <span className="text-[10px] font-black text-emerald-600 bg-white px-2 py-0.5 rounded-lg">
                                                                    {skill.proficiency}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Learning Resources */}
                                            {milestone.courses && milestone.courses.length > 0 && (
                                                <div className="space-y-4">
                                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <BookOpen size={14} className="text-blue-500" />
                                                        Curated Educational Resources
                                                    </h4>
                                                    <div className="grid md:grid-cols-2 gap-4">
                                                        {milestone.courses.map((course, i) => (
                                                            <a
                                                                key={i}
                                                                href={course.url}
                                                                target="_blank"
                                                                className="group/course flex items-center justify-between p-5 rounded-2xl bg-white border border-gray-100 hover:border-blue-500 hover:shadow-2xl hover:-translate-y-1 transition-all"
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center group-hover/course:bg-blue-50 group-hover/course:text-blue-500 transition-colors">
                                                                        <BookOpen size={20} />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-black text-gray-900 mb-1 line-clamp-1">{course.name}</p>
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{course.platform || 'Top rated'}</span>
                                                                    </div>
                                                                </div>
                                                                <ArrowUpRight className="text-gray-300 group-hover/course:text-blue-500 group-hover/course:translate-x-1 group-hover/course:-translate-y-1 transition-all" size={18} />
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action Control */}
                                            <div className="pt-6 flex items-center gap-4">
                                                {!isCompleted ? (
                                                    <button
                                                        onClick={() => updateMilestoneStatus(milestone.id, isCurrent ? 'completed' : 'in_progress')}
                                                        disabled={updatingMilestone === milestone.id}
                                                        className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-xl active:scale-95 disabled:opacity-50
                                                            ${isCurrent ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                                                    >
                                                        {updatingMilestone === milestone.id ? (
                                                            <Sparkles className="animate-pulse" size={16} />
                                                        ) : isCurrent ? (
                                                            <Flag size={16} />
                                                        ) : (
                                                            <Play size={16} fill="white" />
                                                        )}
                                                        {updatingMilestone === milestone.id ? 'Updating Path...' : isCurrent ? 'Finalize Mastery' : 'Activate Milestone'}
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 font-bold text-xs uppercase tracking-widest">
                                                        <Star size={16} className="fill-emerald-500" />
                                                        Assessment Cleared
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Final Goal Reach */}
                <div className={`mt-16 bg-gradient-to-r from-gray-900 to-emerald-950 rounded-[3rem] p-12 text-white relative overflow-hidden group 
                    ${overallProgress === 100 ? 'opacity-100 visible' : 'opacity-20 pointer-events-none'}`}>
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Flag size={120} />
                    </div>
                    <div className="relative text-center max-w-2xl mx-auto space-y-6">
                        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/50">
                            <Star className="text-emerald-400 fill-emerald-400" size={40} />
                        </div>
                        <h2 className="text-4xl font-black tracking-tight leading-tight uppercase">Journey Completed</h2>
                        <p className="text-gray-400 font-medium leading-relaxed">
                            Career mastery achieved. You've verified all skills required for the {roadmap?.name} path.
                        </p>
                        <button
                            onClick={() => router.push('/recommendations')}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-gray-100 transition-all shadow-2xl"
                        >
                            Explore Advanced Modules
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>

            </div>
        </MainLayout>
    );
}

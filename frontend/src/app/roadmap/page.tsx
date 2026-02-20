'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
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
            <>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
                    <p className="text-gray-400 text-sm animate-pulse">Charting your path...</p>
                </div>
            </>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in py-12">
            <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-4xl shadow-sm border border-amber-100">
                🚀
            </div>
            <div className="space-y-3 max-w-lg">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-amber-100">
                    <Sparkles size={12} />
                    Feature in Development
                </div>
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                    Roadmaps are Coming Soon
                </h1>
                <p className="text-gray-500 leading-relaxed font-medium">
                    We're building an advanced, AI-powered career sequence engine to guide you through every milestone. Stay tuned as we finalize the precision mapping for your professional growth.
                </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="px-8 py-3.5 bg-gray-900 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg flex items-center gap-2"
                >
                    Back to Dashboard
                </button>
                <button
                    onClick={() => router.push('/recommendations')}
                    className="px-8 py-3.5 bg-white text-gray-900 border border-gray-100 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2"
                >
                    Explore Training
                    <ArrowRight size={14} className="text-gray-400" />
                </button>
            </div>

            {/* Hidden Roadmap Content for Developer Reference (Keep logic for future use) */}
            <div className="hidden">
                {/* Existing logic and state preserved above this return */}
            </div>
        </div>
    );
}


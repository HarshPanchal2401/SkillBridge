'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { MainLayout } from '@/components/layout/Sidebar';
import {
    BookOpen,
    ExternalLink,
    Clock,
    Search,
    Star,
    AlertCircle,
    RefreshCw,
    Sparkles,
    PlayCircle,
    ChevronRight,
    ArrowUpRight,
    Zap,
    Trophy
} from 'lucide-react';

interface CourseRecommendation {
    skill: string;
    gap_priority?: string;
    courses: Array<{
        title?: string;
        course_name?: string;
        platform: string;
        url: string;
        rating?: number;
        duration?: string;
        description?: string;
        cost?: string;
    }>;
}

export default function RecommendationsPage() {
    const { user, loading: authLoading, userId } = useAuth();
    const router = useRouter();
    const [recommendations, setRecommendations] = useState<CourseRecommendation[]>([]);
    const [searchSkill, setSearchSkill] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSkills, setHasSkills] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        } else if (userId) {
            loadRecommendations();
        }
    }, [user, authLoading, userId]);

    const loadRecommendations = async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const skills = await api.getUserSkills(userId).catch(() => []);
            if (!skills || skills.length === 0) {
                setHasSkills(false);
                setLoading(false);
                return;
            }
            setHasSkills(true);

            const result = await api.getGapBasedCourses(userId);
            const recs: CourseRecommendation[] = [];
            const recsData = result.recommendations || [];

            for (const item of recsData) {
                if (item.courses && item.courses.length > 0) {
                    recs.push({
                        skill: item.skill || 'General',
                        gap_priority: item.gap_priority,
                        courses: item.courses,
                    });
                }
            }

            setRecommendations(recs);
        } catch (err: any) {
            console.error('Failed to load recommendations:', err);
            setError(err.message || 'Failed to connect to recommendation engine');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchSkill.trim()) return;
        setSearching(true);
        try {
            const result = await api.searchCoursesForSkill(searchSkill.trim());
            setSearchResults(result.courses || []);
        } catch (err) {
            console.error('Failed to search courses:', err);
        } finally {
            setSearching(false);
        }
    };

    if (authLoading || loading) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-orange-100 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-gray-500 font-medium animate-pulse text-lg">Scouring platforms for the best content...</p>
                </div>
            </MainLayout>
        );
    }

    if (!hasSkills) {
        return (
            <MainLayout>
                <div className="max-w-4xl mx-auto space-y-12 py-12 px-4 animate-fade-in">
                    <div className="text-center space-y-6">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-50 border border-orange-100 text-orange-700 rounded-full text-sm font-semibold shadow-sm">
                            <Sparkles size={14} />
                            Skill Discovery Required
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
                            Personalize Your <span className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">Learning Path</span>
                        </h1>
                        <p className="text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
                            To provide accurate course suggestions, we need to understand your current skill profile first.
                        </p>
                        <button
                            onClick={() => router.push('/profile')}
                            className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-gray-800 transition-all shadow-xl active:scale-95 flex items-center gap-3 mx-auto"
                        >
                            Sync Skills
                            <ArrowUpRight size={18} />
                        </button>
                    </div>

                    <SearchBox
                        searchSkill={searchSkill}
                        setSearchSkill={setSearchSkill}
                        handleSearch={handleSearch}
                        searching={searching}
                        searchResults={searchResults}
                    />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-10 pb-12 animate-fade-in px-4 md:px-6">

                {/* Recommendations Header */}
                <div className="relative bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-gray-100 overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-orange-50 rounded-full mix-blend-multiply filter blur-3xl opacity-40 -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-50 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -ml-20 -mb-20"></div>

                    <div className="relative flex flex-col lg:flex-row items-center justify-between gap-12">
                        <div className="flex-1 space-y-6 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-50 border border-orange-100 text-orange-700 rounded-full text-sm font-semibold shadow-sm">
                                <Trophy size={14} />
                                Curated Mastery
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight tracking-tight">
                                Intelligence-Driven <span className="bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent">Skill Acquisition</span>
                            </h1>
                            <p className="text-lg text-gray-500 max-w-xl leading-relaxed">
                                Our engine scanned top platforms to find the most efficient modules for closing your critical market gaps.
                            </p>
                            <button
                                onClick={loadRecommendations}
                                className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-gray-800 active:scale-95 transition-all flex items-center gap-2 group shadow-lg mx-auto lg:mx-0"
                            >
                                <RefreshCw size={18} />
                                Re-analyze Gaps
                            </button>
                        </div>

                        {/* Quick Stats Widget */}
                        <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/60 shadow-xl w-full max-w-sm">
                            <h3 className="text-xs font-black text-orange-600 uppercase tracking-widest mb-6">Learning Snapshot</h3>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-600">Active Gaps Found</span>
                                    <span className="text-xl font-black text-gray-900">{recommendations.length}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-600">Critical Priority</span>
                                    <span className="text-xl font-black text-red-600">{recommendations.filter(r => r.gap_priority === 'critical').length}</span>
                                </div>
                                <div className="pt-4 border-t border-gray-100">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-xl">
                                        <Zap className="text-orange-500" size={14} />
                                        <span className="text-[10px] font-black text-orange-700 uppercase">Top Recommend Platform: Udemy</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <SearchBox
                    searchSkill={searchSkill}
                    setSearchSkill={setSearchSkill}
                    handleSearch={handleSearch}
                    searching={searching}
                    searchResults={searchResults}
                />

                {recommendations.length > 0 ? (
                    <div className="space-y-12">
                        {recommendations.map((rec, idx) => (
                            <div key={idx} className="space-y-6">
                                <div className="flex items-center justify-between px-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg
                                            ${rec.gap_priority === 'critical' ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-gray-900 to-gray-700'}`}>
                                            <BookOpen className="text-white" size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">{rec.skill}</h2>
                                                {rec.gap_priority === 'critical' && (
                                                    <span className="px-2.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-widest rounded-full border border-red-200">
                                                        Urgent Gap
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 font-medium">Verified curated learning blocks</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {rec.courses.map((course, cidx) => (
                                        <CourseCard key={cidx} course={course} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : !error && (
                    <div className="bg-white rounded-[3rem] p-16 text-center shadow-sm border border-gray-100 space-y-6">
                        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
                            <Star className="text-green-500 fill-green-500" size={40} />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Perfect Alignment</h3>
                        <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
                            Excellent work! You currently have no identified skill gaps for your target role. Continue expanding your horizontal skills below.
                        </p>
                        <button
                            onClick={() => router.push('/roadmap')}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-gray-800 transition-all shadow-xl"
                        >
                            View Career Roadmaps
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}

function SearchBox({ searchSkill, setSearchSkill, handleSearch, searching, searchResults }: any) {
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] p-4 pr-4 pl-8 shadow-sm border border-gray-100 flex items-center gap-4 group focus-within:shadow-2xl transition-all duration-500">
                <Search className="text-gray-300 group-focus-within:text-orange-500 transition-colors" size={24} />
                <input
                    type="text"
                    value={searchSkill}
                    onChange={(e) => setSearchSkill(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1 py-4 bg-transparent outline-none text-gray-900 font-bold placeholder:font-medium placeholder:text-gray-300"
                    placeholder="Search specific skill nodes (e.g. Distributed Systems, Tailwind, PyTorch)"
                />
                <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="px-8 py-4 bg-gray-900 text-white rounded-[1.75rem] font-black text-[10px] uppercase tracking-widest hover:bg-gray-800 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                    {searching ? 'Querying...' : 'Discovery'}
                </button>
            </div>

            {searchResults.length > 0 && (
                <div className="w-full animate-fade-in z-10">
                    <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-orange-100 shadow-[0_20px_50px_rgba(251,146,60,0.1)]">
                        <div className="flex items-center justify-between mb-8 px-4">
                            <h3 className="text-lg font-black text-gray-900 tracking-tight uppercase">Search results for "{searchSkill}"</h3>
                            <button onClick={() => setSearchResults([])} className="text-[10px] font-black uppercase text-gray-400 hover:text-red-500">Clear Search</button>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {searchResults.map((course, idx: number) => (
                                <CourseCard key={idx} course={course} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const PLATFORM_CONFIG: Record<string, { color: string; icon: string }> = {
    'Coursera': { color: '#0056D2', icon: '💎' },
    'edX': { color: '#02262B', icon: '🏛️' },
    'Udemy': { color: '#A435F0', icon: '🎬' },
    'LinkedIn Learning': { color: '#0077B5', icon: '🔗' },
    'Udacity': { color: '#02B3E4', icon: '🛸' },
    'Pluralsight': { color: '#F15B2A', icon: '🛠️' },
    'Skillshare': { color: '#00FF84', icon: '🎨' },
    'Unknown': { color: '#6B7280', icon: '📖' },
};

function CourseCard({ course }: { course: any }) {
    const platform = course.platform || 'Unknown';
    const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG['Unknown'];
    const title = course.course_name || course.title || 'Course Module';

    return (
        <div className="group/card bg-white rounded-[2rem] border border-gray-100 hover:border-orange-200 shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col h-full overflow-hidden">
            <div className="p-8 pb-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner"
                            style={{ backgroundColor: config.color + '15' }}
                        >
                            {config.icon}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: config.color }}>{platform}</span>
                    </div>
                    {course.rating && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-black">
                            <Star size={12} className="fill-yellow-500 text-yellow-500" />
                            {course.rating}
                        </div>
                    )}
                </div>

                <h4 className="text-lg font-black text-gray-900 tracking-tight leading-tight mb-3 line-clamp-2 min-h-[3rem] group-hover/card:text-orange-600 transition-colors">
                    {title}
                </h4>

                <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-2 mb-6 opacity-80">
                    {course.description || "In-depth module designed by industry experts to build specific technical competence."}
                </p>

                <div className="mt-auto flex flex-wrap gap-2 pb-2">
                    {course.duration && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-500 rounded-xl text-[10px] font-bold">
                            <Clock size={12} />
                            {course.duration}
                        </div>
                    )}
                    {course.cost && (
                        <div className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
                            {course.cost.split('/')[0]}
                        </div>
                    )}
                </div>
            </div>

            <a
                href={course.url}
                target="_blank"
                rel="noopener noreferrer"
                className="m-2 p-4 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                style={{ backgroundColor: config.color }}
            >
                Enroll Module
                <PlayCircle size={16} />
            </a>
        </div>
    );
}

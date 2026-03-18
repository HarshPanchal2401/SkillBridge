'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
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
    Trophy,
    GraduationCap,
    Lightbulb,
    Target,
    Map
} from 'lucide-react';

interface CourseRecommendation {
    skill: string;
    matched_as?: string;
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

    const loadRecommendations = async (refresh: boolean = false) => {
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

            const result = await api.getGapBasedCourses(userId, refresh);
            const recs: CourseRecommendation[] = [];
            const recsData = result.recommendations || [];

            for (const item of recsData) {
                if (item.courses && item.courses.length > 0) {
                    recs.push({
                        skill: item.skill || 'General',
                        matched_as: item.matched_as,
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

    const handleSearch = async (refresh: boolean = true) => {
        if (!searchSkill.trim()) return;
        setSearching(true);
        try {
            const result = await api.searchCoursesForSkill(searchSkill.trim(), refresh);
            setSearchResults(result.courses || []);
        } catch (err) {
            console.error('Failed to search courses:', err);
        } finally {
            setSearching(false);
        }
    };

    if (authLoading || loading) {
        return (
            <>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
                    <p className="text-gray-400 text-sm animate-pulse">Curating your learning path...</p>
                </div>
            </>
        );
    }

    if (!hasSkills) {
        return (
            <>
                <div className="space-y-12 pb-12 animate-fade-in">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold uppercase tracking-wider mb-4">
                            <Sparkles size={12} />
                            Skill Alignment Required
                        </div>
                        <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-4 uppercase">
                            Skill Gap Training
                        </h1>
                        <p className="text-gray-500 text-lg leading-relaxed">
                            To bridge your professional gaps, we need to understand your current skill profile first.
                        </p>
                        <button
                            onClick={() => router.push('/profile')}
                            className="mt-8 px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-sm flex items-center gap-2"
                        >
                            Complete Profile
                            <ArrowUpRight size={18} />
                        </button>
                    </div>

                    <div className="pt-12 border-t border-gray-100">
                        <SearchBox
                            searchSkill={searchSkill}
                            setSearchSkill={setSearchSkill}
                            handleSearch={handleSearch}
                            searching={searching}
                            searchResults={searchResults}
                            setSearchResults={setSearchResults}
                        />
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="space-y-10 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-gray-100">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold uppercase tracking-wider mb-3">
                            <GraduationCap size={12} />
                            Learning Intelligence
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight uppercase">
                            Skill Gap Training
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Precision-targeted modules to close your identified skill gaps.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => loadRecommendations(true)}
                            className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
                        >
                            <RefreshCw size={16} className={loading && recommendations.length > 0 ? "animate-spin" : ""} />
                            Refresh Analysis
                        </button>
                        <button
                            onClick={() => router.push('/roadmap')}
                            className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-xl flex items-center gap-2"
                        >
                            <Map size={16} />
                            View Roadmap
                        </button>
                    </div>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="card-simple">
                        <div className="flex items-center gap-3 text-amber-600 mb-2">
                            <Lightbulb size={20} />
                            <h4 className="text-xs font-bold uppercase tracking-wider">Active Gaps</h4>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{recommendations.length}</p>
                    </div>
                    <div className="card-simple">
                        <div className="flex items-center gap-3 text-red-600 mb-2">
                            <Target size={20} />
                            <h4 className="text-xs font-bold uppercase tracking-wider">Critical Priority</h4>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{recommendations.filter(r => r.gap_priority === 'critical').length}</p>
                    </div>
                    <div className="card-simple">
                        <div className="flex items-center gap-3 text-blue-600 mb-2">
                            <Trophy size={20} />
                            <h4 className="text-xs font-bold uppercase tracking-wider">Platforms</h4>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">8+</p>
                    </div>
                </div>

                <SearchBox
                    searchSkill={searchSkill}
                    setSearchSkill={setSearchSkill}
                    handleSearch={handleSearch}
                    searching={searching}
                    searchResults={searchResults}
                    setSearchResults={setSearchResults}
                />

                {recommendations.length > 0 ? (
                    <div className="space-y-12">
                        {recommendations.map((rec, idx) => (
                            <div key={idx} className="space-y-6">
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm
                                            ${rec.gap_priority === 'critical' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                            <BookOpen size={18} />
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight">BRIDGE: {rec.skill}</h2>
                                                {rec.matched_as && rec.matched_as !== rec.skill && (
                                                    <span className="text-[10px] text-green-600 font-bold italic bg-green-50 px-2 py-0.5 rounded">
                                                        Matched as: {rec.matched_as}
                                                    </span>
                                                )}
                                                {rec.gap_priority === 'critical' && (
                                                    <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[9px] font-bold uppercase tracking-wider rounded-md border border-red-100">
                                                        Critical Gap
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 font-medium mt-0.5">Modules specifically curated to master this requirement</p>
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
                ) : (
                    <div className="card-simple py-16 text-center space-y-6">
                        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto border border-green-100">
                            <Star className="text-green-500 fill-green-500" size={32} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">Perfect Alignment</h3>
                            <p className="text-gray-500 max-w-lg mx-auto leading-relaxed">
                                Excellent work! You currently have no identified skill gaps for your target role.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function SearchBox({ searchSkill, setSearchSkill, handleSearch, searching, searchResults, setSearchResults }: any) {
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl p-2.5 pr-2.5 pl-6 shadow-sm border border-gray-100 flex items-center gap-4 group focus-within:border-green-500 transition-all">
                <Search className="text-gray-300 group-focus-within:text-green-500 transition-colors" size={20} />
                <input
                    type="text"
                    value={searchSkill}
                    onChange={(e) => setSearchSkill(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1 py-2 bg-transparent outline-none text-gray-900 text-sm font-bold placeholder:font-medium placeholder:text-gray-300"
                    placeholder="Search courses to close specific gaps (e.g. Distributed Systems, Tailwind, PyTorch)"
                />
                <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-green-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                >
                    {searching ? 'Querying...' : 'Discovery'}
                </button>
            </div>

            {searchResults.length > 0 && (
                <div className="w-full animate-fade-in py-8 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-8 px-2">
                        <h3 className="font-bold text-gray-900 tracking-tight">Search results for "{searchSkill}"</h3>
                        <button onClick={() => setSearchResults([])} className="text-[10px] font-bold uppercase text-gray-400 hover:text-red-500 tracking-wider">Clear Search</button>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchResults.map((course: any, idx: number) => (
                            <CourseCard key={idx} course={course} />
                        ))}
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
        <div className="card-simple flex flex-col h-full group">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-inner"
                        style={{ backgroundColor: config.color + '15' }}
                    >
                        {config.icon}
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: config.color }}>{platform}</span>
                </div>
                {course.rating && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-md text-[10px] font-bold">
                        <Star size={10} className="fill-yellow-500 text-yellow-500" />
                        {course.rating}
                    </div>
                )}
            </div>

            <h4 className="font-bold text-gray-900 tracking-tight leading-tight mb-3 line-clamp-2 min-h-[2.5rem] group-hover:text-green-600 transition-colors uppercase text-sm">
                {title}
            </h4>

            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 mb-6 opacity-80">
                {course.description || "In-depth module designed by industry experts to build specific technical competence."}
            </p>

            <div className="mt-auto flex flex-wrap gap-2 pb-6">
                {course.duration && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-400 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                        <Clock size={10} />
                        {course.duration}
                    </div>
                )}
                {course.cost && (
                    <div className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                        {course.cost.split('/')[0]}
                    </div>
                )}
            </div>

            <a
                href={course.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-green-600 shadow-sm"
            >
                Enroll Module
                <PlayCircle size={14} />
            </a>
        </div>
    );
}

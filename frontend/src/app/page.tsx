'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ArrowRight, Target, BookOpen, Map, BarChart3, Sparkles } from 'lucide-react';

export default function HomePage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            router.push('/dashboard');
        }
    }, [user, loading, router]);

    const features = [
        {
            icon: Target,
            title: 'Smart Domain Matching',
            description: 'AI-powered analysis matches your skills to ideal career domains',
            color: 'from-green-400 to-emerald-500',
        },
        {
            icon: BarChart3,
            title: 'Skill Gap Analysis',
            description: 'Identify exactly which skills you need to become job-ready',
            color: 'from-blue-400 to-indigo-500',
        },
        {
            icon: BookOpen,
            title: 'Personalized Learning',
            description: 'Get recommended courses, projects, and certifications',
            color: 'from-purple-400 to-pink-500',
        },
        {
            icon: Map,
            title: 'AI Career Roadmap',
            description: 'Generate a step-by-step plan to achieve your career goals',
            color: 'from-orange-400 to-red-500',
        },
    ];

    const domains = [
        { name: 'Healthcare', icon: '🏥', color: 'bg-emerald-500' },
        { name: 'Agriculture', icon: '🌾', color: 'bg-amber-500' },
        { name: 'Smart Cities', icon: '🏙️', color: 'bg-indigo-500' },
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            {/* Hero Section */}
            <header className="relative overflow-hidden">
                {/* Background decorations */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/20 rounded-full blur-3xl"></div>
                    <div className="absolute top-60 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
                </div>

                <nav className="relative z-10 container mx-auto px-6 py-6 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-emerald-500 rounded-lg flex items-center justify-center">
                            <Sparkles className="text-white" size={24} />
                        </div>
                        <span className="text-2xl font-bold text-white">SkillPath</span>
                    </div>
                    <div className="flex gap-4">
                        <Link
                            href="/login"
                            className="px-6 py-2 text-white hover:text-green-400 transition-colors"
                        >
                            Login
                        </Link>
                        <Link
                            href="/register"
                            className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all"
                        >
                            Get Started
                        </Link>
                    </div>
                </nav>

                <div className="relative z-10 container mx-auto px-6 pt-20 pb-32 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full mb-8">
                        <Sparkles size={16} className="text-green-400" />
                        <span className="text-green-400 text-sm font-medium">
                            AI-Powered Career Intelligence
                        </span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
                        Discover Your Perfect
                        <br />
                        <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                            Career Path
                        </span>
                    </h1>

                    <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
                        Smart skill analysis, domain recommendations, and personalized roadmaps
                        for careers in Healthcare, Agriculture, and Smart Cities.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/register"
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-lg hover:shadow-xl hover:shadow-green-500/30 transition-all group"
                        >
                            Start Your Journey
                            <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white rounded-xl font-semibold text-lg hover:bg-white/20 transition-all border border-white/20"
                        >
                            I Have an Account
                        </Link>
                    </div>
                </div>
            </header>

            {/* Domains Section */}
            <section className="py-20 bg-gray-800/50">
                <div className="container mx-auto px-6">
                    <h2 className="text-3xl font-bold text-white text-center mb-4">
                        Explore High-Impact Domains
                    </h2>
                    <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
                        Focus your career on industries shaping the future
                    </p>
                    <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                        {domains.map((domain) => (
                            <div
                                key={domain.name}
                                className="relative overflow-hidden rounded-2xl p-8 bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-600 hover:border-gray-500 transition-all group card-hover"
                            >
                                <div
                                    className={`w-16 h-16 ${domain.color} rounded-xl flex items-center justify-center text-3xl mb-4`}
                                >
                                    {domain.icon}
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">{domain.name}</h3>
                                <p className="text-gray-400 text-sm">
                                    Discover roles, required skills, and career paths
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20">
                <div className="container mx-auto px-6">
                    <h2 className="text-3xl font-bold text-white text-center mb-4">
                        How SkillPath Works
                    </h2>
                    <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
                        A complete platform to guide your career journey
                    </p>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={index}
                                    className="p-6 rounded-2xl bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-all card-hover"
                                >
                                    <div
                                        className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4`}
                                    >
                                        <Icon className="text-white" size={24} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                                    <p className="text-gray-400 text-sm">{feature.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20">
                <div className="container mx-auto px-6">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-green-600 to-emerald-600 p-12 text-center">
                        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                Ready to Shape Your Career?
                            </h2>
                            <p className="text-green-100 mb-8 max-w-xl mx-auto">
                                Join thousands of students and professionals building their future in
                                high-impact industries.
                            </p>
                            <Link
                                href="/register"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-green-600 rounded-xl font-semibold text-lg hover:shadow-xl transition-all"
                            >
                                Get Started Free
                                <ArrowRight />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 border-t border-gray-800">
                <div className="container mx-auto px-6 text-center text-gray-500 text-sm">
                    © 2024 SkillPath. Built for the Ingenious Hackathon.
                </div>
            </footer>
        </div>
    );
}

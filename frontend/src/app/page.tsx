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
            color: 'text-green-600 bg-green-50',
        },
        {
            icon: BarChart3,
            title: 'Skill Gap Analysis',
            description: 'Identify exactly which skills you need to become job-ready',
            color: 'text-blue-600 bg-blue-50',
        },
        {
            icon: BookOpen,
            title: 'Skill Gap Training',
            description: 'Get recommended courses, projects, and certifications',
            color: 'text-purple-600 bg-purple-50',
        },
        {
            icon: Map,
            title: 'AI Career Roadmap',
            description: 'Generate a step-by-step plan to achieve your career goals',
            color: 'text-orange-600 bg-orange-50',
        },
    ];

    const domains = [
        { name: 'AI & Machine Learning', icon: '🤖', border: 'border-l-green-500' },
        { name: 'Cloud & DevOps', icon: '☁️', border: 'border-l-blue-500' },
        { name: 'Web & Mobile Dev', icon: '💻', border: 'border-l-purple-500' },
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
            {/* Header / Nav */}
            <nav className="bg-white border-b border-gray-100">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
                            <Sparkles className="text-white" size={20} />
                        </div>
                        <span className="text-xl font-semibold tracking-tight">SkillBridge</span>
                    </div>
                    <div className="flex items-center gap-8">
                        <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-green-600 transition-colors">
                            Login
                        </Link>
                        <Link
                            href="/register"
                            className="text-sm font-medium px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-sm"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="py-24 bg-white">
                <div className="container mx-auto px-6 text-center max-w-4xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-100 rounded-full mb-8">
                        <span className="text-green-700 text-xs font-semibold uppercase tracking-wider">
                            AI-Powered Career Intelligence
                        </span>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
                        Navigate Your <span className="text-green-600 font-extrabold">Career</span> with Precision
                    </h1>

                    <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-12">
                        Smart skill analysis, domain recommendations, and personalized roadmaps
                        tailored for growth across <span className="font-medium text-gray-900">every technology domain</span>.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/register"
                            className="px-8 py-3.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all shadow-md flex items-center justify-center gap-2"
                        >
                            Start Your Journey
                            <ArrowRight size={18} />
                        </Link>
                        <Link
                            href="/login"
                            className="px-8 py-3.5 bg-white text-gray-700 rounded-xl font-semibold border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center"
                        >
                            I Have an Account
                        </Link>
                    </div>
                </div>
            </header>

            {/* Domains Section */}
            <section className="py-24">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">Focus Areas</h2>
                        <p className="text-gray-500 max-w-xl mx-auto">
                            Specialized career guidance for the most impactful industries of the future.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {domains.map((domain) => (
                            <div
                                key={domain.name}
                                className={`card-simple card-hover border-l-4 ${domain.border} flex flex-col items-center text-center`}
                            >
                                <div className="text-4xl mb-6">
                                    {domain.icon}
                                </div>
                                <h3 className="text-xl font-semibold mb-3">{domain.name}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    Unlock opportunities and bridge the gap with industry-specific skill paths.
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 bg-white border-y border-gray-100">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">How it Works</h2>
                        <p className="text-gray-500 max-w-xl mx-auto">
                            Our AI tools provide end-to-end support for your professional development.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={index}
                                    className="p-8 bg-gray-50 rounded-2xl border border-gray-100 transition-colors hover:bg-white hover:border-green-100"
                                >
                                    <div
                                        className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-6`}
                                    >
                                        <Icon size={24} />
                                    </div>
                                    <h3 className="text-lg font-bold mb-3">{feature.title}</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24">
                <div className="container mx-auto px-6">
                    <div className="bg-gray-50 border border-gray-100 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 left-0 w-full h-2 bg-green-600"></div>
                        <div className="relative z-10 space-y-8">
                            <div className="max-w-2xl mx-auto space-y-4">
                                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                                    Ready to Accelerate Your Journey?
                                </h2>
                                <p className="text-gray-500 text-lg md:text-xl leading-relaxed font-medium">
                                    Join thousands of professionals using AI-driven intelligence to navigate the modern tech market.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Link
                                    href="/register"
                                    className="w-full sm:w-auto px-10 py-4 bg-green-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-green-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Get Started Free
                                    <ArrowRight size={18} />
                                </Link>
                                <Link
                                    href="/login"
                                    className="w-full sm:w-auto px-10 py-4 bg-white text-gray-900 border border-gray-200 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-gray-50 transition-all active:scale-95"
                                >
                                    Sign In
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 bg-white">
                <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-gray-400 text-sm">
                        © 2024 SkillBridge. Built for the Ingenious Hackathon.
                    </p>
                    <div className="flex gap-8">
                        <Link href="#" className="text-sm text-gray-400 hover:text-green-600">Privacy</Link>
                        <Link href="#" className="text-sm text-gray-400 hover:text-green-600">Terms</Link>
                        <Link href="#" className="text-sm text-gray-400 hover:text-green-600">Support</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}


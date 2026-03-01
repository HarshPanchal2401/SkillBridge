'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Mail, User, GraduationCap, Target, MapPin, AlertCircle, Sparkles, Building, Briefcase, RefreshCw, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        education: '',
        university: '',
        graduation_year: new Date().getFullYear(),
        location: '',
        target_role: '',
        target_sector: 'technology',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.name.trim() || !formData.email.trim()) {
            setError('Name and email are required');
            return;
        }

        setLoading(true);

        try {
            await register({
                name: formData.name.trim(),
                email: formData.email.trim(),
                education: formData.education.trim() || undefined,
                university: formData.university.trim() || undefined,
                graduation_year: formData.graduation_year || undefined,
                location: formData.location.trim() || undefined,
                target_role: formData.target_role.trim() || undefined,
                target_sector: formData.target_sector || 'technology',
            });
            router.push('/onboarding');
        } catch (err: any) {
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const updateField = (field: string, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 animate-fade-in">
            <div className="w-full max-w-xl space-y-8">
                {/* Logo */}
                <div className="text-center">
                    <Link href="/" className="inline-flex items-center gap-2 group">
                        <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            <Sparkles className="text-white" size={20} />
                        </div>
                        <span className="text-2xl font-bold text-gray-900 tracking-tight">SkillBridge</span>
                    </Link>
                </div>

                {/* Form Card */}
                <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 md:p-12 shadow-sm border-b-4 border-b-green-500">
                    <div className="text-center mb-10">
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create Your Identity</h1>
                        <p className="text-gray-400 text-sm mt-1">Start your career journey with AI insights</p>
                    </div>

                    {error && (
                        <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
                            <AlertCircle size={18} className="shrink-0" />
                            <span className="text-xs font-bold leading-relaxed">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Name & Email Row */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Full Name *</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => updateField('name', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-green-500 rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Email *</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => updateField('email', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-green-500 rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all"
                                        placeholder="you@email.com"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Education Row */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Degree</label>
                                <div className="relative">
                                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        type="text"
                                        value={formData.education}
                                        onChange={(e) => updateField('education', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-green-500 rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all"
                                        placeholder="B.S. Computer Science"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">University</label>
                                <div className="relative">
                                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        type="text"
                                        value={formData.university}
                                        onChange={(e) => updateField('university', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-green-500 rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all"
                                        placeholder="Stanford University"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Location & Role */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Location</label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => updateField('location', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-green-500 rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all"
                                        placeholder="San Francisco, CA"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Target Role</label>
                                <div className="relative">
                                    <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        type="text"
                                        value={formData.target_role}
                                        onChange={(e) => updateField('target_role', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-green-500 rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all"
                                        placeholder="Backend Engineer"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 mt-4 bg-gray-900 text-white rounded-xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-gray-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <RefreshCw className="animate-spin" size={18} />
                            ) : (
                                <>
                                    Create Identity
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-gray-400 text-xs font-medium">
                            Already have an account?{' '}
                            <Link href="/login" className="text-green-600 hover:text-green-700 font-bold ml-1">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                        &copy; 2026 SkillBridge Intelligence Systems
                    </p>
                </div>
            </div>
        </div>
    );
}

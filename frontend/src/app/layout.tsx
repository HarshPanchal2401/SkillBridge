import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import AppLayout from '@/components/layout/AppLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'SkillBridge - Career Intelligence Platform',
    description: 'Discover your ideal career path in Healthcare, Agriculture, and Smart Cities',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <AuthProvider>
                    <AppLayout>{children}</AppLayout>
                </AuthProvider>
            </body>
        </html>
    );
}

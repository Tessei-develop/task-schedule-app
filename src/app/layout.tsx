import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { AutoSync } from '@/components/layout/AutoSync'
import { TaskForm } from '@/components/tasks/TaskForm'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TaskFlow',
  description: 'Smart task & schedule management',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TaskFlow',
  },
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={geist.className}>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
        <AutoSync />
        <TaskForm />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}

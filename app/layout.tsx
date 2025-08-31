import '../styles/globals.css'

export const metadata = {
  title: 'CogniHire - Cognitive Assessment Platform',
  description: 'Secure cognitive assessment platform for hiring and evaluation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-900 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  )
}

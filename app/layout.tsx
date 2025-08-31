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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}

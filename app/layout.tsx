import './globals.css';

export const metadata = {
  title: 'CaptionKit',
  description: 'AI subtitle generator & editor',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <title>CaptionKit</title>
      </head>
      <body className="bg-gray-900 text-white font-sans">
        <header className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-[#E0725F]">CaptionKit</h1>
          <nav>
            <button className="px-3 py-1 rounded bg-[#E0725F] hover:bg-[#C56255] transition">+ New</button>
          </nav>
        </header>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}

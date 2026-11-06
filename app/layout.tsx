import './globals.css';
import { BRAND } from '../frontend/lib/brand';

export const metadata = {
  title: BRAND.name,
  description: BRAND.description,
  openGraph: { title: BRAND.name, description: BRAND.description, siteName: BRAND.name, url: `https://${BRAND.domain}`, type: 'website' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-900 text-white font-sans">
        <header className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-[#E0725F]">{BRAND.name}</h1>
          <nav>
            <button className="px-3 py-1 rounded bg-[#E0725F] hover:bg-[#C56255] transition">+ New</button>
          </nav>
        </header>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}

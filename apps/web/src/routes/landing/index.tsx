import React, { useEffect, useState } from 'react';
import { fetchTemplates } from '../../lib/api-client.js';
import type { TemplateListItem } from '@you-are-invited/shared-types';
import { Sparkles, ArrowRight, Eye, Layers } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [customName, setCustomName] = useState('Budi Santoso');

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch((err) => {
        console.error(err);
        // Fallback default templates if API not running yet
        setTemplates([
          {
            id: 'raden-motion',
            displayName: 'Raden Motion',
            description: 'Template bernuansa adat Jawa klasik nan anggun dengan ornamen emas dan aksen mewah.',
            supportsPantun: false,
            supportsHeroVideo: false,
            quoteBlockPosition: 'hero',
            galleryVideoType: 'none',
            isActive: true,
          },
          {
            id: 'betawi-motion',
            displayName: 'Betawi Motion',
            description: 'Template khas adat Betawi yang semarak dengan video motion intro, pantun adat, dan aksen warna ceria.',
            supportsPantun: true,
            supportsHeroVideo: true,
            quoteBlockPosition: 'closing',
            galleryVideoType: 'youtube',
            isActive: true,
          },
          {
            id: 'arjuna-tema-foto',
            displayName: 'Arjuna Tema Foto',
            description: 'Template modern minimalis dengan fokus utama galeri foto estetis dan interaksi amplop digital elegan.',
            supportsPantun: false,
            supportsHeroVideo: false,
            quoteBlockPosition: 'none',
            galleryVideoType: 'hosted',
            isActive: true,
          },
        ]);
      });
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Navbar */}
      <header className="border-b border-stone-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl font-bold tracking-tight text-amber-800">You Are Invited</span>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              v1.0
            </span>
          </div>
          <nav className="flex items-center gap-4 text-xs font-medium">
            <a href="#templates" className="text-stone-600 hover:text-stone-900">Katalog Template</a>
            <a href="/admin" className="px-4 py-2 rounded-full bg-stone-900 text-white hover:bg-stone-800 transition-colors">
              Dashboard Admin
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Standalone & Self-Hosted Platform</span>
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 tracking-tight mb-6 leading-tight">
          Platform Undangan Pernikahan Digital Multi-Template
        </h1>
        <p className="text-sm md:text-base text-stone-600 leading-relaxed max-w-2xl mx-auto mb-10">
          Solusi undangan online mandiri bertenaga React + TypeScript + Hono + SQLite.
          Bebas ketergantungan WordPress, cepat dimuat, responsive, dan multi-tenant.
        </p>

        {/* Guest parameter tester */}
        <div className="max-w-md mx-auto p-4 bg-white rounded-2xl border border-stone-200/80 shadow-xs text-left mb-12">
          <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">
            Coba Nama Tamu (Parameter URL):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Ketik nama tamu..."
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </section>

      {/* Templates Catalog */}
      <section id="templates" className="py-16 px-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-stone-200 pb-4">
          <div>
            <span className="text-xs uppercase tracking-widest text-amber-700 font-bold">Koleksi Desain</span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-stone-900 mt-1">Template Tersedia</h2>
          </div>
          <span className="text-xs text-stone-500 font-medium">3 Template Aktif</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="h-44 bg-gradient-to-br from-stone-800 to-stone-950 p-6 flex flex-col justify-between text-white relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/20 text-stone-200">
                      {tmpl.id}
                    </span>
                    <Layers className="w-4 h-4 text-amber-400" />
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-amber-200">{tmpl.displayName}</h3>
                </div>

                <div className="p-6">
                  <p className="text-xs text-stone-600 leading-relaxed mb-6">
                    {tmpl.description}
                  </p>

                  <div className="space-y-2 border-t border-stone-100 pt-4 text-[11px] text-stone-500">
                    <div className="flex justify-between">
                      <span>Pantun Adat:</span>
                      <span className="font-medium text-stone-800">{tmpl.supportsPantun ? 'Ya' : 'Tidak'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hero Background Video:</span>
                      <span className="font-medium text-stone-800">{tmpl.supportsHeroVideo ? 'Ya' : 'Tidak'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Posisi Kutipan Agama:</span>
                      <span className="font-medium text-stone-800 uppercase">{tmpl.quoteBlockPosition}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0">
                <a
                  href={`/i/${tmpl.id}?to=${encodeURIComponent(customName)}`}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs tracking-wider uppercase transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span>Lihat Demo Undangan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 mt-20 py-8 text-center text-xs text-stone-500">
        <p>© {new Date().getFullYear()} You Are Invited. Standalone Wedding Platform.</p>
      </footer>
    </div>
  );
};

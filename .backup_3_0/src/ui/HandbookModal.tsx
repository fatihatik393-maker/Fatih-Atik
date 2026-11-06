import React, { useEffect, useState } from 'react';
import { GameEngine } from '../core/GameEngine';

interface HandbookModalProps {
  engineRef: React.MutableRefObject<GameEngine | null>;
  onClose: () => void;
}

interface HandbookPageData {
  pageNumber: number;
  chapterTag: string;
  title: string;
  subtitle: string;
  summary: string;
  steps: { badge: string; heading: string; detail: string }[];
  proTip: string;
}

const HANDBOOK_PAGES: HandbookPageData[] = [
  {
    pageNumber: 1,
    chapterTag: 'BÖLÜM 01 · GİRİŞ',
    title: 'Restorana Hoş Geldin',
    subtitle: 'Burger District’in Kalbi: Mutfak, Kasa ve Sıcak Servis Döngüsü',
    summary:
      'Burger District’te her iş günü sabah hazırlığıyla başlar. Kasadan dükkânı açtığınızda müşteriler içeri girer, siparişlerini verir ve sıcak smash burgerlerini bekler.',
    steps: [
      {
        badge: '01',
        heading: 'Sabah Hazırlığı & Kasa [O]',
        detail:
          'Güne başlamadan önce stoklarınızı kontrol edin, ardından POS Kasasından veya [O] tuşuyla restoranı müşteri girişine açın.',
      },
      {
        badge: '02',
        heading: 'KDS Sipariş Takibi [1–5]',
        detail:
          'Sağ üstteki tek satırlık aktif sipariş şeridinden veya [TAB] ekranından hedef müşterinizi seçin.',
      },
      {
        badge: '03',
        heading: 'Mutfak Üretimi & Teslimat',
        detail:
          'Izgarada köfteyi pişirin, hazırlama tezgâhında burgeri katmanlayın, servis tepsisine içecekle dizip teslim bankosunda sunun.',
      },
    ],
    proTip:
      'İpucu: Tezgâhın sol köşesindeki fiziksel Rehber Kitapçığa tıklayarak veya her an [F1] tuşuna basarak bu el kitabını açabilirsiniz.',
  },
  {
    pageNumber: 2,
    chapterTag: 'BÖLÜM 02 · KONTROLLER & SERBEST YERLEŞTİRME',
    title: 'Hareket ve Kontroller',
    subtitle: 'Smart Placement ile Tezgâhların İstediğiniz Noktasına Bırakın',
    summary:
      'Elinizde tuttuğunuz her malzemeyi, pişmiş köfteyi, içeceği veya servis tepsisini tezgâhların ve masaların istediğiniz noktasına özgürce yerleştirebilirsiniz.',
    steps: [
      {
        badge: 'WASD',
        heading: 'Yürüme ve Bakış',
        detail:
          'WASD tuşlarıyla mutfakta hareket edin, fare ile istasyonlara ve tezgâh yüzeylerine nişan alın.',
      },
      {
        badge: 'E / TIK',
        heading: 'Yüzeye Serbest Bırakma & Alma',
        detail:
          'Elinizde nesne varken bir tezgâha baktığınızda kehribar 3D silüet belirir. [E] veya [Sol Tık] ile tam o noktaya bırakın.',
      },
      {
        badge: 'R / G',
        heading: '45° Döndürme [R] & Yere Bırakma [G]',
        detail:
          'Yerleştirmeden önce [R] tuşuyla nesnenin açısını 45° döndürün. Acil durumda [G] ile yere bırakabilirsiniz.',
      },
    ],
    proTip:
      'İpucu: Yeşil/Kehribar önizleme uygun alanı, kırmızı önizleme ise başka bir nesneyle çakışan dolu alanı gösterir.',
  },
  {
    pageNumber: 3,
    chapterTag: 'BÖLÜM 03 · MUTFAK SANATI',
    title: 'Burger Nasıl Hazırlanır?',
    subtitle: 'Izgara Zamanlaması ve Doğru Katman Sıralaması',
    summary:
      'Kusursuz bir smash burger doğru pişirme süresi ve eksiksiz katman sırasıyla hazırlanır. Köfteyi ızgarada unutursanız yanar ve çöpe atılması gerekir!',
    steps: [
      {
        badge: 'IZGARA',
        heading: 'Çiğ Köfteyi Pişirin (8 sn)',
        detail:
          'Köfte küvetinden Çiğ Köfte alın ve ızgara bölmesine bırakın. Pişti uyarısı geldiğinde yanmadan hemen alın.',
      },
      {
        badge: 'KATMAN',
        heading: 'Alt Ekmek → Köfte → Peynir / Marul → Üst Ekmek',
        detail:
          'Hazırlama tahtasına önce Alt Ekmek koyun. Siparişe göre Pişmiş Köfte, Cheddar Peyniri, Taze Marul ve en son Üst Ekmek ekleyin.',
      },
      {
        badge: 'SMASH',
        heading: 'Double Smash Burger (Gün 2)',
        detail:
          'Alt Ekmek + Pişmiş Köfte + Peynir + 2. Pişmiş Köfte + Peynir + Marul + Üst Ekmek sırasıyla hazırlanır.',
      },
    ],
    proTip:
      'İpucu: Yanlış bir katman koyarsanız Atık İstasyonuna (Çöp Kutusu) tıklayarak hazırlama tahtasını anında sıfırlayabilirsiniz.',
  },
  {
    pageNumber: 4,
    chapterTag: 'BÖLÜM 04 · SERVİS TEPSİSİ SİSTEMİ',
    title: 'Tepsiyle Servis',
    subtitle: 'Burger ve Gazlı İçeceği Tek Servis Tepsisinde Birleştirin',
    summary:
      'Gerçek bir burger restoranında olduğu gibi siparişleri Servis Tepsisi üzerinde birleştirerek düzenli ve hızlı biçimde müşteriye sunabilirsiniz.',
    steps: [
      {
        badge: 'TEPSİ',
        heading: 'Tepsi Yığınından Servis Tepsisi Alın',
        detail:
          'Ön bankodaki Servis Tepsisi Yığınından [E] veya [Sol Tık] ile boş bir tepsi alın ya da tezgâha bırakın.',
      },
      {
        badge: 'BİRLEŞTİR',
        heading: 'Burger + Gazlı İçeceği Tepsiye Diz',
        detail:
          'Tepsi elinizdeyken hazır burgere ve içecek istasyonuna tıklayın; veya tezgâha bıraktığınız tepsinin üzerine burger ve içeceği bırakın.',
      },
      {
        badge: 'TESLİM',
        heading: 'Teslim Bankosunda Müşteriye Sunun',
        detail:
          'Tepsiyi tek parça halinde kaldırıp Teslim Bankosuna [E / Sol Tık] bırakarak siparişi tamamlayın.',
      },
    ],
    proTip:
      'İpucu: Tezgâh üzerine önceden 2-3 servis tepsisi dizip Rush Hour öncesinde hazırlık yapabilirsiniz!',
  },
  {
    pageNumber: 5,
    chapterTag: 'BÖLÜM 05 · MÜŞTERİ PSİKOLOJİSİ',
    title: 'Müşteriler ve Yoğun Saatler',
    subtitle: 'Sabır Çubuğu, Öğle Yoğunluğu (Rush Hour) ve Bahşiş Sistemi',
    summary:
      'Her müşterinin farklı bir yürüyüş hızı ve sabır süresi vardır. Hızlı servis yüksek bahşiş ve itibar kazandırırken, bekletilen müşteriler kızıp dükkândan ayrılır.',
    steps: [
      {
        badge: 'SABIR',
        heading: 'Sabır Çubuğu & Cömert Bahşiş',
        detail:
          'Müşteri sabrı %60’ın üzerindeyken yapılan teslimatlar ekstra hızlı servis bahşişi ve +4 İtibar kazandırır.',
      },
      {
        badge: 'RUSH',
        heading: 'Öğle Yoğunluğu (Rush Hour)',
        detail:
          'Günün orta diliminde müşteri akışı hızlanır. Köfteleri önceden ızgaraya atarak kuyruğu eritin.',
      },
      {
        badge: 'İTİBAR',
        heading: 'Restoran İtibarı (★ %0–100)',
        detail:
          'Yüksek itibar daha fazla müşteri çeker ve tüm siparişlerde bahşiş çarpanını yükseltir.',
      },
    ],
    proTip:
      'İpucu: [1–5] tuşlarıyla sabrı en çok azalan müşterinin siparişini seçip önce onu teslim edin.',
  },
  {
    pageNumber: 6,
    chapterTag: 'BÖLÜM 06 · İŞLETME GELİŞTİRME',
    title: 'Restoranını Büyüt',
    subtitle: 'Endüstriyel Ekipmanlar, Salon Dekoru ve Yeni Menü Tarifleri',
    summary:
      'Kazandığınız gelirle POS Kasa Terminalinden mutfağınızı güçlendirebilir, salon atmosferini yenileyebilir ve yüksek kârlı tariflerin kilidini açabilirsiniz.',
    steps: [
      {
        badge: '150 $',
        heading: 'Endüstriyel Hızlı Izgara',
        detail:
          'Köfte pişirme süresini 8 saniyeden 4.5 saniyeye indirir ve yanma toleransını artırır.',
      },
      {
        badge: '180 $',
        heading: 'Premium Restoran Dekoru',
        detail:
          'Sıcak ambiyans aydınlatması ve bitkiler ekler; +8 İtibar, +15 sn Müşteri Sabrı ve +%5 Bahşiş sağlar.',
      },
      {
        badge: '140 $',
        heading: 'Geliştirilmiş Soğuk Depo',
        detail:
          'Maksimum malzeme kapasitesini 60 adede, her stok paketi alımını +8 adede yükseltir.',
      },
    ],
    proTip:
      'İpucu: 2. Güne geçtiğinizde 115 $ değerindeki Double Smash Burger tarifi otomatik olarak menüye eklenir!',
  },
  {
    pageNumber: 7,
    chapterTag: 'BÖLÜM 07 · MASADA SERVİS, ÇİFT MÜŞTERİLER & 2 AŞAMALI TEMİZLİK',
    title: 'Masada Servis ve Temizlik',
    subtitle: 'Birlikte Gelen Müşteriler, Kirli Tepsi Toplama ve Bezle Masa Silme',
    summary:
      'Müşteriler tek başına veya iki kişilik arkadaş/çift grupları hâlinde gelir. Yemek bittiğinde masayı yeni müşterilere açmak için iki aşamalı temizlik yapılır.',
    steps: [
      {
        badge: 'GRUP',
        heading: 'Birlikte Gelen Müşteriler & Sohbet',
        detail:
          'İki kişilik gruplar ayrı sipariş verir ancak aynı kabin masasında karşılıklı oturup sohbet ederek yemeklerini yerler.',
      },
      {
        badge: '1. ADIM',
        heading: 'Kirli Servis Tepsisini Alın [E / Sol Tık]',
        detail:
          'Müşteri kalktığında önce masadaki kullanılmış tepsiyi [E] ile alın ve Tepsi Dönüş / Atık İstasyonuna bırakın. Masada kırıntı ve sos lekeleri kalır.',
      },
      {
        badge: '2. ADIM',
        heading: 'Masayı Bezle Silin (+5 $ Prim · +1 İtibar)',
        detail:
          'Eliniz boşken kırıntılı masaya tekrar [E / Sol Tık] yaptığınızda mikrofiber bezle yüzeyi silersiniz; masa açılır ve +5 $ Temizlik Primi kazanırsınız!',
      },
    ],
    proTip:
      'İpucu: Sadece tepsiyi almak masayı temizlemez! Tepsiyi bıraktıktan sonra masayı bezle silmeyi unutmayın.',
  },
];

export const HandbookModal: React.FC<HandbookModalProps> = ({
  engineRef,
  onClose,
}) => {
  const [pageIdx, setPageIdx] = useState(0);
  const current = HANDBOOK_PAGES[pageIdx];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        engineRef.current?.audio.playMenuClick();
        setPageIdx((p) => Math.min(HANDBOOK_PAGES.length - 1, p + 1));
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        engineRef.current?.audio.playMenuClick();
        setPageIdx((p) => Math.max(0, p - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [engineRef]);

  return (
    <div
      data-testid="handbook-modal"
      className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/85 pointer-events-auto p-4 select-none"
    >
      {/* Open Hardcover Book Shell */}
      <div className="relative w-full max-w-4xl rounded-3xl bg-[#2a1a11] p-3 sm:p-4 shadow-[0_25px_70px_rgba(0,0,0,0.85)] border-2 border-[#b45309]/50">
        {/* Inner Archival Cream Paper Spread */}
        <div className="relative rounded-2xl bg-[#f7f3e8] text-[#1c1917] border border-[#d6cbb5] shadow-inner overflow-hidden">
          {/* Top Archival Header Strip */}
          <div className="flex items-center justify-between px-6 py-3.5 bg-[#efe8d6] border-b border-[#d6cbb5]">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#1c1917] text-[#f59e0b] font-mono-num font-extrabold text-xs">
                BD
              </span>
              <div>
                <div className="text-[10px] font-mono-num font-bold uppercase tracking-widest text-[#92400e]">
                  BURGER DISTRICT · RESMİ İŞLETME REHBERİ
                </div>
                <div className="text-xs font-semibold text-[#57534e]">
                  {current.chapterTag}
                </div>
              </div>
            </div>

            {/* Page Number Pills */}
            <div className="hidden sm:flex items-center gap-1">
              {HANDBOOK_PAGES.map((p, idx) => {
                const active = idx === pageIdx;
                return (
                  <button
                    key={p.pageNumber}
                    type="button"
                    data-testid={`handbook-page-tab-${p.pageNumber}`}
                    onClick={() => {
                      engineRef.current?.audio.playMenuClick();
                      setPageIdx(idx);
                    }}
                    className={`w-7 h-7 rounded-lg font-mono-num text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#d97706] text-white shadow-sm scale-105'
                        : 'bg-[#e5dec9] hover:bg-[#d8ceb4] text-[#44403c]'
                    }`}
                  >
                    {p.pageNumber}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              data-testid="handbook-close-btn"
              onClick={() => {
                engineRef.current?.audio.playMenuClick();
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-[#1c1917] hover:bg-[#292524] text-[#f7f3e8] font-display font-bold text-xs cursor-pointer transition-colors"
            >
              Kapat [ESC / F1]
            </button>
          </div>

          {/* Two-Column Book Spread Content */}
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[410px]">
            {/* Left Page: Hand-Drawn Animated Technical Illustration */}
            <div className="md:col-span-5 p-6 bg-[#f2ecdc] border-b md:border-b-0 md:border-r border-[#d6cbb5] flex flex-col justify-between">
              <div>
                <div className="inline-block px-2.5 py-0.5 rounded-md bg-[#d97706]/15 border border-[#d97706]/40 text-[#92400e] font-mono-num font-bold text-[11px] mb-2">
                  ŞEMA {current.pageNumber}.0 · CANLI ANLATIM
                </div>
                <h3 className="font-display font-extrabold text-xl text-[#1c1917] leading-snug">
                  {current.title}
                </h3>
                <p className="text-xs text-[#57534e] mt-1">{current.subtitle}</p>
              </div>

              {/* Animated SVG Illustration Box */}
              <div className="my-4 rounded-2xl bg-[#fbf9f3] border border-[#d6cbb5] p-4 flex items-center justify-center h-56 shadow-inner">
                <HandbookIllustration pageNumber={current.pageNumber} />
              </div>

              {/* Bottom Pro Tip Box */}
              <div className="p-3 rounded-xl bg-[#fef3c7] border border-[#f59e0b]/50 text-[11px] text-[#78350f] leading-relaxed font-medium">
                {current.proTip}
              </div>
            </div>

            {/* Right Page: Step-by-Step Operational Instructions */}
            <div className="md:col-span-7 p-6 flex flex-col justify-between bg-[#f7f3e8]">
              <div>
                <p className="text-sm text-[#292524] leading-relaxed mb-5 border-l-4 border-[#d97706] pl-3.5">
                  {current.summary}
                </p>

                <div className="space-y-3">
                  {current.steps.map((step) => (
                    <div
                      key={step.heading}
                      className="p-3.5 rounded-xl bg-[#efe8d6]/75 border border-[#d6cbb5] flex items-start gap-3.5"
                    >
                      <span className="px-2 py-1 rounded-lg bg-[#1c1917] text-[#fbbf24] font-mono-num font-extrabold text-xs shrink-0 mt-0.5">
                        {step.badge}
                      </span>
                      <div>
                        <h4 className="font-display font-bold text-sm text-[#1c1917]">
                          {step.heading}
                        </h4>
                        <p className="text-xs text-[#44403c] mt-0.5 leading-relaxed">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Navigation Controls */}
              <div className="flex items-center justify-between pt-5 mt-6 border-t border-[#d6cbb5]">
                <button
                  type="button"
                  data-testid="handbook-prev-btn"
                  disabled={pageIdx === 0}
                  onClick={() => {
                    engineRef.current?.audio.playMenuClick();
                    setPageIdx((p) => Math.max(0, p - 1));
                  }}
                  className={`px-4 py-2 rounded-xl font-display font-bold text-xs transition-colors ${
                    pageIdx === 0
                      ? 'bg-[#e5dec9] text-[#a8a29e] cursor-not-allowed'
                      : 'bg-[#1c1917] hover:bg-[#292524] text-[#f7f3e8] cursor-pointer'
                  }`}
                >
                  ← Önceki Sayfa
                </button>

                <span
                  data-testid="handbook-page-indicator"
                  className="font-mono-num font-bold text-xs text-[#57534e]"
                >
                  Sayfa {current.pageNumber} / {HANDBOOK_PAGES.length}
                </span>

                <button
                  type="button"
                  data-testid="handbook-next-btn"
                  disabled={pageIdx === HANDBOOK_PAGES.length - 1}
                  onClick={() => {
                    engineRef.current?.audio.playMenuClick();
                    setPageIdx((p) => Math.min(HANDBOOK_PAGES.length - 1, p + 1));
                  }}
                  className={`px-4 py-2 rounded-xl font-display font-bold text-xs transition-colors ${
                    pageIdx === HANDBOOK_PAGES.length - 1
                      ? 'bg-[#e5dec9] text-[#a8a29e] cursor-not-allowed'
                      : 'bg-[#d97706] hover:bg-[#b45309] text-white cursor-pointer'
                  }`}
                >
                  Sonraki Sayfa →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HandbookIllustration: React.FC<{ pageNumber: number }> = ({ pageNumber }) => {
  switch (pageNumber) {
    case 1:
      return (
        <svg viewBox="0 0 260 170" className="w-full h-full">
          {/* Restaurant Loop Diagram: POS -> Kitchen -> Service */}
          <rect
            x="14"
            y="45"
            width="64"
            height="75"
            rx="10"
            fill="#fef3c7"
            stroke="#1c1917"
            strokeWidth="2"
          />
          <text x="46" y="74" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1c1917">
            1. KASA
          </text>
          <text x="46" y="90" textAnchor="middle" fontSize="8" fill="#92400e">
            Sipariş &amp; POS
          </text>

          <path
            d="M82 82 L96 82"
            stroke="#d97706"
            strokeWidth="2.5"
            strokeDasharray="4 2"
          />

          <rect
            x="98"
            y="35"
            width="68"
            height="95"
            rx="12"
            fill="#fde68a"
            stroke="#1c1917"
            strokeWidth="2"
          />
          <text x="132" y="68" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1c1917">
            2. MUTFAK
          </text>
          <circle cx="132" cy="92" r="14" fill="#78350f" />
          <path d="M120 92 Q132 78 144 92" fill="#f59e0b" />

          <path
            d="M170 82 L184 82"
            stroke="#d97706"
            strokeWidth="2.5"
            strokeDasharray="4 2"
          />

          <rect
            x="186"
            y="45"
            width="60"
            height="75"
            rx="10"
            fill="#dcfce7"
            stroke="#1c1917"
            strokeWidth="2"
          />
          <text x="216" y="74" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1c1917">
            3. TESLİM
          </text>
          <text x="216" y="92" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#15803d">
            +$$$ Bahşiş
          </text>
        </svg>
      );

    case 2:
      return (
        <svg viewBox="0 0 260 170" className="w-full h-full">
          {/* Counter Surface & Smart Placement Ghost Silhouette */}
          <polygon
            points="30,125 75,75 215,75 235,125"
            fill="#e7e5e4"
            stroke="#1c1917"
            strokeWidth="2"
          />
          {/* Ghost Amber Target Ring */}
          <ellipse
            cx="135"
            cy="102"
            rx="38"
            ry="14"
            fill="rgba(245, 158, 11, 0.25)"
            stroke="#d97706"
            strokeWidth="2"
            strokeDasharray="5 3"
          >
            <animate
              attributeName="rx"
              values="35;40;35"
              dur="1.8s"
              repeatCount="indefinite"
            />
          </ellipse>
          {/* Floating Ghost Burger Preview */}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,-4; 0,2; 0,-4"
              dur="1.8s"
              repeatCount="indefinite"
            />
            <rect
              x="112"
              y="78"
              width="46"
              height="16"
              rx="6"
              fill="#f59e0b"
              fillOpacity="0.65"
              stroke="#b45309"
              strokeWidth="1.5"
            />
          </g>
          <text x="135" y="42" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#92400e">
            [E] Yüzeye Bırak · [R] 45° Döndür
          </text>
        </svg>
      );

    case 3:
      return (
        <svg viewBox="0 0 260 170" className="w-full h-full">
          {/* Exploded Burger Layer Stack */}
          <g>
            <path d="M90 42 C90 22, 170 22, 170 42 Z" fill="#f59e0b" stroke="#1c1917" strokeWidth="1.8" />
            <text x="215" y="38" fontSize="9" fontWeight="bold" fill="#1c1917">5. Üst Ekmek</text>

            <path d="M84 62 L176 62 L168 70 L130 66 L92 70 Z" fill="#22c55e" stroke="#1c1917" strokeWidth="1.5" />
            <text x="215" y="68" fontSize="9" fontWeight="bold" fill="#15803d">4. Taze Marul</text>

            <polygon points="88,82 172,82 164,92 96,92" fill="#facc15" stroke="#1c1917" strokeWidth="1.5" />
            <text x="215" y="90" fontSize="9" fontWeight="bold" fill="#b45309">3. Peynir</text>

            <rect x="86" y="102" width="88" height="16" rx="7" fill="#78350f" stroke="#1c1917" strokeWidth="1.8" />
            <text x="215" y="114" fontSize="9" fontWeight="bold" fill="#78350f">2. Pişmiş Köfte</text>

            <rect x="90" y="128" width="80" height="16" rx="6" fill="#d97706" stroke="#1c1917" strokeWidth="1.8" />
            <text x="215" y="140" fontSize="9" fontWeight="bold" fill="#1c1917">1. Alt Ekmek</text>
          </g>
        </svg>
      );

    case 4:
      return (
        <svg viewBox="0 0 260 170" className="w-full h-full">
          {/* Physical Service Tray with Burger + Soda Slot */}
          <rect
            x="35"
            y="78"
            width="190"
            height="64"
            rx="12"
            fill="#292524"
            stroke="#1c1917"
            strokeWidth="2.5"
          />
          <rect
            x="45"
            y="86"
            width="170"
            height="48"
            rx="8"
            fill="#f5efe2"
            stroke="#d97706"
            strokeWidth="1.5"
          />
          {/* Burger on Left Slot */}
          <circle cx="98" cy="110" r="22" fill="#f59e0b" stroke="#1c1917" strokeWidth="1.8" />
          <text x="98" y="113" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1c1917">
            BURGER
          </text>
          {/* Soda Cup on Right Slot */}
          <rect x="152" y="92" width="28" height="34" rx="5" fill="#dc2626" stroke="#1c1917" strokeWidth="1.8" />
          <line x1="166" y1="92" x2="174" y2="75" stroke="#1c1917" strokeWidth="2.5" />
          <text x="130" y="45" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1c1917">
            SERVİS TEPSİSİ = BURGER + İÇECEK
          </text>
        </svg>
      );

    case 5:
      return (
        <svg viewBox="0 0 260 170" className="w-full h-full">
          {/* Patience Meter & Rush Hour Graph */}
          <rect x="30" y="42" width="200" height="22" rx="11" fill="#e7e5e4" stroke="#1c1917" strokeWidth="2" />
          <rect x="33" y="45" width="145" height="16" rx="8" fill="#16a34a">
            <animate attributeName="width" values="185;95;185" dur="3s" repeatCount="indefinite" />
          </rect>
          <text x="130" y="32" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1c1917">
            MÜŞTERİ SABIR ÇUBUĞU
          </text>
          <rect x="42" y="86" width="176" height="54" rx="10" fill="#fef3c7" stroke="#d97706" strokeWidth="1.8" />
          <text x="130" y="108" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#92400e">
            ÖĞLE YOĞUNLUĞU (RUSH HOUR)
          </text>
          <text x="130" y="126" textAnchor="middle" fontSize="9" fill="#1c1917">
            Hızlı Teslimat = Yüksek Bahşiş + ★ İtibar
          </text>
        </svg>
      );

    case 6:
      return (
        <svg viewBox="0 0 260 170" className="w-full h-full">
          {/* Restaurant Upgrades Trio */}
          <rect x="20" y="45" width="66" height="85" rx="10" fill="#fef3c7" stroke="#1c1917" strokeWidth="2" />
          <text x="53" y="75" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1c1917">
            HIZLI IZGARA
          </text>
          <text x="53" y="96" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#d97706">
            4.5 sn
          </text>

          <rect x="97" y="45" width="66" height="85" rx="10" fill="#dcfce7" stroke="#1c1917" strokeWidth="2" />
          <text x="130" y="75" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1c1917">
            DEKOR
          </text>
          <text x="130" y="96" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#15803d">
            +★ İtibar
          </text>

          <rect x="174" y="45" width="66" height="85" rx="10" fill="#e0f2fe" stroke="#1c1917" strokeWidth="2" />
          <text x="207" y="75" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1c1917">
            SOĞUK DEPO
          </text>
          <text x="207" y="96" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0369a1">
            60 Stok
          </text>
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 260 170" className="w-full h-full">
          {/* Booth Table -> Dirty Tray -> Bussing Station +5$ */}
          <rect
            x="16"
            y="42"
            width="105"
            height="86"
            rx="10"
            fill="#fef3c7"
            stroke="#1c1917"
            strokeWidth="2"
          />
          <text x="68" y="64" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1c1917">
            1. KABİN MASASI
          </text>
          {/* Dirty Tray Icon */}
          <rect
            x="38"
            y="76"
            width="60"
            height="34"
            rx="6"
            fill="#44403c"
            stroke="#d97706"
            strokeWidth="1.5"
          />
          <circle cx="56" cy="93" r="8" fill="#d6c5a3" />
          <rect x="74" y="83" width="12" height="18" rx="3" fill="#dc2626" />

          {/* Animated Arrow to Bussing Station */}
          <path
            d="M126 85 L146 85"
            stroke="#d97706"
            strokeWidth="2.5"
            strokeDasharray="4 2"
          />

          <rect
            x="150"
            y="42"
            width="94"
            height="86"
            rx="10"
            fill="#dcfce7"
            stroke="#1c1917"
            strokeWidth="2"
          />
          <text x="197" y="64" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1c1917">
            2. TEPSİ DÖNÜŞ
          </text>
          <text x="197" y="88" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#15803d">
            +5 $ Bahşiş
          </text>
          <text x="197" y="106" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#047857">
            +1 ★ İtibar
          </text>
        </svg>
      );
  }
};

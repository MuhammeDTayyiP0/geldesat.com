/** Neighborhood options for the larger districts (copy of web/src/lib/data/geo.ts). */
export const NEIGHBORHOODS: Record<string, Record<string, string[]>> = {
  Adana: {
    Seyhan: ["Reşatbey", "Çınarlı", "Gülbahçesi", "Ziyapaşa"],
    Çukurova: ["Yüzüncü Yıl", "Toros", "Mahfesığmaz", "Belediye Evleri"],
    Sarıçam: ["Remzi Oğuz Arık", "Sofulu"],
    Yüreğir: ["Kazım Karabekir", "Dervişler"],
  },
  İstanbul: {
    Kadıköy: ["Moda", "Caddebostan", "Fenerbahçe", "Göztepe", "Koşuyolu"],
    Beşiktaş: ["Levent", "Etiler", "Ortaköy", "Bebek"],
    Üsküdar: ["Çengelköy", "Kuzguncuk", "Acıbadem"],
    Şişli: ["Nişantaşı", "Mecidiyeköy", "Osmanbey"],
    Sarıyer: ["Tarabya", "Yeniköy", "İstinye"],
    Pendik: ["Kaynarca", "Kurtköy"],
  },
  Ankara: {
    Çankaya: ["Kızılay", "Çukurambar", "Oran", "Gaziosmanpaşa"],
    Yenimahalle: ["Batıkent", "Demetevler"],
    Keçiören: ["Etlik", "Ovacık"],
  },
  İzmir: {
    Karşıyaka: ["Bostanlı", "Mavişehir"],
    Bornova: ["Erzene", "Kazımdirik"],
    Konak: ["Alsancak", "Güzelyalı"],
    Çeşme: ["Alaçatı", "Ilıca"],
  },
};


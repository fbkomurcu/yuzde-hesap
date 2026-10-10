// Yüzde Hesap — hesaplar ve Türkçe sayı biçimi.
// Android'deki Bicim.kt + Hesaplar.kt ile birebir aynı davranır; iki tarafta da aynı örnekler test edilir
// (web/test/hesaplar.test.mjs ↔ app/src/test/.../HesaplarTest.kt). Bir işlem eklerken İKİSİNE de ekle.

/** Ekranda gösterilen eksi işareti (tipografik eksi). Panoya kopyalanırken "-" yapılır. */
export const EKSI = "−";

const GECERLI_HAM = /^-?\d{0,15}(,\d{0,10})?$/;

// ---------- Sayı okuma / giriş ----------

/** Ham metni ("1250000,5") sayıya çevirir; boş, yalnız "-" veya yalnız "," ise null. */
export function sayiOku(ham) {
  const t = ham.trim();
  if (t === "" || t === "-" || t === "," || t === "-,") return null;
  const d = Number(t.replace(",", "."));
  return Number.isFinite(d) ? d : null;
}

/** Klavyeden gelen yeni ham metni uydurur: nokta virgüle; olmazsa yapıştırılmış biçimli metin gibi dener; o da olmazsa eski kalır. */
export function girisDuzelt(eski, yeni) {
  const aday = yeni.replaceAll(".", ",");
  if (GECERLI_HAM.test(aday)) return aday;
  const yapistirma = yeni.trim().replaceAll(" ", "").replaceAll(EKSI, "-").replaceAll("%", "").replaceAll(".", "");
  if (GECERLI_HAM.test(yapistirma)) return yapistirma;
  return eski;
}

/** Ham metne binlik noktaları ekler ve imleç konumlarını iki yönde eşler (Android: BinlikAyirici). */
export function esle(ham) {
  const isaret = ham.startsWith("-") ? 1 : 0;
  const v = ham.indexOf(",");
  const virgul = v < 0 ? ham.length : v;
  const tamUzunluk = virgul - isaret;
  let gorunen = "";
  const hamdanGorunene = new Array(ham.length + 1);
  const gorunenden = [];
  for (let i = 0; i < ham.length; i++) {
    const sira = i - isaret;
    if (i >= isaret && i < virgul && sira > 0 && (tamUzunluk - sira) % 3 === 0) {
      gorunenden.push(i);
      gorunen += ".";
    }
    hamdanGorunene[i] = gorunen.length;
    gorunenden.push(i);
    gorunen += ham[i];
  }
  hamdanGorunene[ham.length] = gorunen.length;
  gorunenden.push(ham.length);
  return { gorunen, hamdanGorunene, gorunenden };
}

// ---------- Biçimleme ----------

/** Sayıyı düz ondalık metne çevirir (üssüz). Java'daki BigDecimal.valueOf(d) gibi en kısa gösterimden başlar. */
function duzMetin(d) {
  const a = Math.abs(d);
  if (a !== 0 && a < 1e-6) return "0";
  if (a >= 1e21) return BigInt(Math.round(a)).toString();
  return String(a);
}

/** HALF_UP yuvarlama, metin üzerinde (kayan nokta hatası olmadan). */
function yuvarla(duz, ondalik) {
  let [tam, kesir = ""] = duz.split(".");
  if (kesir.length <= ondalik) return { tam, kesir: kesir.padEnd(ondalik, "0") };
  const yukari = kesir.charCodeAt(ondalik) - 48 >= 5;
  let rakamlar = BigInt(tam + kesir.slice(0, ondalik));
  if (yukari) rakamlar += 1n;
  const s = rakamlar.toString().padStart(ondalik + 1, "0");
  return { tam: s.slice(0, s.length - ondalik), kesir: s.slice(s.length - ondalik) };
}

function grupla(r) {
  if (r.length <= 3) return r;
  let s = "";
  for (let i = 0; i < r.length; i++) {
    if (i > 0 && (r.length - i) % 3 === 0) s += ".";
    s += r[i];
  }
  return s;
}

function yaz(d, ondalik, sabitOndalik) {
  if (!Number.isFinite(d)) throw new RangeError("sonsuz");
  let { tam, kesir } = yuvarla(duzMetin(d), ondalik);
  if (!sabitOndalik) kesir = kesir.replace(/0+$/, "");
  const sifir = /^0*$/.test(tam) && /^0*$/.test(kesir);
  const metin = grupla(tam) + (kesir ? "," + kesir : "");
  return d < 0 && !sifir ? EKSI + metin : metin;
}

/** Tutar: her zaman 2 ondalık. 1250 → "1.250,00", -1900 → "−1.900,00". */
export const tutar = (d) => yaz(d, 2, true);

/** Yüzde: başta %, en çok 2 ondalık. 78.5714 → "%78,57", 47.5 → "%47,5", -90.476 → "−%90,48". */
export function yuzde(d) {
  const m = yaz(d, 2, false);
  return m.startsWith(EKSI) ? EKSI + "%" + m.slice(1) : "%" + m;
}

export const panoMetni = (s) => s.replaceAll(EKSI, "-");

// ---------- Sonuç ----------

export const BOS = Object.freeze({ metin: "—", not: null, uyari: null, hata: false });
const hataSonuc = (aciklama) => ({ metin: "—", not: aciklama, uyari: null, hata: true });
const S = (metin, not = null, uyari = null) => ({ metin, not, uyari, hata: false });

function oran(bolen, bolenAdi, hesap) {
  return bolen === 0 ? hataSonuc(`${bolenAdi} rakam 0 olamaz`) : hesap();
}

/** Soru ters düştüyse (sonuç eksi) uyarır: "Sol sağdan eksik değil, %90,48 fazla". */
function yonlu(d, ozne, beklenen, ters) {
  const m = yuzde(d);
  return m.startsWith(EKSI) ? S(m, null, `${ozne} ${beklenen} değil, ${yuzde(-d)} ${ters}`) : S(m);
}

// ---------- 1. sekme: a = rakam, b = yüzde ----------

export const YUZDE_ISLEMLERI = [
  { ad: "%'si ne kadar", kisaAd: "%'si", hesapla: (a, b) => S(tutar((a * b) / 100)) },
  { ad: "Kârlı hali", kisaAd: "Kârlı hali", hesapla: (a, b) => { const k = (a * b) / 100; return S(tutar(a + k), `Kâr: ${tutar(k)}`); } },
  { ad: "Zamlı / KDV dahil hali", kisaAd: "Zamlı / KDV'li", hesapla: (a, b) => { const z = (a * b) / 100; return S(tutar(a + z), `Zam / KDV: ${tutar(z)}`); } },
  { ad: "Çıkmış hali", kisaAd: "Çıkmış hali", hesapla: (a, b) => { const c = (a * b) / 100; return S(tutar(a - c), `Çıkan: ${tutar(c)}`); } },
  { ad: "İndirimli hali", kisaAd: "İndirimli", hesapla: (a, b) => { const i = (a * b) / 100; return S(tutar(a - i), `İndirim: ${tutar(i)}`); } },
  { ad: "İskontosu", kisaAd: "İskontosu", hesapla: (a, b) => { const i = (a * b) / 100; return S(tutar(i), `İskontolu hali: ${tutar(a - i)}`); } },
  {
    ad: "İçinden çıkar (KDV hariç)", kisaAd: "KDV hariç",
    hesapla: (a, b) => {
      const bolen = 1 + b / 100;
      if (bolen === 0) return hataSonuc("%-100 ile içinden çıkarılamaz");
      const h = a / bolen;
      return S(tutar(h), `İçindeki %: ${tutar(a - h)}`);
    },
  },
  {
    ad: "İçindeki % tutarı (KDV'si)", kisaAd: "İçindeki KDV",
    hesapla: (a, b) => {
      const bolen = 1 + b / 100;
      if (bolen === 0) return hataSonuc("%-100 ile hesaplanamaz");
      const h = a / bolen;
      return S(tutar(a - h), `Hariç tutar: ${tutar(h)}`);
    },
  },
  {
    ad: "İndirimden önceki hali", kisaAd: "İndirimden önce",
    hesapla: (a, b) => {
      const bolen = 1 - b / 100;
      if (bolen === 0) return hataSonuc("%100 indirimde eski fiyat bulunamaz");
      const e = a / bolen;
      return S(tutar(e), `İndirim: ${tutar(e - a)}`);
    },
  },
  {
    ad: "Hangi sayının %'si", kisaAd: "Hangi sayının",
    hesapla: (a, b) => (b === 0 ? hataSonuc("Yüzde 0 olunca bulunamaz") : S(tutar((a * 100) / b))),
  },
];

// ---------- 2. sekme: a = sol, b = sağ ----------

export const KARSILASTIRMA_SORULARI = [
  { ad: "Sol, sağın yüzde kaçı", kisaAd: "Sol, sağın %?", hesapla: (a, b) => oran(b, "Sağ", () => S(yuzde((a / b) * 100))) },
  { ad: "Sol, sağdan % kaç fazla", kisaAd: "Sol % fazla?", hesapla: (a, b) => oran(b, "Sağ", () => yonlu(((a - b) / b) * 100, "Sol sağdan", "fazla", "eksik")) },
  { ad: "Sol, sağdan % kaç eksik", kisaAd: "Sol % eksik?", hesapla: (a, b) => oran(b, "Sağ", () => yonlu(((b - a) / b) * 100, "Sol sağdan", "eksik", "fazla")) },
  { ad: "Sağ, solun yüzde kaçı", kisaAd: "Sağ, solun %?", hesapla: (a, b) => oran(a, "Sol", () => S(yuzde((b / a) * 100))) },
  { ad: "Sağ, soldan % kaç fazla", kisaAd: "Sağ % fazla?", hesapla: (a, b) => oran(a, "Sol", () => yonlu(((b - a) / a) * 100, "Sağ soldan", "fazla", "eksik")) },
  { ad: "Sağ, soldan % kaç eksik", kisaAd: "Sağ % eksik?", hesapla: (a, b) => oran(a, "Sol", () => yonlu(((a - b) / a) * 100, "Sağ soldan", "eksik", "fazla")) },
  {
    ad: "Değişim (eski sol → yeni sağ)", kisaAd: "Değişim",
    hesapla: (a, b) => oran(a, "Sol", () => {
      const d = ((b - a) / a) * 100;
      const yon = yuzde(Math.abs(d)) === "%0" ? "Değişim yok" : d > 0 ? `${yuzde(d)} artış` : `${yuzde(-d)} azalış`;
      return S(yuzde(d), yon);
    }),
  },
  { ad: "Aradaki fark (sol − sağ)", kisaAd: "Fark", hesapla: (a, b) => S(tutar(a - b)) },
];

/** Kutulardaki ham metinlerden sonucu verir; kutulardan biri boşsa boş sonuç. Hiçbir durumda hata fırlatmaz. */
export function hesapla(islem, ham1, ham2) {
  const a = sayiOku(ham1);
  const b = sayiOku(ham2);
  if (a === null || b === null) return BOS;
  try {
    return islem.hesapla(a, b);
  } catch {
    return hataSonuc("Sayı çok büyük");
  }
}

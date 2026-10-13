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

/** Hesap makinesi ara sonucu: en çok 2 ondalık, sondaki sıfırlar atılır. 3500 → "3.500", 47.5 → "47,5". */
export const sade = (d) => yaz(d, 2, false);

// ---------- Tam ondalık sayı (Android'deki BigDecimal'in küçüğü): { n: BigInt, s: ölçek } → n / 10^s ----------

/** Ham metni yazıldığı gibi (yuvarlamasız) ondalığa çevirir; boşsa null. "1250," → 1250, ",5" → 0,5. */
export function ondalikOku(ham) {
  if (sayiOku(ham) === null) return null;
  let t = ham.trim().replace(/,$/, "");
  const eksi = t.startsWith("-");
  if (eksi) t = t.slice(1);
  const [tam, kesir = ""] = t.split(",");
  return { n: BigInt((eksi ? "-" : "") + (tam || "0") + kesir), s: kesir.length };
}

const ond = (n) => ({ n: BigInt(n), s: 0 });
function topla(x, y) {
  const s = Math.max(x.s, y.s);
  return { n: x.n * 10n ** BigInt(s - x.s) + y.n * 10n ** BigInt(s - y.s), s };
}
const cikar = (x, y) => topla(x, { n: -y.n, s: y.s });

/**
 * Hesap makinesi tuşundaki rakam: yuvarlamasız, binlik noktalı. [minOndalik] çarpanlar için: 1,2 → "1,20".
 * Örnek: 5000 → "5.000", 0,925 → "0,925", -12 → "−12".
 */
export function tusMetni(x, minOndalik = 0) {
  const r = (x.n < 0n ? -x.n : x.n).toString().padStart(x.s + 1, "0");
  const tam = r.slice(0, r.length - x.s);
  const kesir = r.slice(r.length - x.s).replace(/0+$/, "").padEnd(minOndalik, "0");
  const sifir = /^0*$/.test(tam + kesir);
  return (x.n < 0n && !sifir ? EKSI : "") + grupla(tam) + (kesir ? "," + kesir : "");
}

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

// ---------- Hesap makinesi ----------
// Sıradan hesap makinesinde (işlem önceliği bilmeyen) tuş sırası. % tuşu kullanılmaz, yüzde çarpana çevrilir.
// Tuş: { metin, rakam } — rakam ise metin yazılacak sayıdır ("5.000", "0,70"), değilse işlem tuşudur ("×", "=").

const YUZ = ond(100);
const BIR = ond(1);
/** %20 → 0,20 (tam, yuvarlamasız). */
const oranOf = (b) => ({ n: b.n, s: b.s + 2 });
/** Açıklamadaki yüzde: "%20", "%7,5". */
const y = (b) => "%" + tusMetni(b);
/** Çarpan metni en az 2 ondalıklı: 0,7 → "0,70". */
const c = (x) => tusMetni(x, 2);
const r = (x) => ({ metin: tusMetni(x), rakam: true });
const cr = (x) => ({ metin: c(x), rakam: true });
const islemTusu = (m) => ({ metin: m, rakam: false });
/** Tuş metnindeki sayı: "−1.250,5" → -1250.5. */
const tusDegeri = (m) => Number(m.replaceAll(".", "").replace(",", ".").replace(EKSI, "-"));
/** Ara sonucu sonraki adımda elle yazmak gerekirse: ekranda görüldüğü gibi 2 ondalığa yuvarlanmış hali. */
const yazilan = (d) => ondalikOku(sade(d).replaceAll(".", "").replace(EKSI, "-"));

/** Basılacak tuş sayısı: her rakam, virgül, eksi ve işlem tuşu birer tuş. */
export const tusSayisi = (hm) =>
  hm.adimlar.reduce((t, a) => t + a.tuslar.reduce((u, k) => u + (k.rakam ? k.metin.replaceAll(".", "").length : 1), 0), 0);

/**
 * Tuş sırası kurar; her adımın ara sonucunu tuşları gerçek hesap makinesine (HesapMotoru) tek tek basarak bulur:
 * soldan sağa, işlem önceliği yok. Rakamla başlayan adım yeni hesaptır; işlemle başlayan adım ekrandaki sonuçtan devam eder.
 */
class TusSirasi {
  adimlar = [];
  motor = new HesapMotoru();
  get sonuc() { return this.motor.deger; }

  /** parcalar: rakam tuşu ya da işlem karakteri (+ − × ÷); sona [=] eklenir. */
  adim(...parcalar) {
    const tuslar = [...parcalar.map((p) => (typeof p === "string" ? islemTusu(p) : p)), islemTusu("=")];
    for (const t of tuslar) for (const b of basimlar(t)) this.motor.bas(b);
    // Sıfıra bölme vb.: hesap yapılamıyor (hesapMakinesi null döner).
    if (this.motor.hata) throw new RangeError("Hesap makinesinde hata");
    this.adimlar.push({ tuslar, araSonuc: sade(this.motor.deger) });
    return this;
  }

  bitir(aciklama, casio = null) {
    return { adimlar: this.adimlar, aciklama, casio };
  }
}

const sira = () => new TusSirasi();

/** Rakam × çarpan. Casio kısa yolu: [a] [×/+/−] [b] [%]; yüzde eksiyse gösterilmez. */
function carpimla(a, b, carpan, aciklama, casio) {
  const kisaYol = b.n >= 0n ? [r(a), islemTusu(casio), r(b), islemTusu("%")] : null;
  return sira().adim(r(a), "×", cr(carpan)).bitir(aciklama, kisaYol);
}

// ---------- Hesap makinesi paneli (Android: HesapMotoru.kt) ----------
// Masa tipi basit hesap makinesi: tuşlar soldan sağa işlenir, işlem önceliği yoktur (2 + 3 × 4 = 20).
// Paneldeki hesap makinesi de satırlardaki "hesap makinesi adımları" da bunu kullanır.
// Tuşlar: "0".."9", ",", "+", "−", "×", "÷", "=", "%", "C", "⌫", "±".
// % Casio gibi: A × B % = A'nın %B'si, A + B % = %B eklenmiş, A − B % = %B düşülmüş, A ÷ B % = A / (B/100), tek başına B % = B/100.

export const GECMIS_SINIRI = 20;
const EN_COK_HANE = 25;
const TASMA = 1e18;

/** Ekrandaki sayı: binlik noktalı, en çok 10 ondalık ve toplam 15 hane; sondaki sıfırlar atılır. 1/3 → "0,3333333333". */
export function sayiMetni(d) {
  const a = Math.abs(d);
  const tamHane = String(Math.trunc(a)).length;
  const ondalik = Math.min(10, Math.max(0, 15 - tamHane));
  const duz = a !== 0 && a < 1e-6 ? a.toFixed(20) : String(a);
  let { tam, kesir } = yuvarla(duz, ondalik);
  kesir = kesir.replace(/0+$/, "");
  const sifir = /^0*$/.test(tam) && kesir === "";
  return (d < 0 && !sifir ? EKSI : "") + grupla(tam.replace(/^0+(?=\d)/, "")) + (kesir ? "," + kesir : "");
}

/** Sayının kutuya yazılabilir ham hali: -1250.5 → "-1250,5". */
export const hamYaz = (d) => panoMetni(sayiMetni(d)).replaceAll(".", "");

const hamDeger = (ham) => Number(ham.replace(",", ".").replace(/\.$/, ""));

/** Yazılmakta olan ham sayıyı gösterir: "-1250,70" → "−1.250,70", "0," → "0,". */
function hamGoster(ham) {
  const eksi = ham.startsWith("-");
  const t = eksi ? ham.slice(1) : ham;
  const v = t.indexOf(",");
  const tam = v < 0 ? t : t.slice(0, v);
  const kalan = v < 0 ? "" : t.slice(v);
  return (eksi ? EKSI : "") + grupla(tam) + kalan;
}

/** Bir rakam tuşunun tek tek basımları: "5.000" → 5 0 0 0, "0,70" → 0 , 7 0, "−12" → 1 2 ±. İşlem tuşu olduğu gibi. */
export function basimlar(tus) {
  if (!tus.rakam) return [tus.metin];
  const eksi = tus.metin.startsWith(EKSI);
  const rakamlar = [...(eksi ? tus.metin.slice(1) : tus.metin)].filter((c) => c !== ".");
  return eksi ? [...rakamlar, "±"] : rakamlar;
}

/** "▶ Hesap makinesinde göster"in oynattığı basımlar, adım adım; ilk adım [C] ile başlar. Testler de bunu çalıştırır. */
export const oynatma = (hm) => hm.adimlar.map((adim, i) => [...(i === 0 ? ["C"] : []), ...adim.tuslar.flatMap(basimlar)]);

export class HesapMotoru {
  giris = null; // yazılmakta olan sayı, ham ("-12,5"); null ise ekranda deger görünür
  deger = 0;
  birikim = null;
  bekleyen = null;
  sonIslem = null; // art arda "=" için: 100 + 10 = = → 120
  sonSag = 0;
  esittirSonrasi = false;
  ifade = [];
  hata = false;
  gecmis = []; // en yenisi başta: { ifade, sonuc, deger }

  get ifadeMetni() { return this.ifade.join(" "); }
  get ekranMetni() { return this.hata ? "Hata" : this.giris !== null ? hamGoster(this.giris) : sayiMetni(this.deger); }
  get ekrandaki() { return this.giris !== null ? hamDeger(this.giris) : this.deger; }

  bas(tus) {
    if (this.hata) {
      this.temizle();
      // Hata ekranında rakam/virgül yeni sayıyı başlatır; diğer tuşlar yalnızca temizler.
      if (!/^[0-9,]$/.test(tus)) return;
    }
    if (tus === "C") this.temizle();
    else if (tus === "⌫") this.#geriSil();
    else if (tus === "±") this.#isaretDegistir();
    else if (tus === "=") this.#esittir();
    else if (tus === "%") this.#yuzde();
    else if ("+−×÷".includes(tus) && tus.length === 1) this.#islem(tus);
    else if (tus === ",") this.#virgul();
    else if (/^[0-9]$/.test(tus)) this.#rakam(tus);
    else throw new Error("Bilinmeyen tuş: " + tus);
  }

  /** Dışarıdan sayı getirir (satır sonucu, geçmiş): sonuç gibi ekrana yazılır, üzerine işlem yapılabilir. */
  aktar(sayi, aciklama = null) {
    this.temizle();
    this.deger = sayi;
    this.esittirSonrasi = true;
    if (aciklama) this.ifade.push(aciklama);
  }

  temizle() {
    this.giris = null;
    this.deger = 0;
    this.birikim = null;
    this.bekleyen = null;
    this.sonIslem = null;
    this.esittirSonrasi = false;
    this.ifade = [];
    this.hata = false;
  }

  #yeniGirisGerekirse() {
    if (this.giris === null && this.esittirSonrasi) {
      this.ifade = [];
      this.esittirSonrasi = false;
      this.sonIslem = null;
    }
    return this.giris ?? "";
  }

  #rakam(c) {
    const g = this.#yeniGirisGerekirse();
    if (g.replace(/\D/g, "").length >= EN_COK_HANE) return;
    this.giris = g === "0" ? c : g === "-0" ? "-" + c : g + c;
  }

  #virgul() {
    const g = this.#yeniGirisGerekirse();
    if (g.includes(",")) return;
    this.giris = g === "" || g === "-" ? g + "0," : g + ",";
  }

  #geriSil() {
    if (this.giris === null) return;
    const kalan = this.giris.slice(0, -1);
    this.giris = kalan === "" || kalan === "-" ? "0" : kalan;
  }

  #isaretDegistir() {
    if (this.giris !== null) {
      this.giris = this.giris.startsWith("-") ? this.giris.slice(1) : "-" + this.giris;
      return;
    }
    if (this.esittirSonrasi) {
      this.ifade = [];
      this.esittirSonrasi = false;
    }
    this.giris = hamYaz(-this.deger);
  }

  #islem(op) {
    if (this.giris !== null) {
      const x = hamDeger(this.giris);
      this.ifade.push(hamGoster(this.giris));
      if (this.birikim !== null && this.bekleyen !== null) {
        const r = this.#uygula(this.birikim, this.bekleyen, x);
        if (r === null) return;
        this.birikim = r;
      } else this.birikim = x;
    } else if (this.bekleyen !== null) {
      // İşlem tuşunu değiştirmek: 5 × → 5 ÷
      this.ifade[this.ifade.length - 1] = op;
      this.bekleyen = op;
      return;
    } else {
      this.ifade = [sayiMetni(this.deger)];
      this.birikim = this.deger;
    }
    this.ifade.push(op);
    this.bekleyen = op;
    this.giris = null;
    this.deger = this.birikim;
    this.esittirSonrasi = false;
  }

  #esittir() {
    if (this.bekleyen !== null && this.birikim !== null) {
      // "5 × =" gibi sağ taraf yazılmadıysa ekrandaki değer kullanılır (5 × 5).
      const x = this.giris !== null ? hamDeger(this.giris) : this.deger;
      this.ifade.push(this.giris !== null ? hamGoster(this.giris) : sayiMetni(x));
      const op = this.bekleyen;
      const r = this.#uygula(this.birikim, op, x);
      if (r === null) return;
      this.sonIslem = op;
      this.sonSag = x;
      this.#bitir(r);
    } else if (this.esittirSonrasi && this.sonIslem !== null && this.giris === null) {
      const sol = this.deger;
      const op = this.sonIslem;
      this.ifade = [sayiMetni(sol), op, sayiMetni(this.sonSag)];
      const r = this.#uygula(sol, op, this.sonSag);
      if (r !== null) this.#bitir(r);
    } else {
      const x = this.ekrandaki;
      this.ifade = [sayiMetni(x), "="];
      this.giris = null;
      this.deger = x;
      this.esittirSonrasi = true;
    }
  }

  #yuzde() {
    const x = this.ekrandaki;
    if (this.bekleyen !== null && this.birikim !== null) {
      const b = this.birikim;
      this.ifade.push(this.giris !== null ? hamGoster(this.giris) : sayiMetni(x), "%");
      const op = this.bekleyen;
      const r = op === "×" ? this.#uygula(b, "×", x / 100)
        : op === "+" ? this.#uygula(b, "+", (b * x) / 100)
          : op === "−" ? this.#uygula(b, "−", (b * x) / 100)
            : this.#uygula(b, "÷", x / 100);
      if (r === null) return;
      this.sonIslem = null;
      this.#bitir(r);
    } else {
      // Tek başına: 20 % → 0,2 (yazılmış sayı gibi, üzerine işlem yapılabilir).
      if (this.esittirSonrasi) {
        this.ifade = [];
        this.esittirSonrasi = false;
        this.sonIslem = null;
      }
      this.giris = hamYaz(x / 100);
    }
  }

  #bitir(sonuc) {
    this.ifade.push("=");
    this.deger = sonuc;
    this.giris = null;
    this.birikim = null;
    this.bekleyen = null;
    this.esittirSonrasi = true;
    this.gecmis.unshift({ ifade: this.ifadeMetni, sonuc: sayiMetni(sonuc), deger: sonuc });
    if (this.gecmis.length > GECMIS_SINIRI) this.gecmis.length = GECMIS_SINIRI;
  }

  /** Sıfıra bölme ya da taşmada hata ekranı açar ve null döner. */
  #uygula(a, op, b) {
    const r = op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : b === 0 ? NaN : a / b;
    if (!Number.isFinite(r) || Math.abs(r) >= TASMA) {
      this.temizle(); // geçmiş kalır
      this.hata = true;
      return null;
    }
    return r;
  }
}

// ---------- 1. sekme: a = rakam, b = yüzde ----------
// Her işlem: ad + Excel formülü (A2 = 1. kutu, B2 = 2. kutu; fonksiyonsuz, Türkçe/İngilizce Excel'de aynen çalışır) + hesap
// + hesap makinesi tuşları (a, b kutulara yazıldığı gibi, yuvarlamasız ondalık).

export const YUZDE_ISLEMLERI = [
  { ad: "%'si ne kadar", kisaAd: "%'si", formul: "=A2*B2", hesapla: (a, b) => S(tutar((a * b) / 100)), tuslar: (a, b) => carpimla(a, b, oranOf(b), `Yüzdesi = rakamı ${c(oranOf(b))} ile çarpmak`, "×") },
  { ad: "Kârlı hali", kisaAd: "Kârlı hali", formul: "=A2*(1+B2)", hesapla: (a, b) => { const k = (a * b) / 100; return S(tutar(a + k), `Kâr: ${tutar(k)}`); }, tuslar: (a, b) => carpimla(a, b, topla(BIR, oranOf(b)), `${y(b)} kâr = rakamı ${c(topla(BIR, oranOf(b)))} ile çarpmak`, "+") },
  { ad: "Zamlı / KDV dahil hali", kisaAd: "Zamlı / KDV'li", formul: "=A2*(1+B2)", hesapla: (a, b) => { const z = (a * b) / 100; return S(tutar(a + z), `Zam / KDV: ${tutar(z)}`); }, tuslar: (a, b) => carpimla(a, b, topla(BIR, oranOf(b)), `${y(b)} zam / KDV = rakamı ${c(topla(BIR, oranOf(b)))} ile çarpmak`, "+") },
  { ad: "Çıkmış hali", kisaAd: "Çıkmış hali", formul: "=A2*(1-B2)", hesapla: (a, b) => { const c = (a * b) / 100; return S(tutar(a - c), `Çıkan: ${tutar(c)}`); }, tuslar: (a, b) => carpimla(a, b, cikar(BIR, oranOf(b)), `${y(b)} çıkınca = rakamı ${c(cikar(BIR, oranOf(b)))} ile çarpmak`, "−") },
  { ad: "İndirimli hali", kisaAd: "İndirimli", formul: "=A2*(1-B2)", hesapla: (a, b) => { const i = (a * b) / 100; return S(tutar(a - i), `İndirim: ${tutar(i)}`); }, tuslar: (a, b) => carpimla(a, b, cikar(BIR, oranOf(b)), `${y(b)} indirim = rakamı ${c(cikar(BIR, oranOf(b)))} ile çarpmak`, "−") },
  { ad: "İskontosu", kisaAd: "İskontosu", formul: "=A2*B2", hesapla: (a, b) => { const i = (a * b) / 100; return S(tutar(i), `İskontolu hali: ${tutar(a - i)}`); }, tuslar: (a, b) => carpimla(a, b, oranOf(b), `${y(b)} iskonto = rakamı ${c(oranOf(b))} ile çarpmak`, "×") },
  {
    ad: "İçinden çıkar (KDV hariç)", kisaAd: "KDV hariç", formul: "=A2/(1+B2)",
    hesapla: (a, b) => {
      const bolen = 1 + b / 100;
      if (bolen === 0) return hataSonuc("%-100 ile içinden çıkarılamaz");
      const h = a / bolen;
      return S(tutar(h), `İçindeki %: ${tutar(a - h)}`);
    },
    tuslar: (a, b) => sira().adim(r(a), "÷", cr(topla(BIR, oranOf(b)))).bitir(`${y(b)} içinden çıkar = rakamı ${c(topla(BIR, oranOf(b)))} ile bölmek`),
  },
  {
    ad: "İçindeki % tutarı (KDV'si)", kisaAd: "İçindeki KDV", formul: "=A2*B2/(1+B2)",
    hesapla: (a, b) => {
      const bolen = 1 + b / 100;
      if (bolen === 0) return hataSonuc("%-100 ile hesaplanamaz");
      const h = a / bolen;
      return S(tutar(a - h), `Hariç tutar: ${tutar(h)}`);
    },
    // İki yol var; hangisinde daha az tuşa basılıyorsa o gösterilir.
    tuslar: (a, b) => {
      const iki = sira();
      iki.adim(r(a), "÷", cr(topla(BIR, oranOf(b))));
      iki.adim(r(a), "−", r(yazilan(iki.sonuc)));
      const ikiAdim = iki.bitir(`Önce ${y(b)} hariç tutarı bul, sonra rakamdan çıkar`);
      const tekAdim = sira().adim(r(a), "×", r(b), "÷", r(topla(YUZ, b))).bitir(`İçindeki ${y(b)} = rakam × ${tusMetni(b)} ÷ ${tusMetni(topla(YUZ, b))}`);
      return tusSayisi(ikiAdim) < tusSayisi(tekAdim) ? ikiAdim : tekAdim;
    },
  },
  {
    ad: "İndirimden önceki hali", kisaAd: "İndirimden önce", formul: "=A2/(1-B2)",
    hesapla: (a, b) => {
      const bolen = 1 - b / 100;
      if (bolen === 0) return hataSonuc("%100 indirimde eski fiyat bulunamaz");
      const e = a / bolen;
      return S(tutar(e), `İndirim: ${tutar(e - a)}`);
    },
    tuslar: (a, b) => sira().adim(r(a), "÷", cr(cikar(BIR, oranOf(b)))).bitir(`${y(b)} indirimden önce = rakamı ${c(cikar(BIR, oranOf(b)))} ile bölmek`),
  },
  {
    ad: "Hangi sayının %'si", kisaAd: "Hangi sayının", formul: "=A2/B2",
    hesapla: (a, b) => (b === 0 ? hataSonuc("Yüzde 0 olunca bulunamaz") : S(tutar((a * 100) / b))),
    tuslar: (a, b) => sira().adim(r(a), "÷", cr(oranOf(b))).bitir(`Tamamı = rakamı ${c(oranOf(b))} ile bölmek`),
  },
].map((i) => ({ ...i, formulNotu: "A2: rakam · B2: %20 şeklinde yaz", bYuzde: true }));

// ---------- 2. sekme: a = sol, b = sağ ----------

export const KARSILASTIRMA_SORULARI = [
  { ad: "Sol, sağın yüzde kaçı", kisaAd: "Sol, sağın %?", formul: "=A2/B2", hesapla: (a, b) => oran(b, "Sağ", () => S(yuzde((a / b) * 100))), tuslar: (a, b) => sira().adim(r(a), "÷", r(b), "×", r(YUZ)).bitir("Solu sağa bölüp 100 ile çarpmak") },
  { ad: "Sol, sağdan % kaç fazla", kisaAd: "Sol % fazla?", formul: "=A2/B2-1", hesapla: (a, b) => oran(b, "Sağ", () => yonlu(((a - b) / b) * 100, "Sol sağdan", "fazla", "eksik")), tuslar: (a, b) => sira().adim(r(a), "÷", r(b), "×", r(YUZ), "−", r(YUZ)).bitir("Solu sağa bölüp ×100; 100'ü aşan kısım fazlalıktır") },
  { ad: "Sol, sağdan % kaç eksik", kisaAd: "Sol % eksik?", formul: "=1-A2/B2", hesapla: (a, b) => oran(b, "Sağ", () => yonlu(((b - a) / b) * 100, "Sol sağdan", "eksik", "fazla")), tuslar: (a, b) => sira().adim(r(b), "−", r(a)).adim("÷", r(b), "×", r(YUZ)).bitir("Farkı sağa bölüp 100 ile çarpmak") },
  { ad: "Sağ, solun yüzde kaçı", kisaAd: "Sağ, solun %?", formul: "=B2/A2", hesapla: (a, b) => oran(a, "Sol", () => S(yuzde((b / a) * 100))), tuslar: (a, b) => sira().adim(r(b), "÷", r(a), "×", r(YUZ)).bitir("Sağı sola bölüp 100 ile çarpmak") },
  { ad: "Sağ, soldan % kaç fazla", kisaAd: "Sağ % fazla?", formul: "=B2/A2-1", hesapla: (a, b) => oran(a, "Sol", () => yonlu(((b - a) / a) * 100, "Sağ soldan", "fazla", "eksik")), tuslar: (a, b) => sira().adim(r(b), "÷", r(a), "×", r(YUZ), "−", r(YUZ)).bitir("Sağı sola bölüp ×100; 100'ü aşan kısım fazlalıktır") },
  { ad: "Sağ, soldan % kaç eksik", kisaAd: "Sağ % eksik?", formul: "=1-B2/A2", hesapla: (a, b) => oran(a, "Sol", () => yonlu(((a - b) / a) * 100, "Sağ soldan", "eksik", "fazla")), tuslar: (a, b) => sira().adim(r(a), "−", r(b)).adim("÷", r(a), "×", r(YUZ)).bitir("Farkı sola bölüp 100 ile çarpmak") },
  {
    ad: "Değişim (eski sol → yeni sağ)", kisaAd: "Değişim", formul: "=B2/A2-1",
    hesapla: (a, b) => oran(a, "Sol", () => {
      const d = ((b - a) / a) * 100;
      const yon = yuzde(Math.abs(d)) === "%0" ? "Değişim yok" : d > 0 ? `${yuzde(d)} artış` : `${yuzde(-d)} azalış`;
      return S(yuzde(d), yon);
    }),
    tuslar: (a, b) => sira().adim(r(b), "÷", r(a), "×", r(YUZ), "−", r(YUZ)).bitir("Yeniyi eskiye bölüp ×100 − 100; eksi çıkarsa azalış"),
  },
  { ad: "Aradaki fark (sol − sağ)", kisaAd: "Fark", formul: "=A2-B2", hesapla: (a, b) => S(tutar(a - b)), yuzdeSonuc: false, tuslar: (a, b) => sira().adim(r(a), "−", r(b)).bitir("Soldan sağı çıkarmak") },
].map((i) => ({
  yuzdeSonuc: true,
  ...i,
  formulNotu: i.yuzdeSonuc === false ? "A2: sol · B2: sağ" : "A2: sol · B2: sağ · Sonuç hücresini Yüzde biçimine al",
  bYuzde: false,
}));

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

/** Satırın hesap makinesi tuş sırası, satırdaki gerçek rakamlarla. Kutulardan biri boşsa ya da hesap yapılamıyorsa null. */
export function hesapMakinesi(islem, ham1, ham2) {
  const a = ondalikOku(ham1);
  const b = ondalikOku(ham2);
  if (a === null || b === null || hesapla(islem, ham1, ham2).hata) return null;
  try {
    return islem.tuslar(a, b);
  } catch {
    return null;
  }
}

// ---------- Excel formülü ----------

/** "1250," → "1250", ",5" → "0,5"; eksi sayı parantez içinde: "(-300)". */
function hucre(ham, yuzde) {
  let t = ham.trim().replace(/,$/, "");
  const eksi = t.startsWith("-");
  if (eksi) t = t.slice(1);
  if (t.startsWith(",")) t = "0" + t;
  if (yuzde) t += "%";
  return eksi ? `(-${t})` : t;
}

/** Formülün o satırdaki değerlerle hali (Türkçe Excel: binlik nokta yok, ondalık virgül). 1.250 ve %20 → "=1250*20%". Boşsa null. */
export function rakamlarla(islem, ham1, ham2) {
  if (sayiOku(ham1) === null || sayiOku(ham2) === null) return null;
  return islem.formul.replaceAll("A2", hucre(ham1, false)).replaceAll("B2", hucre(ham2, islem.bYuzde));
}

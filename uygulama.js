// Yüzde Hesap — ekran. Hesaplar hesaplar.js'tedir.
import { YUZDE_ISLEMLERI, KARSILASTIRMA_SORULARI, BOS, hesapla, girisDuzelt, esle, panoMetni, rakamlarla } from "./hesaplar.js";

const SEKMELER = {
  yuzde: { ustSatir: "Rakam · Yüzde · İşlem → Sonuç", etiket1: "Rakam", etiket2: "Yüzde", islemEtiketi: "İşlem", yuzdeKutusu: true, islemler: YUZDE_ISLEMLERI },
  karsilastir: { ustSatir: "Sol · Sağ · Soru → Sonuç", etiket1: "Sol", etiket2: "Sağ", islemEtiketi: "Soru", yuzdeKutusu: false, islemler: KARSILASTIRMA_SORULARI },
};

// ---------- Durum (uygulama kapanıp açılınca da kalsın diye tarayıcıda saklanır) ----------

const ANAHTAR = "yuzde-hesap-v1";
let sonId = 0;
const yeniSatir = (islem = 0) => ({ id: ++sonId, ham1: "", ham2: "", islem, formulAcik: false });

function yukle() {
  try {
    const d = JSON.parse(localStorage.getItem(ANAHTAR));
    if (d && d.satirlar?.yuzde?.length && d.satirlar?.karsilastir?.length) {
      for (const k of Object.keys(SEKMELER)) {
        d.satirlar[k] = d.satirlar[k].map((s) => ({
          id: ++sonId,
          ham1: girisDuzelt("", String(s.ham1 ?? "")),
          ham2: girisDuzelt("", String(s.ham2 ?? "")),
          formulAcik: s.formulAcik === true,
          islem: Number.isInteger(s.islem) && s.islem >= 0 && s.islem < SEKMELER[k].islemler.length ? s.islem : 0,
        }));
      }
      return { secili: d.secili in SEKMELER ? d.secili : "yuzde", satirlar: d.satirlar, hepGoster: d.hepGoster === true };
    }
  } catch { /* saklama kapalı/bozuk: boş başla */ }
  return { secili: "yuzde", satirlar: { yuzde: [yeniSatir()], karsilastir: [yeniSatir()] }, hepGoster: false };
}

const durum = yukle();

function sakla() {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(durum));
  } catch { /* gizli sekme vb. */ }
}

// ---------- Ekran ----------

const $ = (s) => document.querySelector(s);
const satirlarKutusu = $("#satirlar");

function el(etiket, sinif, ozellik = {}) {
  const e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  Object.assign(e, ozellik);
  return e;
}

function ciz() {
  const sekme = SEKMELER[durum.secili];
  document.querySelectorAll(".sekme").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.sekme === durum.secili)));
  $("#hep-goster").setAttribute("aria-pressed", String(durum.hepGoster));
  document.body.classList.toggle("formul-hep", durum.hepGoster);
  $("#ust-satir").textContent = sekme.ustSatir;
  satirlarKutusu.replaceChildren(...durum.satirlar[durum.secili].map((s) => satirKarti(sekme, s)));
}

function satirKarti(sekme, satir) {
  const kart = el("div", "kart" + (sekme.yuzdeKutusu ? "" : " esit") + (satir.formulAcik ? " formul-acik" : ""));
  const sonuc = el("div", "sonuc");
  const formul = el("div", "formul");

  const yenile = () => {
    const islem = sekme.islemler[satir.islem];
    sonucCiz(sonuc, hesapla(islem, satir.ham1, satir.ham2));
    formulCiz(formul, islem, satir);
  };

  kart.append(
    sayiKutusu("a", sekme.etiket1, false, satir, "ham1", "next", yenile),
    sayiKutusu("b", sekme.etiket2, sekme.yuzdeKutusu, satir, "ham2", "done", yenile),
    islemSecici(sekme, satir, yenile),
    sonuc,
    silDugmesi(satir),
    formulDugmesi(kart, satir),
    formul,
  );
  yenile();
  return kart;
}

function sayiKutusu(sinif, etiket, yuzde, satir, alan, enter, yenile) {
  const kutu = el("div", `kutu ${sinif}` + (yuzde ? " yuzde" : ""));
  const input = el("input", "", {
    type: "text",
    inputMode: "decimal",
    autocomplete: "off",
    spellcheck: false,
    enterKeyHint: enter,
    value: esle(satir[alan]).gorunen,
  });
  input.setAttribute("autocorrect", "off");
  input.setAttribute("aria-label", etiket);
  const dolu = () => kutu.classList.toggle("dolu", satir[alan] !== "");
  dolu();

  input.addEventListener("input", (e) => {
    let v = input.value;
    let imlec = input.selectionStart ?? v.length;
    // Klavyeden yazılan nokta ondalık ayırıcıdır → virgül. (Görünen noktalar yalnızca binlik ayırıcıdır.)
    if (e.data && e.data.includes(".") && e.inputType !== "insertFromPaste") {
      const bas = Math.max(0, imlec - e.data.length);
      v = v.slice(0, bas) + e.data.replaceAll(".", ",") + v.slice(imlec);
    }
    const ham = v.replaceAll(".", "");
    let hamImlec = v.slice(0, imlec).replaceAll(".", "").length;
    const eski = satir[alan];
    const yeni = girisDuzelt(eski, ham);
    if (yeni !== ham) {
      // Reddedildi: imleç yazılmadan önceki yerine; yapıştırma düzeltildiyse sona.
      hamImlec = yeni === eski ? Math.max(0, hamImlec - (ham.length - eski.length)) : yeni.length;
    }
    hamImlec = Math.min(hamImlec, yeni.length);
    satir[alan] = yeni;
    const m = esle(yeni);
    input.value = m.gorunen;
    const g = m.hamdanGorunene[hamImlec];
    input.setSelectionRange(g, g);
    dolu();
    yenile();
    sakla();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (enter === "next") input.closest(".kart").querySelector(".kutu.b input").focus();
    else input.blur();
  });

  kutu.append(el("label", "", { textContent: etiket }));
  if (yuzde) kutu.append(el("span", "on-ek", { textContent: "%" }));
  kutu.append(input);
  return kutu;
}

function islemSecici(sekme, satir, yenile) {
  const kutu = el("div", "islem");
  const secili = el("span", "secili", { textContent: sekme.islemler[satir.islem].kisaAd });
  const metin = el("span", "metin");
  metin.append(el("span", "etiket", { textContent: sekme.islemEtiketi }), secili);
  const liste = el("select");
  liste.setAttribute("aria-label", sekme.islemEtiketi);
  sekme.islemler.forEach((islem, i) => liste.append(el("option", "", { value: String(i), textContent: islem.ad, selected: i === satir.islem })));
  liste.addEventListener("change", () => {
    satir.islem = Number(liste.value);
    secili.textContent = sekme.islemler[satir.islem].kisaAd;
    yenile();
    sakla();
  });
  kutu.append(metin, el("span", "ok", { textContent: "▾", ariaHidden: "true" }), liste);
  return kutu;
}

function silDugmesi(satir) {
  const b = el("button", "sil", { type: "button", textContent: "✕" });
  b.setAttribute("aria-label", "Satırı sil");
  b.addEventListener("click", () => {
    const liste = durum.satirlar[durum.secili];
    const i = liste.findIndex((s) => s.id === satir.id);
    if (i < 0) return;
    // Tek satır kalınca silmek yerine boşaltır.
    if (liste.length === 1) liste[0] = yeniSatir(liste[0].islem);
    else liste.splice(i, 1);
    ciz();
    sakla();
  });
  return b;
}

function sonucCiz(kutu, s) {
  const dolu = !s.hata && s !== BOS;
  kutu.className = "sonuc" + (s === BOS ? " bos" : "") + (s.hata ? " hata" : "");
  const deger = el("span", "deger", { textContent: s.metin });
  if (dolu) {
    deger.setAttribute("role", "button");
    deger.title = "Kopyalamak için dokun";
    deger.addEventListener("click", () => { const m = panoMetni(s.metin); kopyala(m, `Kopyalandı: ${m}`); });
  }
  const parcalar = [deger];
  if (s.not) parcalar.push(el("div", "not", { textContent: s.not }));
  if (s.uyari) parcalar.push(el("div", "uyari", { textContent: s.uyari }));
  kutu.replaceChildren(...parcalar);
}

// ---------- Excel formülü ----------

function formulDugmesi(kart, satir) {
  const b = el("button", "formul-dugme", { type: "button" });
  const yaz = () => { b.textContent = satir.formulAcik ? "Excel formülü ▴" : "Excel formülü ▾"; b.setAttribute("aria-expanded", String(satir.formulAcik)); };
  yaz();
  b.addEventListener("click", () => {
    satir.formulAcik = !satir.formulAcik;
    kart.classList.toggle("formul-acik", satir.formulAcik);
    yaz();
    sakla();
  });
  return b;
}

function formulCiz(kutu, islem, satir) {
  const r = rakamlarla(islem, satir.ham1, satir.ham2);
  const kopya = el("button", "kopyala", { type: "button", textContent: "Kopyala" });
  kopya.addEventListener("click", () => kopyala(islem.formul, "Formül kopyalandı"));
  const metin = el("div", "formul-metin");
  metin.append(
    el("div", "formul-ana", { textContent: islem.formul }),
    el("div", "formul-rakam" + (r ? "" : " bos"), { textContent: r ?? "Rakamları girince burada görünür" }),
    el("div", "formul-not", { textContent: islem.formulNotu }),
  );
  kutu.replaceChildren(metin, kopya);
}

// ---------- Kopyalama ----------

let mesajZamani;
function mesajGoster(metin) {
  const m = $("#mesaj");
  m.textContent = metin;
  m.classList.add("gorunur");
  clearTimeout(mesajZamani);
  mesajZamani = setTimeout(() => m.classList.remove("gorunur"), 1800);
}

async function kopyala(metin, mesaj) {
  try {
    await navigator.clipboard.writeText(metin);
  } catch {
    // Eski tarayıcı / güvenli olmayan bağlantı: gizli metin kutusu ile.
    const t = el("textarea", "", { value: metin });
    t.setAttribute("readonly", "");
    t.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.append(t);
    t.select();
    t.setSelectionRange(0, metin.length);
    try { document.execCommand("copy"); } catch { /* yok */ }
    t.remove();
  }
  mesajGoster(mesaj);
}

// ---------- Düğmeler ----------

document.querySelectorAll(".sekme").forEach((b) =>
  b.addEventListener("click", () => {
    durum.secili = b.dataset.sekme;
    ciz();
    sakla();
  }),
);

$("#hep-goster").addEventListener("click", () => {
  durum.hepGoster = !durum.hepGoster;
  ciz();
  sakla();
  mesajGoster(durum.hepGoster ? "Formüller hep gösteriliyor" : "Formüller gizlendi");
});

$("#temizle").addEventListener("click", () => {
  durum.satirlar[durum.secili] = [yeniSatir()];
  ciz();
  sakla();
});

// Yeni satır bir öncekinin işlemini hazır seçili getirir; imleç ilk kutuya gelir.
// (iPhone'da klavyenin açılması için odak, dokunmanın içinde hemen verilmeli.)
$("#ekle").addEventListener("click", () => {
  const liste = durum.satirlar[durum.secili];
  liste.push(yeniSatir(liste.at(-1)?.islem ?? 0));
  ciz();
  sakla();
  const son = satirlarKutusu.lastElementChild;
  son.querySelector(".kutu.a input").focus();
  son.scrollIntoView({ block: "nearest", behavior: "smooth" });
});

ciz();

// İnternetsiz çalışma: dosyalar ilk açılışta saklanır.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

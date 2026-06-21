// سيرتي — منشئ سيرة ذاتية عربية. يعمل بالكامل في المتصفح، بلا خادم.
(function () {
  "use strict";

  // تخزين آمن: يعمل حتى لو مُنع localStorage (تصفّح خاص/قيود)
  const mem = {};
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] ?? null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } },
  };

  const STORE_KEY = "seerati.v1";
  const LICENSE_KEY = "seerati.license";
  // رابط الدفع (Gumroad/Lemon Squeezy) — استبدله برابطك الحقيقي.
  const BUY_URL = "https://gumroad.com/l/your-product";
  const COLORS = [
    { c: "#0E7C66", free: true },  // زمرّدي (الافتراضي)
    { c: "#1F4FD8", free: true },  // أزرق
    { c: "#16181D", free: true },  // فحمي
    { c: "#B4541E", free: false }, // طوبي (مدفوع)
    { c: "#6D28D9", free: false }, // بنفسجي (مدفوع)
  ];

  const DEFAULT = {
    template: "modern",
    accent: "#0E7C66",
    font: "'IBM Plex Sans Arabic', sans-serif",
    lang: "ar",
    fullName: "", title: "", email: "", phone: "", city: "", link: "",
    summary: "",
    experience: [],
    education: [],
    skills: "", languages: "",
    clTo: "", clCompany: "", clRole: "", clBody: "",
  };

  // النصوص حسب اللغة (عربي / إنجليزي)
  const T = {
    ar: {
      summary: "نبذة", exp: "الخبرات العملية", edu: "التعليم", skills: "المهارات", langs: "اللغات",
      namePh: "اسمك الكامل", dear: "إلى", regards: "وتفضّلوا بقبول فائق الاحترام،", re: "الموضوع: التقدّم لوظيفة",
    },
    en: {
      summary: "Summary", exp: "Experience", edu: "Education", skills: "Skills", langs: "Languages",
      namePh: "Your Full Name", dear: "Dear", regards: "Sincerely,", re: "Re: Application for",
    },
  };

  let state = load();
  let unlocked = !!storage.get(LICENSE_KEY);
  let mode = "cv"; // cv | cover

  // ===== أدوات =====
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

  function load() {
    try {
      const raw = storage.get(STORE_KEY);
      if (raw) return Object.assign({}, DEFAULT, JSON.parse(raw));
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT));
  }
  function save(silent) {
    storage.set(STORE_KEY, JSON.stringify(state));
    if (!silent) flash($("#btnSave"), "تم الحفظ ✓");
  }
  function flash(btn, txt) {
    const old = btn.textContent;
    btn.textContent = txt;
    setTimeout(() => (btn.textContent = old), 1200);
  }

  // ===== ربط الحقول البسيطة =====
  $$("[data-bind]").forEach((el) => {
    const key = el.dataset.bind;
    el.value = state[key] || "";
    el.addEventListener("input", () => {
      state[key] = el.value;
      render();
      save(true);
    });
  });

  // ===== القالب =====
  $("#templatePicker").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tpl]");
    if (!b) return;
    const tpl = b.dataset.tpl;
    if (tpl === "compact" && !unlocked) return openModal();
    state.template = tpl;
    $$("#templatePicker .seg-btn").forEach((x) => x.classList.toggle("is-active", x === b));
    render();
    save(true);
  });

  // ===== الألوان =====
  const colorPicker = $("#colorPicker");
  COLORS.forEach(({ c, free }) => {
    const s = document.createElement("button");
    s.type = "button";
    s.className = "swatch" + (state.accent === c ? " is-active" : "") + (free ? "" : " locked");
    s.style.background = c;
    s.style.position = "relative";
    s.title = free ? "" : "لون مدفوع";
    s.addEventListener("click", () => {
      if (!free && !unlocked) return openModal();
      state.accent = c;
      $$(".swatch").forEach((x) => x.classList.remove("is-active"));
      s.classList.add("is-active");
      render();
      save(true);
    });
    colorPicker.appendChild(s);
  });

  // ===== الخط =====
  const fontPicker = $("#fontPicker");
  fontPicker.value = state.font;
  fontPicker.addEventListener("change", () => {
    state.font = fontPicker.value;
    render();
    save(true);
  });

  // ===== اللغة (عربي / إنجليزي) =====
  $("#langPicker").addEventListener("click", (e) => {
    const b = e.target.closest("[data-lang]");
    if (!b) return;
    state.lang = b.dataset.lang;
    $$("#langPicker .seg-btn").forEach((x) => x.classList.toggle("is-active", x === b));
    render();
    save(true);
  });

  // ===== نوع المستند (سيرة / خطاب) =====
  function applyMode() {
    $$(".doc-only").forEach((p) => (p.hidden = p.dataset.only !== mode));
  }
  $("#docModePicker").addEventListener("click", (e) => {
    const b = e.target.closest("[data-mode]");
    if (!b) return;
    mode = b.dataset.mode;
    $$("#docModePicker .seg-btn").forEach((x) => x.classList.toggle("is-active", x === b));
    applyMode();
    render();
  });

  // ===== العناصر المتكرّرة (خبرات/تعليم) =====
  const FIELDS = {
    experience: [
      { k: "org", ph: "اسم الشركة" },
      { k: "role", ph: "المسمّى الوظيفي" },
      { k: "when", ph: "المدة (مثال: 2021 — الآن)" },
      { k: "desc", ph: "أهم إنجازاتك ومهامك", area: true },
    ],
    education: [
      { k: "org", ph: "الجامعة / المؤسسة" },
      { k: "role", ph: "الدرجة / التخصص" },
      { k: "when", ph: "سنة التخرّج" },
    ],
  };

  function renderRepeat(type) {
    const list = $("#" + type + "List");
    list.innerHTML = "";
    state[type].forEach((item, i) => {
      const wrap = document.createElement("div");
      wrap.className = "rep-item";
      const del = document.createElement("button");
      del.className = "rep-del";
      del.type = "button";
      del.textContent = "×";
      del.title = "حذف";
      del.addEventListener("click", () => {
        state[type].splice(i, 1);
        renderRepeat(type);
        render();
        save(true);
      });
      wrap.appendChild(del);
      FIELDS[type].forEach((f) => {
        const field = document.createElement("div");
        field.className = "field";
        const inp = f.area ? document.createElement("textarea") : document.createElement("input");
        if (f.area) inp.rows = 2;
        inp.placeholder = f.ph;
        inp.value = item[f.k] || "";
        inp.addEventListener("input", () => {
          item[f.k] = inp.value;
          render();
          save(true);
        });
        field.appendChild(inp);
        wrap.appendChild(field);
      });
      list.appendChild(wrap);
    });
  }

  $$("[data-add]").forEach((b) => {
    b.addEventListener("click", () => {
      const type = b.dataset.add;
      state[type].push({});
      renderRepeat(type);
      render();
      save(true);
    });
  });

  // ===== أزرار علوية =====
  $("#btnSave").addEventListener("click", () => save());
  $("#btnReset").addEventListener("click", () => {
    if (!confirm("سيتم تفريغ كل الحقول. متابعة؟")) return;
    state = JSON.parse(JSON.stringify(DEFAULT));
    storage.del(STORE_KEY);
    location.reload();
  });
  $("#btnDownload").addEventListener("click", () => {
    if (!unlocked) {
      // نسمح بالتحميل لكن مع تذكير لطيف؛ العلامة المائية تبقى في المجاني.
      openModal();
      return;
    }
    window.print();
  });

  // ===== النافذة =====
  function openModal() {
    $("#buyLink").href = BUY_URL;
    $("#unlockModal").hidden = false;
  }
  $("#unlockClose").addEventListener("click", () => ($("#unlockModal").hidden = true));
  $("#unlockModal").addEventListener("click", (e) => {
    if (e.target.id === "unlockModal") $("#unlockModal").hidden = true;
  });
  $("#licenseApply").addEventListener("click", () => {
    const code = $("#licenseInput").value.trim().toUpperCase();
    const msg = $("#licenseMsg");
    // تحقّق بسيط من الكود. في الإنتاج: تحقّق عبر مزوّد الدفع (Gumroad license API).
    if (isValidLicense(code)) {
      unlocked = true;
      storage.set(LICENSE_KEY, code);
      msg.textContent = "تم التفعيل! أُزيلت العلامة المائية.";
      msg.className = "license-msg ok";
      render();
      setTimeout(() => {
        $("#unlockModal").hidden = true;
        window.print();
      }, 900);
    } else {
      msg.textContent = "الكود غير صحيح. تأكّد من نسخه كاملاً.";
      msg.className = "license-msg err";
    }
  });

  // أكواد تجريبية. استبدل بمنطق تحقّق حقيقي من مزوّد الدفع.
  function isValidLicense(code) {
    if (!code) return false;
    // نمط: SEERATI-XXXX حيث XXXX = حروف/أرقام؛ هنا قبول كل كود يبدأ بـ SEERATI-
    return /^SEERATI-[A-Z0-9]{4,}$/.test(code) || code === "DEMO-UNLOCK";
  }

  // ===== العرض =====
  const cv = $("#cv");
  const WM = "أُنشئت مجاناً عبر «سيرتي» — seerati.app";
  function render() {
    const t = T[state.lang] || T.ar;
    cv.className = "cv tpl-" + state.template + (unlocked ? " unlocked" : "") + (state.lang === "en" ? " ltr" : "");
    cv.dir = state.lang === "en" ? "ltr" : "rtl";
    cv.style.setProperty("--accent", state.accent);
    cv.style.setProperty("--accent-ink", shade(state.accent, -18));
    cv.style.fontFamily = state.font;
    if (mode === "cover") return renderCover(t);

    const contact = [
      state.email && `✉ ${esc(state.email)}`,
      state.phone && `☎ ${esc(state.phone)}`,
      state.city && `⌖ ${esc(state.city)}`,
      state.link && `↗ ${esc(state.link)}`,
    ].filter(Boolean).map((x) => `<span>${x}</span>`).join("");

    const expHtml = state.experience.filter(hasAny).map(entry).join("");
    const eduHtml = state.education.filter(hasAny).map(entry).join("");
    const skills = splitTags(state.skills);
    const langs = splitTags(state.languages);

    cv.innerHTML = `
      <header>
        <div class="cv-name">${esc(state.fullName) || t.namePh}</div>
        ${state.title ? `<div class="cv-title">${esc(state.title)}</div>` : ""}
        ${contact ? `<div class="cv-contact">${contact}</div>` : ""}
      </header>
      ${state.summary ? `<div class="cv-section"><div class="cv-h">${t.summary}</div><div class="cv-summary">${esc(state.summary)}</div></div>` : ""}
      ${expHtml ? `<div class="cv-section"><div class="cv-h">${t.exp}</div>${expHtml}</div>` : ""}
      ${eduHtml ? `<div class="cv-section"><div class="cv-h">${t.edu}</div>${eduHtml}</div>` : ""}
      ${skills.length ? `<div class="cv-section"><div class="cv-h">${t.skills}</div><div class="cv-tags">${skills.map(x=>`<span class="cv-tag">${esc(x)}</span>`).join("")}</div></div>` : ""}
      ${langs.length ? `<div class="cv-section"><div class="cv-h">${t.langs}</div><div class="cv-tags">${langs.map(x=>`<span class="cv-tag">${esc(x)}</span>`).join("")}</div></div>` : ""}
      <div class="watermark">${WM}</div>
    `;
  }

  // ===== عرض الخطاب التعريفي =====
  function renderCover(t) {
    const today = new Date().toLocaleDateString(state.lang === "en" ? "en-GB" : "ar-EG", { year: "numeric", month: "long", day: "numeric" });
    const sender = [
      state.email && esc(state.email),
      state.phone && esc(state.phone),
      state.city && esc(state.city),
    ].filter(Boolean).join(" · ");
    const dearLine = state.clTo ? `${t.dear} ${esc(state.clTo)},` : (state.lang === "en" ? `${t.dear} Hiring Manager,` : `${t.dear} مدير التوظيف،`);
    const bodyHtml = String(state.clBody || "").split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean)
      .map((p) => `<p>${esc(p)}</p>`).join("") || `<p class="cv-placeholder">${state.lang === "en" ? "Write your cover letter here." : "اكتب نص خطابك التعريفي هنا."}</p>`;

    cv.innerHTML = `
      <header>
        <div class="cv-name">${esc(state.fullName) || t.namePh}</div>
        ${state.title ? `<div class="cv-title">${esc(state.title)}</div>` : ""}
        ${sender ? `<div class="cv-contact"><span>${sender}</span></div>` : ""}
      </header>
      <div class="cl-meta">
        <div class="cl-date">${today}</div>
        ${state.clCompany ? `<div class="cl-to">${esc(state.clCompany)}</div>` : ""}
        ${state.clRole ? `<div class="cl-re">${t.re} ${esc(state.clRole)}</div>` : ""}
      </div>
      <div class="cl-body">
        <p class="cl-dear">${dearLine}</p>
        ${bodyHtml}
        <p class="cl-regards">${t.regards}</p>
        <p class="cl-sign">${esc(state.fullName) || ""}</p>
      </div>
      <div class="watermark">${WM}</div>
    `;
  }

  function entry(it) {
    return `<div class="cv-entry">
      <div class="row"><span class="org">${esc(it.org) || ""}</span><span class="when">${esc(it.when) || ""}</span></div>
      ${it.role ? `<div class="role">${esc(it.role)}</div>` : ""}
      ${it.desc ? `<div class="desc">${esc(it.desc)}</div>` : ""}
    </div>`;
  }
  const hasAny = (o) => Object.values(o).some((v) => String(v || "").trim());
  const splitTags = (s) => String(s || "").split(/[,،]/).map((x) => x.trim()).filter(Boolean);

  // تظليل لون (تفتيح/تغميق)
  function shade(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = pct / 100;
    r = Math.round(r + (f < 0 ? r : 255 - r) * f);
    g = Math.round(g + (f < 0 ? g : 255 - g) * f);
    b = Math.round(b + (f < 0 ? b : 255 - b) * f);
    return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");
  }

  // ===== تهيئة =====
  // إن لم توجد بيانات، نضع مثالاً واحداً ليرى المستخدم الشكل.
  if (!state.experience.length && !state.fullName) {
    state.experience.push({ org: "شركة مثال", role: "مسمّاك الوظيفي", when: "2022 — الآن", desc: "اكتب أبرز إنجازاتك هنا." });
  }
  // مزامنة حالة الأزرار مع البيانات المحفوظة
  $$("#langPicker .seg-btn").forEach((x) => x.classList.toggle("is-active", x.dataset.lang === state.lang));
  $$("#templatePicker .seg-btn").forEach((x) => x.classList.toggle("is-active", x.dataset.tpl === state.template));
  applyMode();
  renderRepeat("experience");
  renderRepeat("education");
  render();
})();

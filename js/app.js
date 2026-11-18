/* Pulumutsa Moyo
   One script for every page. Each page only has some of the parts below,
   so each render step checks its elements exist before touching them.
   Load order: i18n.js, data.js, then this file. */
(function () {
  "use strict";

  var PAGE = document.body.getAttribute("data-page") || "home";
  var KEY = "znbts-donor-v1";
  var FLASH_KEY = "pm-flash";
  // Rough minutes for each step of a visit: sign in, check, give, rest.
  var VISIT_MIN = [[5, 10], [10, 15], [10], [10, 15]];

  // ---- Saved state (this browser only) ----

  function defaultProfile() {
    return { name: "", phone: "", email: "", sex: "", bloodGroup: "", types: [], sms: false, emailOn: false, consent: false, registered: false, skipped: false };
  }
  function defaults() { return { donations: [], profile: defaultProfile(), near: "", loc: null, lastNotified: "", lang: "en" }; }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      var s = JSON.parse(raw);
      if (!s || !Array.isArray(s.donations)) return defaults();
      var d = defaults();
      ["near", "loc", "lastNotified", "lang"].forEach(function (k) { if (Object.prototype.hasOwnProperty.call(s, k)) d[k] = s[k]; });
      d.donations = s.donations.filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}$/.test(x.date); }).map(function (x) {
        return { id: x.id || ("d" + Math.random().toString(36).slice(2, 9)), date: x.date, centre: x.centre || "", type: TYPES.indexOf(x.type) >= 0 ? x.type : "whole" };
      });
      var p = s.profile || {}, dp = defaultProfile();
      for (var k in dp) if (Object.prototype.hasOwnProperty.call(p, k)) dp[k] = p[k];
      if (!dp.bloodGroup && s.bloodGroup) dp.bloodGroup = s.bloodGroup; // older saves kept it at the top level
      dp.types = Array.isArray(dp.types) ? dp.types.filter(function (x) { return TYPES.indexOf(x) >= 0; }) : [];
      d.profile = dp;
      if (!I18N[d.lang]) d.lang = "en";
      if (d.loc && d.loc.label === "your location") d.loc.label = "@you";
      return d;
    } catch (e) {
      return defaults();
    }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  var state = load();

  // A message to show after moving to another page.
  function flash(msg) { try { sessionStorage.setItem(FLASH_KEY, msg); } catch (e) {} }
  function takeFlash() {
    try { var m = sessionStorage.getItem(FLASH_KEY); sessionStorage.removeItem(FLASH_KEY); return m; } catch (e) { return null; }
  }

  // ---- Text ----

  function t(key, vars) {
    var dict = I18N[state.lang] || I18N.en;
    var s = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : I18N.en[key];
    if (s === undefined) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m; });
    return s;
  }
  function dayUnit(n) { return n === 1 ? t("day_one") : t("day_many"); }
  function typeName(type, lower) { return t((lower ? "typel_" : "type_") + (TYPES.indexOf(type) >= 0 ? type : "whole")); }

  // ---- Dates (kept as YYYY-MM-DD strings, worked out in UTC) ----

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(y, m, d) { return y + "-" + pad(m) + "-" + pad(d); }
  function todayISO() { var d = new Date(); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function parts(s) { var p = s.split("-"); return [Number(p[0]), Number(p[1]), Number(p[2])]; }
  function toUTC(s) { var p = parts(s); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function fromUTC(ms) { var d = new Date(ms); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  function addMonths(s, n) {
    var p = parts(s), m0 = p[1] - 1 + n;
    var y = p[0] + Math.floor(m0 / 12), m = ((m0 % 12) + 12) % 12;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return iso(y, m + 1, Math.min(p[2], last)); // 31 Aug + 6 months = 28 Feb
  }
  function addDays(s, n) { return fromUTC(toUTC(s) + n * 86400000); }
  function daysBetween(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); }
  var fmtLong = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  var fmtShort = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  function fmt(s, long) {
    var months = MONTHS[state.lang];
    if (months) { var p = parts(s); return p[2] + " " + months[p[1] - 1] + " " + p[0]; }
    return (long ? fmtLong : fmtShort).format(new Date(toUTC(s)));
  }
  function compact(s) { return s.replace(/-/g, ""); }

  // ---- Waiting times ----

  function intervalFor(type, sex) {
    var r = RULES[type] || RULES.whole;
    if (r.m) return sex === "m" ? r.m : r.f; // sex unknown: use the longer wait
    return r;
  }
  function addInterval(s, iv) { return iv.months ? addMonths(s, iv.months) : addDays(s, iv.days); }
  function everyText(iv) { return iv.months ? t("every_months", { n: iv.months }) : t("every_weeks", { n: Math.round(iv.days / 7) }); }
  function ruleText(type) {
    var r = RULES[type];
    return r.m ? t("rule_whole", { m: r.m.months, f: r.f.months }) : t("rule_weeks", { w: Math.round(r.days / 7) });
  }
  function preferredType() { var ts = state.profile.types; return ts && ts.length ? ts[0] : "whole"; }

  function sortedDonations() { return state.donations.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }); }
  function latest() { return sortedDonations()[0] || null; }
  // Each donation has its own wait. The next date is the latest of them.
  function nextInfo() {
    var best = null, sex = state.profile.sex;
    state.donations.forEach(function (d) {
      var iv = intervalFor(d.type, sex), due = addInterval(d.date, iv);
      if (!best || due > best.due) best = { due: due, from: d, iv: iv };
    });
    return best;
  }
  function nextDue() { var n = nextInfo(); return n ? n.due : null; }
  function status() {
    var td = todayISO(), n = nextInfo();
    if (!n) { var pt = preferredType(); return { kind: "none", type: pt, ifToday: addInterval(td, intervalFor(pt, state.profile.sex)) }; }
    var total = Math.max(1, daysBetween(n.from.date, n.due)), left = daysBetween(td, n.due);
    if (left <= 0) return { kind: "ready", due: n.due, from: n.from, iv: n.iv, overdue: -left };
    var since = daysBetween(n.from.date, td);
    return { kind: "wait", due: n.due, from: n.from, iv: n.iv, left: left, total: total, progress: Math.min(1, Math.max(0, since / total)) };
  }

  // ---- Small helpers ----

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function elOf(target) { var el = target; if (el && el.nodeType !== 1) el = el.parentNode; return el && el.closest ? el : null; }
  function setText(id, text) { var el = $(id); if (el) el.textContent = text; }
  function centreById(id) { for (var i = 0; i < CENTRES.length; i++) if (CENTRES[i].id === id) return CENTRES[i]; return null; }
  function centreLabel(id) {
    if (id === "mobile") return t("opt_mobile");
    if (id === "other") return t("opt_other");
    var c = centreById(id); return c ? c.town + " · " + c.name : t("not_recorded");
  }
  function phoneHtml(c) {
    if (!c.phone) return "";
    return '<p class="phone"><a href="tel:' + c.phone.replace(/\s/g, "") + '">' + esc(c.phone) + "</a> <small>· " + esc(t("phone_hq")) + "</small></p>";
  }
  function directionsUrl(c) { return "https://www.google.com/maps/dir/?api=1&destination=" + c.lat + "," + c.lng; }
  function haversine(a, b) {
    var R = 6371, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtKm(km) { return km < 1 ? t("dist_under1") : Math.round(km).toLocaleString("en-GB") + " km"; }

  // Zambian mobile numbers: 9 digits after 0 or +260, starting 7 or 9 (Airtel, MTN, Zamtel).
  function normPhone(v) {
    var d = String(v).replace(/[^\d+]/g, "");
    if (d.indexOf("+260") === 0) d = d.slice(4);
    else if (d.indexOf("260") === 0 && d.length === 12) d = d.slice(3);
    else if (d.indexOf("0") === 0) d = d.slice(1);
    if (!/^[79]\d{8}$/.test(d)) return null;
    return "+260 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5);
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var toastTimer = null;
  function toast(msg, actionLabel, action) {
    var el = $("toast"), btn = $("toast-action");
    if (!el) return;
    $("toast-msg").textContent = msg;
    if (actionLabel) { btn.textContent = actionLabel; btn.hidden = false; btn.onclick = function () { action(); hideToast(); }; }
    else { btn.hidden = true; btn.onclick = null; }
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, actionLabel ? 6000 : 4200);
  }
  function hideToast() { var el = $("toast"); if (el) el.classList.remove("show"); }

  var IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // ---- Location ----

  function userLoc() { return state.loc && typeof state.loc.lat === "number" ? state.loc : null; }
  function fromLabel(u) { return u.label === "@you" ? t("from_you") : t("from_town", { town: u.label }); }
  function centresByDistance() {
    var u = userLoc();
    var list = CENTRES.map(function (c) { return { c: c, km: u ? haversine(u, c) : null }; });
    if (u) list.sort(function (a, b) { return a.km - b.km; });
    else list.sort(function (a, b) { return (b.c.hq ? 1 : 0) - (a.c.hq ? 1 : 0) || a.c.province.localeCompare(b.c.province); });
    return list;
  }

  // ---- Text that sits in the page ----

  var PAGE_TITLE = { start: "welcome_title", find: "nav_find", card: "nav_remind", info: "nav_info" };
  function applyStatic() {
    document.documentElement.lang = state.lang;
    document.title = PAGE_TITLE[PAGE] ? t(PAGE_TITLE[PAGE]) + " · Pulumutsa Moyo" : "Pulumutsa Moyo";
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-html]"), function (el) { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-aria]"), function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"))); });
    setText("lang-code", t("code"));
    Array.prototype.forEach.call(document.querySelectorAll("[data-lang]"), function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-lang") === state.lang)); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-pick-lang]"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-pick-lang") === state.lang)); });
    TYPES.forEach(function (ty) {
      setText("pt-" + ty + "-rule", ruleText(ty));
      setText("often-" + ty, ruleText(ty));
    });
    setText("sex-hint", t("f_sex_hint", { m: RULES.whole.m.months, f: RULES.whole.f.months }));
    VISIT_MIN.forEach(function (m, i) {
      setText("v" + (i + 1) + "-min", m.length > 1 ? t("m_range", { a: m[0], b: m[1] }) : t("m_about", { a: m[0] }));
    });
  }

  // ---- Home ----

  function renderHome() {
    if (!$("st-title")) return;
    var s = status(), p = state.profile;
    var title = $("st-title"), lead = $("st-lead"), eyebrow = $("st-eyebrow"), actions = $("st-actions");
    var fill = $("bag-fill"), btext = $("bag-text"), cap = $("bag-cap"), level;
    $("ready-banner").hidden = s.kind !== "ready";
    $("home-nudge").hidden = !!p.registered;
    title.classList.remove("long");

    if (s.kind === "none") {
      eyebrow.textContent = t("eyebrow_next");
      title.textContent = t("ready_title");
      lead.innerHTML = t("lead_none_html", { type: esc(typeName(s.type, true)), date: esc(fmt(s.ifToday, true)) });
      actions.innerHTML = '<a class="btn btn-primary" href="find.html">' + esc(t("btn_find")) + '</a><a class="btn" href="card.html">' + esc(t("btn_log_past")) + "</a>";
      level = 1; btext.textContent = "100%"; cap.textContent = t("cap_full");
    } else if (s.kind === "ready") {
      var l = latest();
      eyebrow.textContent = t("eyebrow_last", { type: typeName(l.type, true), date: fmt(l.date) });
      title.textContent = t("ready_again_title");
      lead.innerHTML = t("lead_ready_html");
      actions.innerHTML = '<a class="btn btn-primary" href="find.html">' + esc(t("btn_find")) + '</a><button class="btn" type="button" data-act="today">' + esc(t("btn_today")) + "</button>";
      level = 1; btext.textContent = "100%"; cap.textContent = t("cap_full");
    } else {
      eyebrow.textContent = t("eyebrow_next");
      title.innerHTML = t("hero_days_html", { n: s.left, unit: esc(dayUnit(s.left)) });
      lead.innerHTML = t("lead_wait_html", { date: esc(fmt(s.due, true)) });
      actions.innerHTML = '<a class="btn btn-primary" href="card.html">' + esc(t("btn_card")) + '</a><a class="btn" href="find.html">' + esc(t("btn_see_centres")) + "</a>";
      level = s.progress; btext.textContent = Math.round(s.progress * 100) + "%";
      cap.textContent = t("cap_rebuild", { d: s.total - s.left, t: s.total });
    }
    if (s.kind !== "wait" && title.textContent.length > 18) title.classList.add("long");
    var h = 118 * level;
    fill.setAttribute("y", String(36 + 118 - h));
    fill.setAttribute("height", String(h));
    btext.classList.toggle("dim", level < 0.45);
    btext.setAttribute("y", String(level < 0.45 ? 80 : 104));

    var u = userLoc(), body = $("near-body"), chip = $("near-dist"), dir = $("near-dir");
    if (u) {
      var n = centresByDistance()[0];
      body.innerHTML = '<p class="near-name">' + esc(n.c.name) + '</p><p class="near-meta">' + esc(t("near_meta", { town: n.c.town, prov: n.c.province, from: fromLabel(u) })) + "</p>";
      chip.hidden = false; chip.textContent = fmtKm(n.km);
      dir.hidden = false; dir.href = directionsUrl(n.c);
      $("near-btn").textContent = t("btn_see_all");
    } else {
      body.innerHTML = '<p class="near-name">' + esc(t("near_find_title")) + '</p><p class="near-meta">' + esc(t("near_find_meta")) + "</p>";
      chip.hidden = true; dir.hidden = true;
      $("near-btn").textContent = t("btn_open_map");
    }
    var wa = $("wa-btn");
    if (wa) wa.href = "https://wa.me/?text=" + encodeURIComponent(t("share_msg", { url: shareUrl() }));
  }

  function shareUrl() {
    if (!/^https?:$/.test(location.protocol)) return SITE_URL;
    return location.origin + location.pathname.replace(/[^/]*$/, "");
  }
  function copyLink() {
    var url = shareUrl();
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = url; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, url.length);
        var ok = document.execCommand && document.execCommand("copy");
        ta.remove();
        toast(ok ? t("t_copied") : t("t_copy_fail", { url: url }));
      } catch (e) { toast(t("t_copy_fail", { url: url })); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { toast(t("t_copied")); }, fallback);
    else fallback();
  }

  // ---- Donor card page ----

  function badgeSvg(bg) {
    var label = bg && bg !== "unknown" ? bg : "?";
    return '<svg class="bg-badge' + (label === "?" ? " empty" : "") + '" viewBox="0 0 60 72" aria-hidden="true">' +
      '<path d="M30 3C30 3 5 31 5 46.5a25 25 0 0 0 50 0C55 31 30 3 30 3Z"/>' +
      '<text x="30" y="56" text-anchor="middle" font-size="' + (label.length >= 3 ? 15 : 19) + '">' + esc(label) + "</text></svg>";
  }

  function renderCard() {
    if (!$("profile-box")) return;
    var p = state.profile, meta = [];
    if (p.sex) meta.push(t(p.sex === "m" ? "sex_m" : "sex_f"));
    if (p.bloodGroup && p.bloodGroup !== "unknown") meta.push(t("f_bg") + " " + p.bloodGroup);
    if (p.phone) meta.push(p.phone);
    if (p.email) meta.push(p.email);
    var chips = p.types.map(function (ty) { return '<span class="tchip ' + ty + '">' + esc(typeName(ty)) + "</span>"; }).join("");
    $("profile-box").innerHTML = badgeSvg(p.bloodGroup) +
      '<div class="profile-body"><h2>' + esc(p.name || t("card_donor")) + "</h2>" +
      (meta.length ? '<p class="profile-meta">' + meta.map(esc).join(" · ") + "</p>" : "") +
      (chips ? '<div class="type-chips">' + chips + "</div>" : "") + "</div>";
    $("profile-nudge").hidden = !!p.registered;
    var ch = [t("ch_app")];
    if (p.sms) ch.push(t("ch_sms"));
    if (p.emailOn) ch.push(t("ch_email"));
    $("profile-reminders").textContent = t("card_reminders", { list: ch.join(", ") }) + (p.sms || p.emailOn ? " · " + t("card_pilot") : "");
    var needSex = !p.sex && (state.donations.some(function (d) { return d.type === "whole"; }) || p.types.indexOf("whole") >= 0 || !p.types.length);
    $("sex-note").hidden = !needSex;
    $("sex-note").textContent = t("sex_unknown_note", { f: RULES.whole.f.months });
    var pb = $("profile-btn");
    pb.textContent = p.registered ? t("btn_edit_profile") : t("btn_add_details");
    pb.classList.toggle("btn-primary", !p.registered);
    drawCardSoon();

    var s = status(), info = nextInfo(), due = info ? info.due : null;
    if (s.kind === "none") {
      $("next-date").textContent = t("not_set");
      $("next-rel").textContent = t("rel_none");
    } else if (s.kind === "ready") {
      $("next-date").textContent = fmt(due);
      $("next-rel").textContent = s.overdue === 0 ? t("rel_today") : t("rel_overdue", { n: s.overdue, unit: dayUnit(s.overdue) });
    } else {
      $("next-date").textContent = fmt(due);
      $("next-rel").textContent = t("rel_wait", { n: s.left, unit: dayUnit(s.left) });
    }
    var basis = $("next-basis");
    basis.hidden = !info;
    if (info) basis.textContent = t("basis", { type: typeName(info.from.type, true), date: fmt(info.from.date) });

    $("ics-btn").disabled = !due;
    var g = $("gcal-btn");
    if (due) { g.href = gcalUrl(info); g.removeAttribute("aria-disabled"); g.classList.remove("is-off"); }
    else { g.href = "#"; g.setAttribute("aria-disabled", "true"); g.classList.add("is-off"); }
    renderNotify();
    $("notify-status").textContent = info ? t("notify_status_due", { every: everyText(info.iv), date: fmt(due) }) : t("notify_status_none");

    var counts = { whole: 0, platelets: 0, plasma: 0 };
    state.donations.forEach(function (d) { counts[d.type] = (counts[d.type] || 0) + 1; });
    $("type-stats").innerHTML = '<div class="stat"><b>' + state.donations.length + "</b><span>" + esc(t("stat_total")) + "</span></div>" +
      TYPES.map(function (ty) { return '<div class="stat"><b>' + counts[ty] + "</b><span>" + esc(typeName(ty)) + "</span></div>"; }).join("");

    var list = sortedDonations();
    $("history").innerHTML = !list.length ? '<li class="empty">' + esc(t("history_empty")) + "</li>" : list.map(function (d) {
      return '<li><span class="h-date">' + esc(fmt(d.date)) + "</span>" +
        '<span class="h-mid"><span class="tchip ' + d.type + '">' + esc(typeName(d.type)) + '</span><span class="h-where">' + esc(centreLabel(d.centre)) + "</span></span>" +
        '<button class="icon-btn" type="button" data-remove="' + d.id + '" aria-label="' + esc(t("remove_aria", { date: fmt(d.date) })) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>';
    }).join("");
  }

  function renderNotify() {
    var btn = $("notify-btn");
    if (!btn) return;
    if (!("Notification" in window)) { btn.hidden = true; return; }
    var p;
    try { p = Notification.permission; } catch (e) { btn.hidden = true; return; }
    btn.hidden = false;
    btn.disabled = p !== "default";
    $("notify-label").textContent = p === "granted" ? t("notify_on") : p === "denied" ? t("notify_blocked") : t("notify_off");
  }

  // ---- Card picture (canvas) ----
  // Only shows what is safe to share: no phone number, no email.

  var CARD = { w: 1080, h: 680, bg1: "#7E0C22", bg2: "#B0142F", cream: "#FBF1EA", copper: "#E39E64", ink: "#FFFFFF" };
  var DISPLAY = '"Archivo", "Arial Narrow", Arial, sans-serif';
  var BODY = '"Figtree", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var drawQueued = false;

  function drawCardSoon() {
    if (drawQueued || !$("card-canvas")) return;
    drawQueued = true;
    var go = function () { drawQueued = false; try { drawCard($("card-canvas")); } catch (e) {} };
    if (window.requestAnimationFrame) requestAnimationFrame(go); else setTimeout(go, 0);
  }
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  // Same zigzag as the band under the header.
  function drawBand(ctx, x, y, w, h) {
    for (var k = -1; k * h < w + h; k++) {
      var bx = x + k * h;
      ctx.fillStyle = CARD.copper;
      ctx.beginPath(); ctx.moveTo(bx - h / 2, y); ctx.lineTo(bx + h / 2, y); ctx.lineTo(bx, y + h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = CARD.cream;
      ctx.beginPath(); ctx.moveTo(bx, y + h); ctx.lineTo(bx + h / 2, y); ctx.lineTo(bx + h, y + h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = CARD.bg2;
      ctx.beginPath(); ctx.arc(bx + h / 2, y + h * 0.72, h * 0.11, 0, Math.PI * 2); ctx.fill();
    }
  }
  function fitText(ctx, text, maxW, weight, size, minSize, family) {
    var s = size;
    ctx.font = weight + " " + s + "px " + family;
    while (ctx.measureText(text).width > maxW && s > minSize) { s -= 2; ctx.font = weight + " " + s + "px " + family; }
    if (ctx.measureText(text).width <= maxW) return text;
    var out = text;
    while (out.length > 1 && ctx.measureText(out + "…").width > maxW) out = out.slice(0, -1);
    return out + "…";
  }
  function wrapLines(ctx, text, maxW) {
    var lines = [], line = "";
    text.split(" ").forEach(function (w) {
      var test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }
  function drawCard(canvas) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d"), p = state.profile, W = CARD.w, H = CARD.h;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    roundRectPath(ctx, 0, 0, W, H, 40); ctx.clip();
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, CARD.bg1); g.addColorStop(1, CARD.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawBand(ctx, 0, 0, W, 34);
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = CARD.copper; ctx.font = "700 28px " + BODY;
    ctx.fillText(("Pulumutsa Moyo · " + t("ci_head")).toUpperCase(), 64, 104);
    ctx.fillStyle = CARD.ink;
    ctx.fillText(fitText(ctx, p.name || t("card_donor"), 640, "900", 78, 46, DISPLAY), 64, 190);

    // Blood group in a drop, top right
    var bg = p.bloodGroup && p.bloodGroup !== "unknown" ? p.bloodGroup : "?";
    ctx.save();
    ctx.translate(908, 70); ctx.scale(2.6, 2.6);
    ctx.fillStyle = CARD.cream;
    ctx.beginPath(); ctx.moveTo(30, 3); ctx.bezierCurveTo(30, 3, 5, 31, 5, 46.5);
    ctx.arc(30, 46.5, 25, Math.PI, 0, true); ctx.bezierCurveTo(55, 31, 30, 3, 30, 3); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = CARD.bg2; ctx.textAlign = "center";
    ctx.font = "900 " + (bg.length >= 3 ? 48 : 60) + "px " + DISPLAY;
    ctx.fillText(bg, 986, 222);
    ctx.textAlign = "left";

    var info = nextInfo(), l = latest();
    [[t("ci_donations"), String(state.donations.length), 64],
     [t("ci_last"), l ? fmt(l.date) : t("ci_none"), 250],
     [t("ci_next"), info ? fmt(info.due) : t("ci_none"), 500]].forEach(function (c) {
      ctx.fillStyle = CARD.copper; ctx.font = "700 24px " + BODY; ctx.fillText(c[0].toUpperCase(), c[2], 300);
      ctx.fillStyle = CARD.ink;
      var first = c[2] === 64;
      ctx.fillText(fitText(ctx, c[1], first ? 170 : 236, "800", first ? 64 : 40, 26, DISPLAY), c[2], first ? 366 : 356);
    });

    var types = (p.types.length ? p.types : sortedDonations().map(function (d) { return d.type; }))
      .filter(function (x, i, a) { return a.indexOf(x) === i; }).map(function (ty) { return typeName(ty); });
    if (types.length) {
      ctx.fillStyle = CARD.cream;
      ctx.fillText(fitText(ctx, types.join("  ·  "), 680, "600", 28, 20, BODY), 64, 450);
    }

    // QR code that opens the app
    var qx = 800, qy = 300, qs = 216;
    ctx.fillStyle = "#FFFFFF"; roundRectPath(ctx, qx, qy, qs, qs, 20); ctx.fill();
    if (typeof qrcode === "function") {
      var qr = qrcode(0, "M"); qr.addData(shareUrl()); qr.make();
      var n = qr.getModuleCount(), pad = 14, cell = (qs - pad * 2) / n;
      ctx.fillStyle = "#1F1517";
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(Math.floor(qx + pad + c * cell), Math.floor(qy + pad + r * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
    ctx.fillStyle = CARD.cream; ctx.font = "600 21px " + BODY; ctx.textAlign = "center";
    wrapLines(ctx, t("ci_scan"), 250).slice(0, 2).forEach(function (ln, i) { ctx.fillText(ln, qx + qs / 2, qy + qs + 34 + i * 26); });
    ctx.textAlign = "left";

    ctx.globalAlpha = 0.72; ctx.fillStyle = CARD.ink;
    ctx.fillText(fitText(ctx, t("ci_note"), 680, "500", 22, 16, BODY), 64, 630);
    ctx.globalAlpha = 1;
    ctx.restore();
    canvas.setAttribute("aria-label", t("card_img_title") + ": " + (p.name || t("card_donor")) + ", " + bg);
  }
  function dataUrlToBlob(d) {
    var bin = atob(d.split(",")[1]), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: "image/png" });
  }
  // On phones this opens the share sheet (which has "Save Image"); elsewhere it downloads.
  function saveCard() {
    var canvas = $("card-canvas");
    try {
      drawCard(canvas);
      var blob = dataUrlToBlob(canvas.toDataURL("image/png")), fname = "pulumutsa-moyo-donor-card.png", file = null;
      try { file = new File([blob], fname, { type: "image/png" }); } catch (e) {}
      var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      if (file && coarse && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "Pulumutsa Moyo" }).catch(function () {});
        return;
      }
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast(t("t_card_saved"));
    } catch (e) { toast(t("t_card_fail")); }
  }

  // ---- Calendar reminder ----

  function icsEscape(s) { return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
  function foldLine(line) { // ICS lines over 75 bytes get folded
    var out = [], bytes = 0, cur = "";
    for (var i = 0; i < line.length; i++) {
      var ch = line[i], b = unescape(encodeURIComponent(ch)).length;
      if (bytes + b > 74) { out.push(cur); cur = " "; bytes = 1; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.join("\r\n");
  }
  function rrule(iv) { return iv.months ? "RRULE:FREQ=MONTHLY;INTERVAL=" + iv.months : "RRULE:FREQ=WEEKLY;INTERVAL=" + Math.max(1, Math.round(iv.days / 7)); }
  function buildICS(info) {
    var due = info.due, now = new Date();
    var stamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + "T" + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + "Z";
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pulumutsa Moyo//Donation reminder//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:pulumutsa-moyo-" + compact(due) + "-" + now.getTime() + "@pulumutsa-moyo",
      "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + compact(due),
      "DTEND;VALUE=DATE:" + compact(addDays(due, 1)),
      rrule(info.iv),
      "SUMMARY:" + icsEscape(t("n_title")),
      "DESCRIPTION:" + icsEscape(t("cal_desc")),
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEscape(t("n_title")), "TRIGGER:PT9H", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR", ""
    ].map(foldLine).join("\r\n");
  }
  function gcalUrl(info) {
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(t("n_title")) +
      "&dates=" + compact(info.due) + "/" + compact(addDays(info.due, 1)) +
      "&details=" + encodeURIComponent(t("cal_desc")) +
      "&recur=" + encodeURIComponent(rrule(info.iv));
  }
  function downloadICS() {
    var info = nextInfo(); if (!info) return;
    if (IS_IOS) { // Safari opens a calendar file straight into "Add to Calendar"
      try { window.location.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(buildICS(info)); return; } catch (e) {}
    }
    try {
      var url = URL.createObjectURL(new Blob([buildICS(info)], { type: "text/calendar;charset=utf-8" }));
      var a = document.createElement("a");
      a.href = url; a.download = "give-blood-reminder.ics";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast(t("t_ics_ok"));
    } catch (e) { toast(t("t_ics_fail")); }
  }

  // ---- Browser notification on the due date ----

  function checkDue() {
    if (status().kind !== "ready") return;
    try { if (!("Notification" in window) || Notification.permission !== "granted") return; } catch (e) { return; }
    var td = todayISO();
    if (state.lastNotified === td) return;
    try {
      var opts = { body: t("n_body"), tag: "pm-due", lang: state.lang, icon: "icons/icon-192.png" };
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration().then(function (reg) { if (reg) reg.showNotification(t("n_title"), opts); else new Notification(t("n_title"), opts); }).catch(function () {});
      } else new Notification(t("n_title"), opts);
      state.lastNotified = td; save();
    } catch (e) {}
  }

  // ---- Map (find page) ----

  var map = null, tiles = null, markers = {}, youMarker = null;
  function isDark() { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; }
  function tileUrl() { return "https://{s}.basemaps.cartocdn.com/" + (isDark() ? "dark_all" : "light_all") + "/{z}/{x}/{y}{r}.png"; }
  function popupHtml(c) {
    return "<b>" + esc(c.name) + "</b>" + esc(t("prov_line", { town: c.town, prov: c.province })) +
      (c.place ? "<br>" + esc(c.place) : "") + (c.phone ? "<br>" + esc(c.phone) : "") +
      '<br><a href="' + directionsUrl(c) + '" target="_blank" rel="noopener">' + esc(t("btn_directions")) + "</a>";
  }
  function initMap() {
    var box = $("map");
    if (!box || map || typeof L === "undefined") return; // without Leaflet the drawn map in the page stays
    box.innerHTML = "";
    map = L.map(box, { zoomControl: true, scrollWheelZoom: false, zoomSnap: 0.25 });
    map.fitBounds([[-18.1, 21.9], [-8.2, 33.8]], { padding: [10, 10] });
    tiles = L.tileLayer(tileUrl(), {
      subdomains: "abcd", maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    var tileFail = 0;
    tiles.on("tileerror", function () { if (++tileFail === 1) box.classList.add("no-tiles"); });
    tiles.on("tileload", function () { box.classList.remove("no-tiles"); });
    var world = [[-85, -179.9], [-85, 179.9], [85, 179.9], [85, -179.9]];
    L.polygon([world].concat(ZAMBIA), { className: "zm-mask", interactive: false }).addTo(map);
    L.polygon(ZAMBIA, { className: "zm-outline", interactive: false, fill: false }).addTo(map);
    CENTRES.forEach(function (c) {
      var m = L.marker([c.lat, c.lng], {
        icon: L.divIcon({ className: "pin", html: '<span class="pin-drop"></span>', iconSize: [28, 34], iconAnchor: [14, 32], popupAnchor: [0, -28] }),
        title: c.name + ", " + c.town, keyboard: true, riseOnHover: true, bubblingMouseEvents: false
      }).addTo(map);
      m.bindPopup(popupHtml(c), { autoPanPaddingTopLeft: [60, 24], autoPanPadding: [16, 16] }); // keep clear of the zoom buttons
      m.bindTooltip(c.town, { permanent: true, direction: "right", offset: [12, -16], className: "pin-label", interactive: false });
      m.on("click", function () { highlight(c.id, false); });
      markers[c.id] = m;
    });
    drawYou();
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () { if (tiles) tiles.setUrl(tileUrl()); };
      if (mq.addEventListener) mq.addEventListener("change", onChange); else if (mq.addListener) mq.addListener(onChange);
    }
    setTimeout(function () { map.invalidateSize(); }, 50);
    setTimeout(function () { map.invalidateSize(); }, 400);
  }
  function refreshPopups() { Object.keys(markers).forEach(function (id) { markers[id].setPopupContent(popupHtml(centreById(id))); }); }
  function drawYou() {
    if (!map) return;
    var u = userLoc();
    if (youMarker) { map.removeLayer(youMarker); youMarker = null; }
    if (!u) return;
    youMarker = L.marker([u.lat, u.lng], {
      icon: L.divIcon({ className: "pin", html: '<span class="you-dot"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      keyboard: false, interactive: false, zIndexOffset: -100
    }).addTo(map);
  }
  function fitToNearest() {
    if (!map) return;
    var u = userLoc(); if (!u) return;
    var n = centresByDistance()[0].c;
    map.fitBounds(L.latLngBounds([[u.lat, u.lng], [n.lat, n.lng]]).pad(0.6), { maxZoom: 11 });
  }
  function highlight(id, fly) {
    Array.prototype.forEach.call(document.querySelectorAll(".centre"), function (el) { el.classList.toggle("active", el.getAttribute("data-id") === id); });
    Object.keys(markers).forEach(function (k) { var el = markers[k].getElement && markers[k].getElement(); if (el) el.classList.toggle("active", k === id); });
    var card = document.querySelector('.centre[data-id="' + id + '"]');
    if (card && !fly) { try { card.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { card.scrollIntoView(false); } }
    if (fly && map && markers[id]) {
      var c = centreById(id);
      map.once("moveend", function () { markers[id].openPopup(); });
      map.flyTo([c.lat, c.lng], c.exact ? 14 : 11, { duration: 0.8 });
      try { $("map").scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { $("map").scrollIntoView(true); }
    }
  }

  function centreItem(row) {
    var c = row.c;
    return '<li class="centre" data-id="' + c.id + '">' +
      '<div class="centre-top"><span class="prov">' + esc(c.province) + (c.hq ? " · " + esc(t("hq")) : "") + "</span>" +
      (row.km !== null ? '<span class="dist">' + esc(fmtKm(row.km)) + "</span>" : "") + "</div>" +
      "<h3>" + esc(c.name) + "</h3>" +
      '<p class="town">' + esc(c.town) + (c.place ? ", " + esc(c.place) : "") + "</p>" + phoneHtml(c) +
      (c.exact ? "" : '<p class="pin-note">' + esc(t("pin_town")) + "</p>") +
      '<div class="btn-row"><button class="btn btn-sm" type="button" data-show="' + c.id + '">' + esc(t("show_on_map")) + "</button>" +
      '<a class="btn btn-sm btn-quiet" href="' + directionsUrl(c) + '" target="_blank" rel="noopener">' + esc(t("btn_directions")) + "</a></div></li>";
  }
  function renderFind() {
    var list = $("centre-list");
    if (!list) return;
    list.innerHTML = centresByDistance().map(centreItem).join("");
    var u = userLoc();
    $("near").value = state.near && u && u.label === state.near ? state.near : "";
    drawYou();
  }

  // ---- Selects and the log form ----

  function setLogType(type) { var r = $("lt-" + (TYPES.indexOf(type) >= 0 ? type : "whole")); if (r) r.checked = true; }
  function logType() { for (var i = 0; i < TYPES.length; i++) if ($("lt-" + TYPES[i]).checked) return TYPES[i]; return "whole"; }

  function fillSelects(keep) {
    var near = $("near");
    if (near) near.innerHTML = '<option value="">' + esc(t("choose_town")) + "</option>" + TOWNS.map(function (tw) { return '<option value="' + tw[0] + '">' + tw[0] + "</option>"; }).join("");
    var centre = $("log-centre"), date = $("log-date");
    if (!centre) return;
    var prevCentre = centre.value, prevDate = date.value;
    centre.innerHTML = CENTRES.slice().sort(function (a, b) { return a.town.localeCompare(b.town); })
      .map(function (c) { return '<option value="' + c.id + '">' + esc(c.town) + " · " + esc(c.name) + "</option>"; }).join("") +
      '<option value="mobile">' + esc(t("opt_mobile")) + '</option><option value="other">' + esc(t("opt_other")) + "</option>";
    date.max = todayISO();
    if (keep && prevCentre) { centre.value = prevCentre; date.value = prevDate; }
    else {
      var u = userLoc();
      centre.value = u ? centresByDistance()[0].c.id : "lusaka";
      date.value = todayISO();
      setLogType(preferredType());
    }
  }

  function renderClear() {
    var wrap = $("clear-wrap");
    if (!wrap) return;
    wrap.innerHTML = '<button class="btn btn-sm btn-quiet" type="button" id="clear-btn">' + esc(t("clear")) + "</button>";
    $("clear-btn").addEventListener("click", askClear);
  }
  function askClear() {
    $("clear-wrap").innerHTML = '<span class="small">' + esc(t("clear_q")) + "</span>" +
      '<button class="btn btn-sm btn-danger" type="button" id="clear-yes">' + esc(t("del")) + "</button>" +
      '<button class="btn btn-sm btn-quiet" type="button" id="clear-no">' + esc(t("keep")) + "</button>";
    $("clear-yes").addEventListener("click", function () {
      var lang = state.lang;
      state = defaults(); state.lang = lang; save();
      flash(t("t_cleared"));
      location.href = "start.html";
    });
    $("clear-no").addEventListener("click", renderClear);
  }

  function renderAll() { renderHome(); renderCard(); renderFind(); }

  // ---- Sign-up / profile form (start page) ----

  var formBg = "";
  function renderBgChips() {
    var box = $("p-bg");
    if (!box) return;
    box.innerHTML = BLOOD_GROUPS.map(function (b) {
      return '<button type="button" aria-pressed="' + (formBg === b) + '" data-bg="' + b + '">' + b + "</button>";
    }).join("") + '<button type="button" class="unknown" aria-pressed="' + (formBg === "unknown") + '" data-bg="unknown">' + esc(t("not_sure")) + "</button>";
  }
  function syncChecks() {
    Array.prototype.forEach.call(document.querySelectorAll(".profile-form .check"), function (lab) {
      var inp = lab.querySelector("input");
      lab.classList.toggle("on", !!(inp && inp.checked));
    });
  }
  function renderWelcomeText() {
    if (!$("profile-form")) return;
    var reg = state.profile.registered;
    $("w-eyebrow").textContent = reg ? t("eyebrow_profile") : t("welcome_eyebrow");
    $("w-title").textContent = reg ? t("prof_edit_title") : t("welcome_title");
    $("p-save").textContent = reg ? t("btn_save_changes") : t("btn_save_profile");
    $("p-skip").textContent = reg ? t("btn_cancel") : t("btn_skip");
  }
  function fillProfileForm() {
    var p = state.profile;
    $("p-name").value = p.name || "";
    $("p-phone").value = p.phone || "";
    $("p-email").value = p.email || "";
    $("sex-m").checked = p.sex === "m";
    $("sex-f").checked = p.sex === "f";
    TYPES.forEach(function (ty) { $("pt-" + ty).checked = p.types.indexOf(ty) >= 0; });
    $("ch-sms").checked = !!p.sms;
    $("ch-email").checked = !!p.emailOn;
    $("p-consent").checked = !!p.consent;
    formBg = p.bloodGroup || "";
    $("p-error").hidden = true;
    renderBgChips(); syncChecks(); renderWelcomeText();
  }
  function formError(key, fieldId) {
    var err = $("p-error");
    err.textContent = t(key); err.hidden = false;
    var f = $(fieldId);
    if (f) { try { f.focus({ preventScroll: false }); } catch (e) { f.focus(); } }
    return false;
  }
  function submitProfile(e) {
    e.preventDefault();
    $("p-error").hidden = true;
    var phoneRaw = $("p-phone").value.trim(), emailRaw = $("p-email").value.trim(), phone = "", email = "";
    if (phoneRaw) { phone = normPhone(phoneRaw); if (!phone) return formError("err_phone", "p-phone"); }
    if (emailRaw) { if (!EMAIL_RE.test(emailRaw)) return formError("err_email", "p-email"); email = emailRaw; }
    var sms = $("ch-sms").checked, em = $("ch-email").checked;
    if (sms && !phone) return formError("err_need_phone", "p-phone");
    if (em && !email) return formError("err_need_email", "p-email");
    if ((sms || em) && !$("p-consent").checked) return formError("err_consent", "p-consent");
    var p = state.profile, first = !p.registered;
    p.name = $("p-name").value.trim().slice(0, 80);
    p.phone = phone; p.email = email;
    p.sex = $("sex-m").checked ? "m" : $("sex-f").checked ? "f" : "";
    p.bloodGroup = formBg;
    p.types = TYPES.filter(function (ty) { return $("pt-" + ty).checked; });
    p.sms = sms; p.emailOn = em; p.consent = $("p-consent").checked;
    p.registered = true; p.skipped = false;
    state.lastNotified = "";
    save();
    flash(t("t_profile_saved"));
    location.href = first ? "index.html" : "card.html";
  }
  function skipProfile() {
    if (state.profile.registered) { location.href = "card.html"; return; }
    state.profile.skipped = true; save();
    location.href = "index.html";
  }

  // ---- Language ----

  function setLang(lang) {
    if (!I18N[lang]) return;
    state.lang = lang; save();
    applyStatic(); fillSelects(true); renderAll(); renderClear(); refreshPopups(); renderBgChips(); renderWelcomeText();
    ["log-error", "p-error"].forEach(function (id) { var el = $(id); if (el) el.hidden = true; });
  }
  function openLangMenu(open) {
    var menu = $("lang-menu"), btn = $("lang-btn");
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) { var cur = menu.querySelector('[data-lang="' + state.lang + '"]'); if (cur) cur.focus(); }
  }

  // ---- Donations ----

  function addDonation(date, centre, type) {
    var td = todayISO(), err = $("log-error");
    if (err) err.hidden = true;
    type = TYPES.indexOf(type) >= 0 ? type : "whole";
    function fail(msg) { if (err) { err.textContent = msg; err.hidden = false; } else toast(msg); return false; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return fail(t("err_date"));
    if (date > td) return fail(t("err_future"));
    if (date < "1970-01-01") return fail(t("err_year"));
    for (var i = 0; i < state.donations.length; i++) {
      if (state.donations[i].date === date && state.donations[i].type === type) return fail(t("err_dup", { type: typeName(type, true), date: fmt(date) }));
    }
    state.donations.push({ id: "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: date, centre: centre || "", type: type });
    state.lastNotified = "";
    save(); renderAll();
    toast(t("t_saved", { date: fmt(nextDue()) }));
    return true;
  }
  function removeDonation(id) {
    var idx = -1;
    for (var i = 0; i < state.donations.length; i++) if (state.donations[i].id === id) idx = i;
    if (idx < 0) return;
    var removed = state.donations.splice(idx, 1)[0];
    save(); renderAll();
    toast(t("t_removed", { date: fmt(removed.date) }), t("t_undo"), function () { state.donations.push(removed); save(); renderAll(); });
  }
  function setLocation(loc) { state.loc = loc; save(); renderAll(); fitToNearest(); }

  function locate() {
    var btn = $("locate");
    if (!navigator.geolocation || window.isSecureContext === false) { toast(t("t_no_geo")); return; }
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      state.near = "";
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "@you" });
      toast(t("t_geo_ok"));
    }, function () {
      btn.disabled = false;
      toast(t("t_geo_fail"));
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  }

  // ---- Wiring ----

  function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }

  document.addEventListener("click", function (e) {
    var el = elOf(e.target);
    if (!el) return;
    var pick = el.closest("[data-pick-lang]");
    if (pick) {
      var lang = pick.getAttribute("data-pick-lang");
      if (lang !== state.lang) { setLang(lang); toast(t("lang_set")); }
      return;
    }
    var show = el.closest("[data-show]");
    if (show) { highlight(show.getAttribute("data-show"), true); return; }
    var rm = el.closest("[data-remove]");
    if (rm) { removeDonation(rm.getAttribute("data-remove")); return; }
    var bg = el.closest("[data-bg]");
    if (bg) { var v = bg.getAttribute("data-bg"); formBg = formBg === v ? "" : v; renderBgChips(); return; }
    var act = el.closest("[data-act]");
    if (act && act.getAttribute("data-act") === "today") {
      var u = userLoc();
      addDonation(todayISO(), u ? centresByDistance()[0].c.id : "", preferredType());
    }
  });

  on("lang-btn", "click", function (e) { e.stopPropagation(); openLangMenu($("lang-menu").hidden); });
  on("lang-menu", "click", function (e) {
    var tg = elOf(e.target), b = tg ? tg.closest("[data-lang]") : null;
    if (!b) return;
    e.stopPropagation();
    var changed = b.getAttribute("data-lang") !== state.lang;
    setLang(b.getAttribute("data-lang"));
    openLangMenu(false);
    $("lang-btn").focus();
    if (changed) toast(t("lang_set"));
  });
  on("lang-menu", "keydown", function (e) {
    var items = Array.prototype.slice.call($("lang-menu").querySelectorAll("[data-lang]")), i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && $("lang-menu") && !$("lang-menu").hidden) { openLangMenu(false); $("lang-btn").focus(); }
  });
  // iPhone Safari doesn't send "click" for taps on empty space, so listen for pointerdown.
  function outsideClose(e) {
    var el = elOf(e.target);
    if ($("lang-menu") && !$("lang-menu").hidden && !(el && el.closest(".lang"))) openLangMenu(false);
  }
  if (window.PointerEvent) document.addEventListener("pointerdown", outsideClose);
  else { document.addEventListener("touchstart", outsideClose, { passive: true }); document.addEventListener("mousedown", outsideClose); }

  on("profile-form", "submit", submitProfile);
  on("profile-form", "change", syncChecks);
  on("p-skip", "click", skipProfile);
  on("log-form", "submit", function (e) { e.preventDefault(); addDonation($("log-date").value, $("log-centre").value, logType()); });
  on("today-btn", "click", function () { $("log-date").value = todayISO(); addDonation(todayISO(), $("log-centre").value, logType()); });
  on("ics-btn", "click", downloadICS);
  on("card-save", "click", saveCard);
  on("copy-btn", "click", copyLink);
  on("locate", "click", locate);
  on("near", "change", function (e) {
    var name = e.target.value;
    if (!name) { state.near = ""; setLocation(null); return; }
    for (var i = 0; i < TOWNS.length; i++) if (TOWNS[i][0] === name) { state.near = name; setLocation({ lat: TOWNS[i][1], lng: TOWNS[i][2], label: name }); }
  });
  on("notify-btn", "click", function () {
    if (!("Notification" in window)) return;
    try {
      var p = Notification.requestPermission(function () { renderNotify(); checkDue(); });
      if (p && p.then) p.then(function (res) {
        renderNotify();
        if (res === "granted") toast(t("t_notify_on"));
        else if (res === "denied") toast(t("t_notify_blocked"));
        checkDue();
      });
    } catch (e) { toast(t("t_notify_none")); }
  });

  window.addEventListener("orientationchange", function () { if (map) setTimeout(function () { map.invalidateSize(); }, 300); });
  window.addEventListener("pageshow", function (e) { if (e.persisted) { state = load(); applyStatic(); renderAll(); } });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { renderAll(); checkDue(); } });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawCardSoon);

  // ---- Start ----

  if (PAGE === "home") {
    // Links from before the app had separate pages used #find, #remind and so on.
    var OLD = { "#find": "find.html", "#remind": "card.html", "#info": "info.html", "#welcome": "start.html" };
    if (OLD[location.hash]) { location.replace(OLD[location.hash]); return; }
    // First visit: ask for language and details before anything else.
    if (!state.profile.registered && !state.profile.skipped) { location.replace("start.html"); return; }
  }

  applyStatic();
  fillSelects(false);
  if (PAGE === "start") fillProfileForm();
  renderAll();
  renderClear();
  initMap();
  checkDue();
  var msg = takeFlash();
  if (msg) toast(msg);
  if (PAGE === "home") setInterval(function () { renderHome(); checkDue(); }, 60 * 60 * 1000);
})();

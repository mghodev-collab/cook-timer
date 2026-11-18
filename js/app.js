(function () {
  "use strict";

  var FOODS = window.FOODS || [];
  var STORAGE_KEY = "kitchen-timer:v1";
  var CUSTOM_ID = "custom";

  // ───────── helpers ─────────
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function clock(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ":" + pad(m) : pad(m)) + ":" + pad(s);
  }
  function human(sec) {
    var m = Math.floor(sec / 60), s = sec % 60, out = [];
    if (m) out.push(m + "분");
    if (s) out.push(s + "초");
    return out.join(" ") || "0초";
  }
  function findFood(id) {
    for (var i = 0; i < FOODS.length; i++) if (FOODS[i].id === id) return FOODS[i];
    return null;
  }

  // ───────── audio (unlocked on first tap for iOS) ─────────
  var audioCtx = null;
  function unlockAudio() {
    if (audioCtx) { if (audioCtx.state === "suspended") audioCtx.resume(); return; }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) { try { audioCtx = new Ctx(); } catch (e) {} }
  }
  function beep() {
    if (!audioCtx) return;
    var t0 = audioCtx.currentTime;
    [0, 0.25, 0.5].forEach(function (d) {
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, t0 + d);
      g.gain.setValueAtTime(0.3, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + d + 0.2);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0 + d); o.stop(t0 + d + 0.22);
    });
  }
  document.addEventListener("pointerdown", unlockAudio, { passive: true });

  // ───────── state ─────────
  // timer: { id, food, title, total, endAt|null, remaining (when paused), done, ack }
  var timers = [];
  try { timers = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { timers = []; }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(timers)); } catch (e) {} }
  function remainingOf(t) { return t.endAt ? (t.endAt - Date.now()) / 1000 : t.remaining; }

  // ───────── tabs & options ─────────
  var tabNav = $("#tabNav");
  var panel = $("#panel");
  var activeId = null;

  function buildTabs() {
    FOODS.concat([{ id: CUSTOM_ID, emoji: "⏱️", name: "직접 설정" }]).forEach(function (f) {
      var b = el("button", "tab");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.dataset.id = f.id;
      b.innerHTML = '<span class="tab-emoji" aria-hidden="true">' + f.emoji + "</span><span>" + f.name + "</span>";
      b.addEventListener("click", function () {
  if (window.SITE_ROOT) {
    location.href = window.SITE_ROOT + (f.id === "custom" ? "#custom" : f.id + "/");
  } else {
    selectFood(f.id, true);
  }
});
      tabNav.appendChild(b);
    });
  }

  function selectFood(id, updateHash) {
    if (id !== CUSTOM_ID && !findFood(id)) id = FOODS[0].id;
    activeId = id;
    var tabs = tabNav.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].dataset.id === id;
      tabs[i].classList.toggle("active", on);
      tabs[i].setAttribute("aria-selected", on ? "true" : "false");
      if (on && tabs[i].scrollIntoView) tabs[i].scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
    if (updateHash && history.replaceState) history.replaceState(null, "", "#" + id);
    if (id === CUSTOM_ID) renderCustom(); else renderFood(findFood(id));
  }

  function renderFood(food) {
    panel.innerHTML = "";
    panel.appendChild(el("h2", "panel-title", food.emoji + " " + food.title));

    var list = el("div", "choice-list");
    list.setAttribute("role", "radiogroup");
    food.options.forEach(function (o, i) {
      var lab = el("label", "choice");
      var input = el("input");
      input.type = "radio"; input.name = "opt"; input.value = i;
      if (i === 0) input.checked = true;
      var body = el("span", "choice-body");
      body.appendChild(el("span", "choice-label", o.label));
      body.appendChild(el("span", "choice-desc", o.desc || ""));
      lab.appendChild(input);
      lab.appendChild(body);
      lab.appendChild(el("span", "choice-time", clock(o.seconds)));
      list.appendChild(lab);
    });
    panel.appendChild(list);

    (food.modifiers || []).forEach(function (m) {
      var lab = el("label", "check");
      var input = el("input");
      input.type = "checkbox"; input.dataset.mod = m.id; input.checked = !!m.default;
      lab.appendChild(input);
      lab.appendChild(el("span", null, m.label + " (" + (m.seconds > 0 ? "+" : "−") + human(Math.abs(m.seconds)) + ")"));
      panel.appendChild(lab);
    });

    var summary = el("p", "summary");
    var btn = el("button", "start-btn");
    btn.type = "button";
    panel.appendChild(summary);
    if (food.hint) panel.appendChild(el("p", "hint", food.hint));
    panel.appendChild(btn);

    function compute() {
      var idx = +$("input[name=opt]:checked", panel).value;
      var opt = food.options[idx];
      var sec = opt.seconds, tags = [];
      (food.modifiers || []).forEach(function (m) {
        if ($('input[data-mod="' + m.id + '"]', panel).checked) { sec += m.seconds; tags.push(m.label.split(" (")[0]); }
      });
      return { sec: Math.max(5, sec), opt: opt, tags: tags };
    }
    function refresh() {
      var c = compute();
      summary.innerHTML = "총 조리 시간 <strong>" + human(c.sec) + "</strong>";
      btn.textContent = food.name + " 타이머 시작";
    }
    panel.onchange = refresh;
    refresh();

    btn.addEventListener("click", function () {
      var c = compute();
      addTimer(food.id, food.emoji + " " + food.name + " · " + c.opt.label, c.sec);
    });

    renderTips(food);
  }

  function renderCustom() {
    panel.innerHTML = "";
    panel.onchange = null;
    panel.appendChild(el("h2", "panel-title", "⏱️ 직접 시간 설정"));
    var row = el("div", "custom-row");
    row.innerHTML =
      '<label class="num"><input id="cMin" type="number" inputmode="numeric" min="0" max="180" value="5"><span>분</span></label>' +
      '<label class="num"><input id="cSec" type="number" inputmode="numeric" min="0" max="59" value="0"><span>초</span></label>';
    panel.appendChild(row);

    var presets = el("div", "presets");
    [60, 180, 300, 600, 900, 1800].forEach(function (s) {
      var p = el("button", "preset", human(s));
      p.type = "button";
      p.addEventListener("click", function () {
        $("#cMin").value = Math.floor(s / 60); $("#cSec").value = s % 60;
      });
      presets.appendChild(p);
    });
    panel.appendChild(presets);

    var name = el("input", "text-input");
    name.type = "text"; name.placeholder = "이름 (선택) · 예: 밥 뜸 들이기"; name.maxLength = 30;
    panel.appendChild(name);

    var btn = el("button", "start-btn", "타이머 시작");
    btn.type = "button";
    btn.addEventListener("click", function () {
      var sec = (parseInt($("#cMin").value, 10) || 0) * 60 + (parseInt($("#cSec").value, 10) || 0);
      if (sec <= 0) { $("#cMin").focus(); return; }
      addTimer(CUSTOM_ID, "⏱️ " + (name.value.trim() || "내 타이머"), sec);
    });
    panel.appendChild(btn);
    renderTips(null);
  }

  function renderTips(food) {
    var box = $("#foodTips");
    box.innerHTML = "";
    if (!food || !food.tips || !food.tips.length) { box.hidden = true; return; }
    box.hidden = false;
    box.appendChild(el("h2", null, food.emoji + " " + food.name + " 요리 팁"));
    food.tips.forEach(function (t) {
      var d = el("details", "tip");
      var s = el("summary", null, "Q. " + t.q);
      var p = el("p"); p.innerHTML = t.a;
      d.appendChild(s); d.appendChild(p);
      box.appendChild(d);
    });
    box.querySelector("details").open = true;
  }

  // ───────── timers ─────────
  var listEl = $("#timerList");
  var emptyEl = $("#emptyNotice");
  var cards = {}; // id -> {root, time, bar, pauseBtn}

  function addTimer(food, title, sec) {
    unlockAudio();
    askNotify();
    timers.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      food: food, title: title, total: sec,
      endAt: Date.now() + sec * 1000, remaining: sec, done: false, ack: false
    });
    save();
    syncCards();
    tick();
    var sec2 = $("#timers");
    if (sec2 && sec2.getBoundingClientRect().top > window.innerHeight) sec2.scrollIntoView({ behavior: "smooth" });
  }

  function removeTimer(id) {
    timers = timers.filter(function (t) { return t.id !== id; });
    save(); syncCards(); tick();
  }

  function togglePause(t) {
    if (t.done) return;
    if (t.endAt) { t.remaining = remainingOf(t); t.endAt = null; }
    else { t.endAt = Date.now() + t.remaining * 1000; }
    save(); tick();
  }

  function addTime(t, s) {
    if (t.done) { t.done = false; t.ack = false; t.endAt = Date.now() + s * 1000; t.total = s; }
    else if (t.endAt) t.endAt += s * 1000;
    else t.remaining += s;
    t.total = Math.max(t.total, remainingOf(t));
    save(); tick();
  }

  function syncCards() {
    var ids = {};
    timers.forEach(function (t) { ids[t.id] = true; });
    Object.keys(cards).forEach(function (id) {
      if (!ids[id]) { cards[id].root.remove(); delete cards[id]; }
    });
    timers.forEach(function (t, i) {
      if (!cards[t.id]) cards[t.id] = buildCard(t);
      var node = cards[t.id].root;
      if (listEl.children[i] !== node) listEl.insertBefore(node, listEl.children[i] || null);
    });
    emptyEl.hidden = timers.length > 0;
    $("#clearDone").hidden = !timers.some(function (t) { return t.done; });
  }

  function buildCard(t) {
    var root = el("div", "timer");
    var bar = el("div", "timer-bar");
    var info = el("div", "timer-info");
    info.appendChild(el("div", "timer-title", t.title));
    var time = el("div", "timer-time");
    info.appendChild(time);
    var actions = el("div", "timer-actions");
    var plus = el("button", "icon-btn", "+30초");
    var pauseBtn = el("button", "icon-btn");
    var del = el("button", "icon-btn danger", "삭제");
    [plus, pauseBtn, del].forEach(function (b) { b.type = "button"; actions.appendChild(b); });
    plus.addEventListener("click", function () { addTime(t, 30); });
    pauseBtn.addEventListener("click", function () {
      if (t.done) { t.ack = true; save(); tick(); } else togglePause(t);
    });
    del.addEventListener("click", function () { removeTimer(t.id); });
    root.appendChild(bar); root.appendChild(info); root.appendChild(actions);
    return { root: root, time: time, bar: bar, pauseBtn: pauseBtn };
  }

  var lastBeep = 0;
  function tick() {
    var now = Date.now(), ringing = false, running = 0, soonest = null, changed = false;
    timers.forEach(function (t) {
      var c = cards[t.id];
      var rem = remainingOf(t);
      if (!t.done && rem <= 0) {
        t.done = true; t.endAt = null; t.remaining = 0; t.doneAt = now; changed = true;
        notify(t);
      }
      if (t.done && !t.ack && now - (t.doneAt || now) > 60000) t.ack = true; // 1분 후 자동 멈춤
      if (t.done && !t.ack) ringing = true;
      if (!t.done && t.endAt) { running++; if (soonest === null || rem < soonest.rem) soonest = { rem: rem, t: t }; }
      if (!c) return;
      c.root.classList.toggle("done", t.done);
      c.root.classList.toggle("ringing", t.done && !t.ack);
      c.root.classList.toggle("paused", !t.done && !t.endAt);
      c.time.textContent = t.done ? "완료! 🎉" : clock(rem);
      c.bar.style.transform = "scaleX(" + (t.done ? 1 : Math.min(1, 1 - rem / t.total)).toFixed(4) + ")";
      c.pauseBtn.textContent = t.done ? (t.ack ? "✓ 확인됨" : "알람 끄기") : (t.endAt ? "일시정지" : "계속");
      c.pauseBtn.disabled = t.done && t.ack;
    });
    if (changed) { save(); syncCards(); }
    if (ringing && now - lastBeep > 1500) {
      lastBeep = now; beep();
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    }
    document.title = ringing ? "⏰ 완료! · 주방 만능 타이머"
      : soonest ? clock(soonest.rem) + " · " + soonest.t.title.replace(/^\S+\s/, "")
      : BASE_TITLE;
    setWakeLock(running > 0 || ringing);
  }

  $("#clearDone").addEventListener("click", function () {
    timers = timers.filter(function (t) { return !t.done; });
    save(); syncCards(); tick();
  });

  // ───────── notifications ─────────
  function askNotify() {
    if ("Notification" in window && Notification.permission === "default") {
      try { Notification.requestPermission(); } catch (e) {}
    }
  }
  function notify(t) {
    if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
    try { new Notification("⏰ 타이머 완료", { body: t.title + " 완료!", tag: t.id }); } catch (e) {}
  }

  // ───────── screen wake lock ─────────
  var wakeLock = null, wakeWanted = false, wakePending = false;
  var wakeStatus = $("#wakeStatus");
  function setWakeLock(want) {
    if (want === wakeWanted && (!want || wakeLock)) return;
    wakeWanted = want;
    if (!("wakeLock" in navigator)) { wakeStatus.textContent = ""; return; }
    if (want && !wakeLock && !wakePending && document.visibilityState === "visible") {
      wakePending = true;
      navigator.wakeLock.request("screen").then(function (l) {
        wakePending = false;
        if (!wakeWanted) { l.release(); return; }
        wakeLock = l;
        wakeStatus.textContent = "☀️ 화면 꺼짐 방지 중";
        l.addEventListener("release", function () { wakeLock = null; wakeStatus.textContent = ""; });
      }).catch(function () { wakePending = false; wakeStatus.textContent = ""; });
    } else if (!want && wakeLock) {
      wakeLock.release(); wakeLock = null; wakeStatus.textContent = "";
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") tick();
  });

  // ───────── boot ─────────
  var BASE_TITLE = document.title;
  buildTabs();
  selectFood(window.START_FOOD || (location.hash || "").slice(1) || FOODS[0].id, false);
window.addEventListener("hashchange", function () {
  if (!window.START_FOOD) selectFood(location.hash.slice(1), false);
});
  syncCards();
  tick();
  setInterval(tick, 250);
})();

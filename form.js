/* 通話サポート 申し込みの欄を動かす（index.html から読む）。
 * 受付のウェブアプリ（config.js の SUPPORT_API_URL）と話す。サーバーから来た文字は、すべて textContent で入れる（HTML としては入れない）。
 * このタブの中だけで覚えておくもの（sessionStorage）：ログインの合言葉、Pro版の確認の合言葉、書きかけの内容。Pro版のコードそのものは覚えない。
 */
(function () {
  "use strict";
  var C = window.SUPPORT_CONFIG || {}, P = window.SUPPORT_PAGE;
  if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k) { try { return sessionStorage.getItem("vxs." + k) || ""; } catch (e) { return ""; } },
    set: function (k, v) { try { if (v) sessionStorage.setItem("vxs." + k, v); else sessionStorage.removeItem("vxs." + k); } catch (e) { /* 使えないブラウザでも動く */ } }
  };
  var API = P.apiUrl(C), INFO = null, MAX = P.values(C).presetMax, SLOTS = [];
  var FIELDS = ["first", "second", "presets", "win", "mic", "gear", "app", "trouble", "diag"];

  function say(id, text, bad) { var e = $(id); e.textContent = text || ""; e.className = "msg" + (text ? (bad ? " ng" : " ok") : ""); }
  function api(body) {
    return fetch(API, { method: "POST", body: JSON.stringify(body), redirect: "follow" })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: "net", message: "つながりませんでした。インターネットの接続を確かめて、もう一度お試しください" }; });
  }
  function off(text, closed) {
    $("form").hidden = true;
    var o = $("form-off"); o.textContent = text; o.hidden = false;
    var a = $("apply");
    a.textContent = closed ? "通話サポートの受付は終了しました" : "申し込む（準備中）";
    a.removeAttribute("href"); a.setAttribute("aria-disabled", "true");
    $("closed").hidden = !closed;
  }
  function stepOn(id, on) { $(id).disabled = !on; }

  // ---- 書きかけの内容（Discord のログインでページを離れても消えないように） ----
  function readForm() {
    var f = {};
    FIELDS.forEach(function (k) { f[k] = $(k).value; });
    f.presets = Number(f.presets || 0);
    f.consents = {};
    P.CONSENTS.forEach(function (c) { f.consents[c.key] = $("c-" + c.key).checked; });
    return f;
  }
  function saveDraft() { try { store.set("draft", JSON.stringify(readForm())); } catch (e) { /* 大きすぎるときは覚えない */ } }
  function loadDraft() {
    var d; try { d = JSON.parse(store.get("draft") || "null"); } catch (e) { d = null; }
    if (!d) return;
    FIELDS.forEach(function (k) {
      if (d[k] == null) return;
      var el = $(k), v = String(d[k]);
      if (el.tagName === "SELECT" && !Array.prototype.some.call(el.options, function (o) { return o.value === v; })) return;
      el.value = v;
    });
    P.CONSENTS.forEach(function (c) { if (d.consents && d.consents[c.key] === true) $("c-" + c.key).checked = true; });
  }
  function total() { $("total").textContent = P.yen(P.total({ CALL_PRICE_YEN: INFO.callYen, PRESET_PRICE_YEN: INFO.presetYen, PRESET_MAX: MAX }, $("presets").value)); }

  // ---- 1. ログイン ----
  function setLogin(name, keep) {
    var inn = Boolean(name);
    document.querySelector('[data-show="in"]').hidden = !inn;
    document.querySelector('[data-show="out"]').hidden = inn;
    $("who").textContent = name || "";
    stepOn("st-pro", inn);
    if (!inn) { if (!keep) store.set("s", ""); setPro("", keep); }
  }
  function startLogin() {
    if (!INFO.discord) { say("login-msg", "Discordでのログインは準備中です", true); return; }
    var b = new Uint8Array(32);
    (window.crypto || window.msCrypto).getRandomValues(b);
    var state = P.makeState(b);
    store.set("state", state);
    saveDraft();
    location.href = P.authUrl(INFO.discord, state);
  }

  // ---- 2. Pro版の確認 ----
  function setPro(last4, keep) {
    var on = Boolean(last4);
    if (!on && !keep) { store.set("ticket", ""); store.set("last4", ""); }
    ["st-detail", "st-consent", "st-send"].forEach(function (id) { stepOn(id, on); });
    if (on) say("pro-msg", "Pro版を確かめました（コードの下4桁：" + last4 + "）");
  }
  function check() {
    var code = $("code").value.trim();
    if (!code) { say("pro-msg", "コードを入れてください", true); return; }
    $("check").disabled = true; say("pro-msg", "確かめています…");
    api({ a: "check", s: store.get("s"), code: code }).then(function (r) {
      $("check").disabled = false;
      if (r.ok && r.pro) { store.set("ticket", r.ticket); store.set("last4", r.last4); $("code").value = ""; setPro(r.last4); return; }
      if (r.error === "login") setLogin("");
      say("pro-msg", r.ok ? r.message : r.message || "確かめられませんでした", true);
    });
  }

  // ---- 3. 日時 ----
  function fillSlots(keep) {
    var first = $("first"), second = $("second");
    var was = keep ? [first.value, second.value] : ["", ""];
    var opt = function (sel, v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); };
    first.textContent = ""; second.textContent = "";
    opt(first, "", SLOTS.length ? "選んでください" : "いま選べる日時がありません");
    opt(second, "", "なし");
    SLOTS.forEach(function (s) { opt(first, s.id, s.label); opt(second, s.id, s.label); });
    if (was[0]) first.value = was[0];
    if (was[1]) second.value = was[1];
    if (!SLOTS.length) $("slot-note").textContent = "いま選べる日時がありません。日時を足したら、ここに出ます（今から24時間より後の日時だけを出しています）。";
  }
  function loadSlots(keep) {
    return api({ a: "slots" }).then(function (r) {
      SLOTS = r.ok && r.slots ? r.slots : [];
      fillSlots(keep);
    });
  }

  // ---- 5. 送る・支払い ----
  function goPay(url) {
    if (!/^https:\/\/checkout\.stripe\.com\//.test(String(url || ""))) return false;
    location.href = url;
    return true;
  }
  function submit(e) {
    e.preventDefault();
    var f = readForm(), m = P.checkForm(f, MAX);
    $("pay-old").hidden = true;
    if (m) { say("send-msg", m, true); return; }
    saveDraft();
    $("send").disabled = true; say("send-msg", "送っています…");
    var body = { a: "submit", s: store.get("s"), ticket: store.get("ticket") };
    Object.keys(f).forEach(function (k) { body[k] = f[k]; });
    api(body).then(function (r) {
      $("send").disabled = false;
      if (r.ok) {
        store.set("req", r.id);
        if (goPay(r.pay)) { say("send-msg", "お支払いのページへ進みます…"); return; }
        store.set("draft", "");
        showDone("お申し込みを受け付けました", r.payMessage || "お支払いの方法は、あとでDiscordでお知らせします。", r.id, false);
        return;
      }
      if (r.error === "login") setLogin("");
      if (r.error === "pro") setPro("");
      if (r.error === "slot") loadSlots(true);
      if (r.error === "closed") { off("通話サポートの受付は終了しました。", true); return; }
      if (r.error === "already" && r.canPay && r.id) { var b = $("pay-old"); b.hidden = false; b.dataset.id = r.id; }
      say("send-msg", r.message || "送れませんでした", true);
    });
  }
  function payFor(id, msgId) {
    if (!store.get("s")) { say(msgId, "Discordでログインしてから、もう一度押してください", true); $("form").hidden = false; return; }
    say(msgId, "お支払いのページを用意しています…");
    api({ a: "pay", s: store.get("s"), id: id }).then(function (r) {
      if (r.ok && goPay(r.pay)) return;
      if (r.ok && r.state && r.state !== "申込") { showDone("お申し込みを受け付けました", "お支払いは確かめてあります。日時を確定したら、Discordでお知らせします。", id, false); return; }
      if (r.error === "login") setLogin("");
      say(msgId, r.message || "お支払いのページを用意できませんでした", true);
    });
  }

  // ---- 支払いから戻ったとき ----
  function showDone(title, text, id, canPay) {
    $("done").hidden = false;
    $("done-title").textContent = title; $("done-text").textContent = text; $("done-id").textContent = id;
    var b = $("done-pay"); b.hidden = !canPay; b.dataset.id = id;
    if (!canPay) $("form").hidden = true;
    $("done").scrollIntoView({ block: "start" });
  }
  function confirmPaid(id, cs, left) {
    showDone("お支払いを確かめています…", "このままお待ちください。", id, false);
    api({ a: "confirm", id: id, cs: cs }).then(function (r) {
      if (r.ok && r.state === "承認待ち") {
        store.set("draft", ""); store.set("req", "");
        showDone("お申し込みを受け付けました", "お支払いを確かめました。日時を確かめて確定したら、Discordでお知らせします。サポート用のDiscordサーバーに入っているかも、確かめておいてください。", id, false);
      } else if (r.ok && r.state && r.state !== "申込") {
        showDone("お申し込みを受け付けています", "この依頼の状態：" + r.state + "。くわしくはDiscordでお知らせします。", id, false);
      } else if (left > 0) {
        setTimeout(function () { confirmPaid(id, cs, left - 1); }, 2500);
      } else {
        showDone("お支払いの確認に時間がかかっています", "お支払いが終わっていれば、15分ほどで自動で確かめます。日時の確定はDiscordでお知らせします。", id, false);
      }
    });
  }

  // ---- はじめに ----
  function init() {
    var ret = P.readReturn(location.search, location.hash);
    if (location.search || location.hash) { try { history.replaceState(null, "", location.pathname); } catch (e) { /* そのまま */ } }
    if ((ret.paid && ret.cs) || ret.unpaid) $("form-wrap").scrollIntoView({ block: "start" });
    if (P.https(C.TERMS_URL)) {
      var n = $("terms-note"), a = document.createElement("a");
      n.textContent = "利用規約："; a.href = C.TERMS_URL.trim(); a.target = "_blank"; a.rel = "noopener"; a.textContent = "VOXTAGE 利用規約を開く"; n.appendChild(a);
    }
    var state = P.pageState(C, new Date());
    if (state === "not_ready") { off("お申し込みの受付は、準備中です。", false); return; }
    if (ret.paid && ret.cs) confirmPaid(ret.paid, ret.cs, 4);    // 期限のあとに戻ってきても、支払いの確認はする
    if (state === "closed") { off("通話サポートの受付は終了しました。", true); return; }

    api({ a: "info" }).then(function (info) {
      if (!info.ok) { off(info.message || "お申し込みの受付は、準備中です。", false); return; }
      if (!info.open) { off("通話サポートの受付は終了しました。", true); return; }
      INFO = info;
      MAX = Math.min(MAX, Number(info.maxPresets));
      var ps = $("presets");
      for (var i = 0; i <= MAX; i++) { var o = document.createElement("option"); o.value = String(i); o.textContent = i ? i + "つ（+" + P.yen(info.presetYen * i) + "）" : "頼まない"; ps.appendChild(o); }
      var ul = $("consents");
      P.CONSENTS.forEach(function (c) {
        var li = document.createElement("li"), lb = document.createElement("label"), cb = document.createElement("input"), sp = document.createElement("span");
        cb.type = "checkbox"; cb.id = "c-" + c.key; sp.textContent = c.text;
        lb.appendChild(cb); lb.appendChild(sp); li.appendChild(lb); ul.appendChild(li);
      });
      $("form").hidden = false;
      if (!info.discord) { $("login").disabled = true; $("login").textContent = "Discordでログイン（準備中）"; }
      $("test-login").hidden = !info.test;

      // Discord から戻ってきた
      if (ret.login) {
        if (ret.state && ret.state === store.get("state")) store.set("s", ret.login);
        else say("login-msg", "ログインを確かめられませんでした。もう一度「Discordでログイン」を押してください", true);
      }
      if (ret.loginError) say("login-msg", ret.loginError === "cancel" ? "ログインが取り消されました" : ret.loginError === "busy" ? "混み合っています。少したってから、もう一度お試しください" : "ログインできませんでした。もう一度お試しください", true);
      store.set("state", "");

      loadSlots(false).then(function () {
        loadDraft(); total();
        if (ret.unpaid) showDone("お支払いは終わっていません", "依頼は受け付けてあります（お支払い待ち）。下のボタンから、お支払いへ進めます。", ret.unpaid, true);
      });
      setLogin("", true);
      if (store.get("s")) {
        var s = store.get("s");
        if (s) api({ a: "me", s: s }).then(function (r) {
          if (!r.ok) { setLogin(""); if (r.error === "login") say("login-msg", r.message, true); return; }
          store.set("s", s); setLogin(r.name);
          if (store.get("ticket") && store.get("last4")) setPro(store.get("last4"));
        });
      }
    });

    $("login").addEventListener("click", startLogin);
    $("test-login").addEventListener("click", function () {
      api({ a: "testLogin" }).then(function (r) {
        if (!r.ok) { say("login-msg", r.message || "使えません", true); return; }
        store.set("s", r.s);
        api({ a: "me", s: r.s }).then(function (m) { if (m.ok) setLogin(m.name); });
      });
    });
    $("logout").addEventListener("click", function () { setLogin(""); say("login-msg", ""); });
    $("check").addEventListener("click", check);
    $("code").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); check(); } });
    $("presets").addEventListener("change", total);
    $("form").addEventListener("change", saveDraft);
    $("form").addEventListener("submit", submit);
    $("pay-old").addEventListener("click", function () { payFor(this.dataset.id, "send-msg"); });
    $("done-pay").addEventListener("click", function () { payFor(this.dataset.id, "done-text"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

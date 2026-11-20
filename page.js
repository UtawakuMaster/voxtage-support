/* 通話サポート 申し込みページの計算（config.js の値 → ページに出す文字・ボタンの状態、入力の確かめ）。
 * 画面には触らない純粋な関数だけ。form.js と index.html が使い、ui/tests/support-page.test.js でも確かめる。
 */
(function (root) {
  "use strict";
  var isNum = function (n) { return typeof n === "number" && isFinite(n) && n >= 0; };
  var isCount = function (n) { return typeof n === "number" && isFinite(n) && n >= 1 && Math.floor(n) === n; };
  var https = function (u) { return typeof u === "string" && /^https:\/\//.test(u.trim()); };
  var yen = function (n) { return "¥" + Number(n).toLocaleString("ja-JP"); };
  var YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

  /** 受付の最後の時刻（SUPPORT_DEADLINE の日の 23:59:59 日本時間）。日付が無い・読めないときは null（期限なし）。 */
  function deadlineEnd(C) {
    var m = YMD.exec(String((C && C.SUPPORT_DEADLINE) || "").trim());
    if (!m) return null;
    var end = new Date(m[0] + "T23:59:59+09:00");
    return isNaN(end.getTime()) ? null : end;
  }
  /** 今、申し込みを受け付けているか（判定はブラウザの時計。本当の締め切りは受付のサーバーが決める）。 */
  function isOpen(C, now) {
    var end = deadlineEnd(C);
    return !end || now.getTime() <= end.getTime();
  }
  /** "2026-12-20" → "2026年12月20日"（読めなければ ""） */
  function dateText(s) {
    var m = YMD.exec(String(s || "").trim());
    return m ? m[1] + "年" + Number(m[2]) + "月" + Number(m[3]) + "日" : "";
  }

  /** ページに出す数字（config.js が空・おかしいときは既定値）。 */
  function values(C) {
    C = C || {};
    return {
      minutes: isCount(C.CALL_MINUTES) ? C.CALL_MINUTES : 60,
      callPrice: isNum(C.CALL_PRICE_YEN) ? C.CALL_PRICE_YEN : 1800,
      presetPrice: isNum(C.PRESET_PRICE_YEN) ? C.PRESET_PRICE_YEN : 500,
      presetMax: isCount(C.PRESET_MAX) ? C.PRESET_MAX : 3,
      days: isCount(C.PRESET_DELIVERY_DAYS) ? C.PRESET_DELIVERY_DAYS : 3,
      deadline: dateText(C.SUPPORT_DEADLINE)
    };
  }

  /** 特商法の表の「販売価格」の文。 */
  function priceText(C) {
    var v = values(C);
    return "通話" + v.minutes + "分 " + yen(v.callPrice) + "（税込）／オプション：専用プリセット作成 1つ " + yen(v.presetPrice) +
      "（税込・いまだけ価格・1回の申し込みで" + v.presetMax + "つまで）";
  }
  /** 合計（税込・円）。 */
  function total(C, presets) {
    var v = values(C), n = Math.max(0, Math.min(v.presetMax, Math.floor(Number(presets) || 0)));
    return v.callPrice + v.presetPrice * n;
  }

  /** ページの状態：'closed'（受付終了）・'not_ready'（受付の URL が空）・'open'。 */
  function pageState(C, now) {
    if (!isOpen(C, now)) return "closed";
    if (!apiUrl(C)) return "not_ready";
    return "open";
  }
  /** 受付のウェブアプリの URL（https://script.google.com/macros/s/…/exec だけ）。 */
  function apiUrl(C) {
    var u = String((C && C.SUPPORT_API_URL) || "").trim();
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u) ? u : "";
  }

  // 同意の項目（すべて必須）。キーは受付のサーバー（scripts/support/Reception.gs の RCP_CONSENTS）と同じ順・同じ名前
  var CONSENTS = [
    { key: "call", text: "通話は60分です。Discordの通話と画面共有で行います。" },
    { key: "norec", text: "通話の録画・録音はしません（こちらも、お客様も）。" },
    { key: "noremote", text: "お客様のPCを遠隔操作することはありません。操作はすべて、お客様ご自身で行います。" },
    { key: "cancel", text: "キャンセル・返金の決まりに同意します：予約した日時の3日前までは、日程の変更が1回無料、キャンセルは全額返金。3日前より後のキャンセルと、連絡なしの欠席は返金なし。こちらの都合で中止になったときは、日程の変更か全額返金。" },
    { key: "preset", text: "専用プリセットは、通話のあと3日以内にお渡しします。お使いの環境によっては、作れない場合があることを了承します。作れなかった分は、1つ ¥500 を返金します（通話の料金は返金しません）。" },
    { key: "presetown", text: "専用プリセットは、お客様専用です。他の方への譲渡・配布・販売・公開はできません。" },
    { key: "privacy", text: "入力した内容とDiscordのアカウントは、このサポートのためだけに使われることに同意します。" },
    { key: "channel", text: "サポート用のDiscordサーバーの専用チャンネルは、通話が終わった時刻から数えて7日後に削除されます。必要なファイルは、それまでに保存してください。" },
    { key: "terms", text: "VOXTAGEの利用規約に同意します。" },
    { key: "age", text: "18歳以上です。" },
    { key: "japanese", text: "日本語で会話できます。通話・チャット・案内は、すべて日本語のみです（通訳・翻訳はありません）。" }
  ];

  /** 戻ってきたときの印を読む。search は "?paid=…&cs=…"、hash は "#login=…&state=…"。 */
  function readReturn(search, hash) {
    var q = new URLSearchParams(String(search || "").replace(/^\?/, "")), h = new URLSearchParams(String(hash || "").replace(/^#/, ""));
    var tok = function (v) { return /^[A-Za-z0-9_-]{16,128}$/.test(v || "") ? v : ""; };
    var rid = function (v) { return /^R\d{8}-[A-Z0-9]{4}$/.test(v || "") ? v : ""; };
    return {
      login: tok(h.get("login")), state: tok(h.get("state")), loginError: /^(cancel|fail|busy)$/.test(h.get("login_error") || "") ? h.get("login_error") : "",
      paid: rid(q.get("paid")), cs: /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(q.get("cs") || "") ? q.get("cs") : "", unpaid: rid(q.get("unpaid"))
    };
  }
  /** Discord のログインの入口に、state（このタブだけが知っている合言葉）を足す。 */
  function authUrl(base, state) {
    return /^https:\/\/discord\.com\/oauth2\/authorize\?/.test(String(base || "")) ? base + "&state=" + encodeURIComponent(state) : "";
  }
  /** 合言葉：0〜255 の数の並び → 英数字。 */
  function makeState(bytes) {
    var c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", s = "";
    for (var i = 0; i < bytes.length; i++) s += c[bytes[i] % c.length];
    return s;
  }

  /** 送る前の確かめ（サーバーでも同じことを確かめる）。f はフォームの値。足りなければ日本語の文、よければ ""。 */
  function checkForm(f, presetMax) {
    if (!f.first) return "第1希望の日時を選んでください";
    if (f.second && f.second === f.first) return "第2希望は、第1希望と違う日時を選んでください";
    var n = Number(f.presets);
    if (!(Math.floor(n) === n && n >= 0 && n <= presetMax)) return "プリセットの数は 0〜" + presetMax + " にしてください";
    var need = [["win", "Windows"], ["mic", "マイク"], ["app", "配信ソフト"], ["trouble", "困りごと"]];
    for (var i = 0; i < need.length; i++) if (!String(f[need[i][0]] || "").trim()) return "「" + need[i][1] + "」を書いてください";
    var max = [["win", "Windows", 60], ["mic", "マイク", 100], ["gear", "機材", 200], ["app", "配信ソフト", 100], ["trouble", "困りごと", 2000]];
    for (var j = 0; j < max.length; j++) if (String(f[max[j][0]] || "").trim().length > max[j][2]) return "「" + max[j][1] + "」は " + max[j][2] + " 文字までにしてください";
    var miss = CONSENTS.filter(function (c) { return !(f.consents && f.consents[c.key] === true); }).length;
    if (miss) return "同意の項目に、まだチェックが入っていないものがあります（" + miss + " つ）";
    return "";
  }

  root.SUPPORT_PAGE = {
    deadlineEnd: deadlineEnd, isOpen: isOpen, dateText: dateText, values: values, priceText: priceText, total: total,
    pageState: pageState, apiUrl: apiUrl, CONSENTS: CONSENTS, readReturn: readReturn, authUrl: authUrl, makeState: makeState,
    checkForm: checkForm, yen: yen, https: https
  };
})(typeof window !== "undefined" ? window : globalThis);

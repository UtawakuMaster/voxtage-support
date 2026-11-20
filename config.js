/* 通話サポート 申し込みページの設定（ここだけ書き換えれば index.html に反映されます）
 *
 * ・秘密のキー（Stripeのキー、Discordのトークン・クライアントシークレット）は、絶対にここへ書かないでください。
 *   それらは、受付のウェブアプリ（Apps Script「VOXTAGE サポート受付」）の「スクリプト プロパティ」に置きます。
 * ・SUPPORT_API_URL が空の間は、申し込みの欄に「準備中」と出ます。
 */
window.SUPPORT_CONFIG = {
  // ---- 受付のウェブアプリの URL（https://script.google.com/macros/s/…/exec）。デプロイしたときに出る「ウェブアプリ」の URL ----
  SUPPORT_API_URL: "https://script.google.com/macros/s/AKfycbwjJdA7SQOxoE7ReNTqk4Je14pjW2orVlPMvJClNJ6J8rtHC2xf2PWLcPQaNEPziMIGbQ/exec",

  // ---- 受付の期限（日本時間・その日の23:59まで）。過ぎると「通話サポートの受付は終了しました」と出ます ----
  // 本当の締め切りは、スプレッドシートの「通話サポート設定」の「受付期限」です。同じ日にしてください
  SUPPORT_DEADLINE: "2026-12-20",

  // ---- 価格（円・数字だけ）。ページには「税込」と出ます。支払いの金額は受付のウェブアプリが決めます（同じ値にしてください） ----
  CALL_MINUTES: 60,          // 通話の長さ（分）
  CALL_PRICE_YEN: 1800,      // 通話60分の価格
  PRESET_PRICE_YEN: 500,     // オプション：専用プリセット作成 1つの価格（いまだけ価格）
  PRESET_MAX: 3,             // 1回の申し込みで頼めるプリセットの数の上限
  PRESET_DELIVERY_DAYS: 3,   // プリセットを渡すまでの日数（通話のあと○日以内に Discord で）

  // ---- 利用規約のページ（任意）。空なら「アプリの ⚙設定 → 利用規約」と案内します ----
  TERMS_URL: "",

  // ---- 連絡先（特定商取引法に基づく表記）。空の間は、ページに「準備中」と出ます。公開前に必ず入れてください ----
  // 販売者の氏名・住所・電話番号は、ページに「請求があれば、遅滞なく開示します」と書く方式なので、ここには入れません
  CONTACT_EMAIL: "vagency.2107@gmail.com"          // 連絡先メールアドレス（開示請求・キャンセル・返金の受付先）
};

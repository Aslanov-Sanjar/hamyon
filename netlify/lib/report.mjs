// Umumiy yordamchilar: Telegram tekshiruvi, xabar matni, bot orqali yuborish
import crypto from "node:crypto";

const MONTHS = ["yanvar","fevral","mart","aprel","may","iyun","iyul","avgust","sentabr","oktabr","noyabr","dekabr"];

export const fmt = n => Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const sgn = n => (n < 0 ? "−" : "") + fmt(n);
const esc = s => String(s).replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
const dayName = d => `${+d.slice(8)} ${MONTHS[+d.slice(5,7)-1]}`;

// Toshkent vaqti bo'yicha sana (UTC+5)
export const tashkentDate = (ms = Date.now()) => new Date(ms + 5 * 3600e3).toISOString().slice(0, 10);

// Telegram Mini App initData imzosini tekshiradi; to'g'ri bo'lsa foydalanuvchini qaytaradi
export function verifyInitData(initData, botToken, maxAgeSec = 7 * 24 * 3600) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheck = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const authDate = +params.get("auth_date") || 0;
  if (Date.now() / 1000 - authDate > maxAgeSec) return null;
  try { const u = JSON.parse(params.get("user") || "null"); return u && u.id ? u : null; } catch { return null; }
}

// Ilovadan kelgan ma'lumotni tozalash (faqat raqamlar va qisqa nomlar)
const N = v => { const x = Math.round(Number(v)); return Number.isFinite(x) && Math.abs(x) < 1e15 ? x : 0; };
export function cleanSummary(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.date || "")) return null;
  const d = s.debt || {};
  return {
    date: s.date,
    month: String(s.date).slice(0, 7),
    inc: N(s.inc), exp: N(s.exp), count: N(s.count),
    cats: (Array.isArray(s.cats) ? s.cats : []).slice(0, 8)
      .map(c => [String(c[0] || "").slice(0, 30), N(c[1])]).filter(c => c[1] > 0),
    debt: { give: N(d.give), back_in: N(d.back_in), take: N(d.take), back_out: N(d.back_out) },
    card: N(s.card), cash: N(s.cash), bal: N(s.bal),
    owed: N(s.owed), owe: N(s.owe)
  };
}

export function reportText(s, { title } = {}) {
  const lines = [`📊 <b>${title || dayName(s.date) + " hisoboti"}</b>`, ""];
  if (!s.inc && !s.exp && !Object.values(s.debt).some(Boolean)) {
    lines.push("Bugun yozuv kiritilmadi.");
  } else {
    lines.push(`➕ Daromad: <b>${fmt(s.inc)}</b>`);
    lines.push(`➖ Xarajat: <b>${fmt(s.exp)}</b>`);
    if (s.cats.length) for (const [n, v] of s.cats) lines.push(`   • ${esc(n)} — ${fmt(v)}`);
    const d = s.debt, dl = [];
    if (d.give) dl.push(`berdim ${fmt(d.give)}`);
    if (d.back_in) dl.push(`menga qaytardi ${fmt(d.back_in)}`);
    if (d.take) dl.push(`oldim ${fmt(d.take)}`);
    if (d.back_out) dl.push(`men qaytardim ${fmt(d.back_out)}`);
    if (dl.length) lines.push(`⇄ Qarzlar: ${dl.join(", ")}`);
    lines.push(`Kun natijasi: <b>${sgn(s.inc - s.exp)}</b>`);
  }
  lines.push("", `💰 <b>Oy qoldig'i: ${sgn(s.bal)} so'm</b>`, `💳 Plastik: ${sgn(s.card)}`, `💵 Naqd: ${sgn(s.cash)}`);
  if (s.owed || s.owe) lines.push("", `🤝 Menga qaytarishadi: ${fmt(s.owed)}`, `📌 Men qaytarishim kerak: ${fmt(s.owe)}`);
  return lines.join("\n");
}

export async function sendTelegram(token, chatId, text) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" })
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `Telegram xatosi ${r.status}`);
  return j;
}

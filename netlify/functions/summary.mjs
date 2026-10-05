// Ilova har saqlashda bugungi jami summalarni shu yerga yuboradi.
// send=true bo'lsa, hisobot darhol botdan keladi (tekshirib ko'rish uchun).
import { getStore } from "@netlify/blobs";
import { verifyInitData, cleanSummary, reportText, sendTelegram } from "../lib/report.mjs";

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { "content-type": "application/json" }
});

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "POST kerak" }, 405);
  const token = process.env.BOT_TOKEN;
  if (!token) return json({ ok: false, error: "Netlify sozlamalarida BOT_TOKEN kiritilmagan" }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: "Noto'g'ri so'rov" }, 400); }

  const user = verifyInitData(body.initData, token);
  if (!user) return json({ ok: false, error: "Telegram tekshiruvidan o'tmadi. Ilovani bot ichidan qayta oching." }, 401);

  const s = cleanSummary(body.summary);
  if (!s) return json({ ok: false, error: "Ma'lumot noto'g'ri" }, 400);

  const store = getStore("hamyon");
  await store.setJSON(`day/${user.id}/${s.date}`, s);
  await store.setJSON(`user/${user.id}`, { uid: user.id, last: s, updated: Date.now(), reports: body.reports !== false });

  if (body.send) {
    try { await sendTelegram(token, user.id, reportText(s, { title: "Hozirgi holat" })); }
    catch (e) { return json({ ok: false, error: "Bot xabar yubora olmadi: " + e.message }, 502); }
  }
  return json({ ok: true });
};

export const config = { path: "/api/summary" };

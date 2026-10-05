// Har kuni soat 00:00 da (Toshkent vaqti) tugagan kun hisobotini yuboradi.
// Cron UTC bo'yicha yoziladi: 19:00 UTC = 00:00 Toshkent (UTC+5).
import { getStore } from "@netlify/blobs";
import { tashkentDate, reportText, sendTelegram } from "../lib/report.mjs";

export default async () => {
  const token = process.env.BOT_TOKEN;
  if (!token) { console.log("BOT_TOKEN yo'q"); return; }

  const store = getStore("hamyon");
  const date = tashkentDate(Date.now() - 10 * 60e3); // hozirgina tugagan kun
  const { blobs } = await store.list({ prefix: "user/" });

  for (const b of blobs) {
    try {
      const u = await store.get(b.key, { type: "json" });
      if (!u || u.reports === false) continue;
      let s = await store.get(`day/${u.uid}/${date}`, { type: "json" });
      if (!s) {
        // Shu kuni ilova ochilmagan: oxirgi ma'lum qoldiq bilan "yozuv yo'q" xabari
        const last = u.last && u.last.month === date.slice(0, 7) ? u.last : null;
        s = { date, inc: 0, exp: 0, cats: [], debt: {},
          card: last ? last.card : 0, cash: last ? last.cash : 0, bal: last ? last.bal : 0,
          owed: u.last ? u.last.owed : 0, owe: u.last ? u.last.owe : 0 };
      }
      await sendTelegram(token, u.uid, reportText(s));
    } catch (e) {
      console.log("Yuborilmadi", b.key, e.message);
    }
  }
};

export const config = { schedule: "0 19 * * *" };

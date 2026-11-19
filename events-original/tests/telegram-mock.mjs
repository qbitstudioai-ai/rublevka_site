// Локальная замена Telegram Bot API для e2e: принимает sendMessage и пишет запросы в JSONL-файл.
// Настоящий Telegram в автотестах не используется.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const port = Number(process.env.TELEGRAM_MOCK_PORT ?? 3199);
const expectedToken = process.env.TELEGRAM_MOCK_TOKEN ?? "";
const logFile = path.join(process.cwd(), ".e2e-data", "telegram-requests.jsonl");
const flakySeen = new Set();

http
  .createServer((request, response) => {
    if (request.method === "GET") return response.end("ok");
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      const match = /^\/bot(.+)\/sendMessage$/.exec(request.url ?? "");
      const tokenOk = !!match && decodeURIComponent(match[1]) === expectedToken;
      const payload = JSON.parse(body || "{}");
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.appendFileSync(logFile, `${JSON.stringify({ tokenOk, chatId: payload.chat_id, text: payload.text })}\n`);
      response.setHeader("Content-Type", "application/json");
      if (!tokenOk) {
        response.statusCode = 401;
        return response.end(JSON.stringify({ ok: false, description: "Unauthorized" }));
      }
      // Сообщения с маркером FLAKY- не доставляются с первой попытки — для проверки повтора.
      const marker = /FLAKY-\S+/.exec(payload.text ?? "")?.[0];
      if (marker && !flakySeen.has(marker)) {
        flakySeen.add(marker);
        response.statusCode = 502;
        return response.end(JSON.stringify({ ok: false, description: "Bad Gateway" }));
      }
      response.end(JSON.stringify({ ok: true, result: { message_id: 1 } }));
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`Telegram mock: http://127.0.0.1:${port}`));

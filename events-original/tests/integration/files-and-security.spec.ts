import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { mediaUrl } from "@/lib/media";
import { formatRub, parseRublesToKopecks, priceText } from "@/lib/money";
import { createActivity, deleteActivity, listGallery, updateActivity } from "@/lib/server/repo/activities";
import { deleteEvent, updateEvent } from "@/lib/server/repo/events";
import { createRegistration } from "@/lib/server/repo/registrations";
import { checkCredentials, createSessionToken, readAdminConfig, SESSION_TTL_SECONDS, verifySessionToken } from "@/lib/server/session";
import { deleteOrphanUploads, MAX_UPLOAD_BYTES, resolveUploadPath, saveImage, UploadError } from "@/lib/server/uploads";
import { registrationSchema } from "@/lib/server/validation";
import { activityInput, freshDb, makeEvent, pngFile, tempDir, uploadExists } from "./helpers";

test.describe("загрузка файлов", () => {
  test.beforeEach(() => {
    process.env.UPLOADS_DIR = tempDir("uploads-");
  });

  test("фото перекодируется в WebP, QR — в PNG, имя генерирует сервер", async () => {
    const photo = await saveImage(await pngFile("../../etc/passwd.png"), "photo");
    const qr = await saveImage(await pngFile("qr.png"), "qr");
    expect(photo).toMatch(/^upload:[0-9a-f-]{36}\.webp$/);
    expect(qr).toMatch(/^upload:[0-9a-f-]{36}\.png$/);
    const dir = process.env.UPLOADS_DIR!;
    expect(fs.readdirSync(dir).sort()).toEqual([photo, qr].map((ref) => ref.replace("upload:", "")).sort());
    expect((await sharp(path.join(dir, photo.replace("upload:", ""))).metadata()).format).toBe("webp");
  });

  test("большое фото уменьшается до 2000 px", async () => {
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
    const ref = await saveImage(new File([new Uint8Array(big)], "big.jpg", { type: "image/jpeg" }), "photo");
    const meta = await sharp(path.join(process.env.UPLOADS_DIR!, ref.replace("upload:", ""))).metadata();
    expect(meta.width).toBe(2000);
    expect(meta.height).toBe(1500);
  });

  test("отклоняются SVG, подделка под PNG и слишком большие файлы", async () => {
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], "qr.svg", { type: "image/svg+xml" });
    await expect(saveImage(svg, "qr")).rejects.toThrow(UploadError);
    const fakePng = new File(["<html>not an image</html>"], "photo.png", { type: "image/png" });
    await expect(saveImage(fakePng, "photo")).rejects.toThrow(UploadError);
    const svgAsPng = new File(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'], "x.png", { type: "image/png" });
    await expect(saveImage(svgAsPng, "photo")).rejects.toThrow(UploadError);
    const huge = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "huge.png", { type: "image/png" });
    await expect(saveImage(huge, "photo")).rejects.toThrow(/10 МБ/);
    expect(fs.readdirSync(process.env.UPLOADS_DIR!)).toHaveLength(0);
  });

  test("path traversal невозможен", () => {
    for (const name of ["../db.sqlite", "..\\db.sqlite", "/etc/passwd", "a.webp", "00000000-0000-0000-0000-000000000000.svg", "%2e%2e%2fdb"]) {
      expect(resolveUploadPath(name)).toBeNull();
    }
    expect(resolveUploadPath("12345678-1234-1234-1234-123456789abc.webp")).toBe(path.join(process.env.UPLOADS_DIR!, "12345678-1234-1234-1234-123456789abc.webp"));
    expect(mediaUrl("upload:../secret")).toBeNull();
    expect(mediaUrl("javascript:alert(1)")).toBeNull();
    expect(mediaUrl("//evil.example/x.png")).toBeNull();
  });

  test("замена и удаление изображений убирают только осиротевшие файлы", async () => {
    const dir = process.env.UPLOADS_DIR!;
    const { db } = freshDb();
    const hero = await saveImage(await pngFile(), "photo");
    const { id: eventId, input } = makeEvent(db, {}, hero);

    const newHero = await saveImage(await pngFile(), "photo");
    const { replacedHero } = updateEvent(db, eventId, input, newHero)!;
    await deleteOrphanUploads(db, [replacedHero]);
    expect(uploadExists(dir, hero)).toBe(false);
    expect(uploadExists(dir, newHero)).toBe(true);

    const card = await saveImage(await pngFile(), "photo");
    const g1 = await saveImage(await pngFile(), "photo");
    const g2 = await saveImage(await pngFile(), "photo");
    const activityId = createActivity(db, eventId, activityInput(), card, [g1, g2]);
    const [first] = listGallery(db, [activityId]);
    const { removedRefs } = updateActivity(db, eventId, activityId, activityInput(), undefined, { add: [], removeIds: [first.id] })!;
    await deleteOrphanUploads(db, removedRefs);
    expect(uploadExists(dir, g1)).toBe(false);
    expect(uploadExists(dir, g2)).toBe(true);

    // Файл, на который ссылается другое мероприятие, не удаляется.
    const { id: otherEventId } = makeEvent(db, {}, newHero);
    const removed = deleteActivity(db, eventId, activityId);
    await deleteOrphanUploads(db, removed.imageRefs);
    expect(uploadExists(dir, card)).toBe(false);
    expect(uploadExists(dir, g2)).toBe(false);

    const { imageRefs } = deleteEvent(db, eventId);
    await deleteOrphanUploads(db, imageRefs);
    expect(uploadExists(dir, newHero)).toBe(true);

    const second = deleteEvent(db, otherEventId);
    await deleteOrphanUploads(db, second.imageRefs);
    expect(uploadExists(dir, newHero)).toBe(false);
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  test("полное удаление мероприятия каскадно удаляет связанные записи", async () => {
    const dir = process.env.UPLOADS_DIR!;
    const { db } = freshDb();
    const hero = await saveImage(await pngFile(), "photo");
    const { id: eventId } = makeEvent(db, {}, hero);
    const card = await saveImage(await pngFile(), "photo");
    const gallery = await saveImage(await pngFile(), "photo");
    const activityId = createActivity(db, eventId, activityInput(), card, [gallery]);
    createRegistration(
      db,
      eventId,
      registrationSchema.parse({ fullName: "Иванов Иван", phone: "+7 900 000-00-00", messenger: "@ivanov", activityIds: [activityId] }),
    );

    const { deleted, imageRefs } = deleteEvent(db, eventId);
    expect(deleted).toBe(true);
    await deleteOrphanUploads(db, imageRefs);
    for (const table of ["events", "activities", "activity_images", "registrations", "registration_activities"]) {
      expect(db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get()).toEqual({ c: 0 });
    }
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });
});

test.describe("сессия администратора", () => {
  const secret = "s".repeat(40);

  test("подпись, срок жизни и подделка", () => {
    const now = 1_800_000_000;
    const token = createSessionToken(secret, now);
    expect(verifySessionToken(token, secret, now + 60)).toBe(true);
    expect(verifySessionToken(token, secret, now + SESSION_TTL_SECONDS + 1)).toBe(false);
    expect(verifySessionToken(token, "x".repeat(40), now)).toBe(false);
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "admin", iat: now, exp: now + 10 ** 9 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${signature}`, secret, now)).toBe(false);
    expect(verifySessionToken(`${payload}.`, secret, now)).toBe(false);
    expect(verifySessionToken(undefined, secret, now)).toBe(false);
  });

  test("без явно заданного секрета админпанель не работает", () => {
    expect(readAdminConfig({}).config).toBeNull();
    expect(readAdminConfig({ ADMIN_USERNAME: "a", ADMIN_PASSWORD: "long-password-1", ADMIN_SESSION_SECRET: "short" }).config).toBeNull();
    expect(readAdminConfig({ ADMIN_USERNAME: "a", ADMIN_PASSWORD: "short", ADMIN_SESSION_SECRET: secret }).config).toBeNull();
    const { config } = readAdminConfig({ ADMIN_USERNAME: "owner", ADMIN_PASSWORD: "long-password-1", ADMIN_SESSION_SECRET: secret });
    expect(config).not.toBeNull();
    expect(checkCredentials(config!, "owner", "long-password-1")).toBe(true);
    expect(checkCredentials(config!, "owner", "long-password-2")).toBe(false);
    expect(checkCredentials(config!, "other", "long-password-1")).toBe(false);
  });
});

test("деньги в копейках без float", () => {
  expect(parseRublesToKopecks("3500")).toBe(350000);
  expect(parseRublesToKopecks("3 500,5")).toBe(350050);
  expect(parseRublesToKopecks("0.1")).toBe(10);
  expect(parseRublesToKopecks("1e3")).toBeNull();
  expect(parseRublesToKopecks("-5")).toBeNull();
  expect(formatRub(350000)).toBe("3 500 ₽");
  expect(formatRub(350050)).toBe("3 500,50 ₽");
  expect(priceText("fixed", 650000, "за компанию")).toBe("6 500 ₽ за компанию");
  expect(priceText("free", 0, null)).toBe("Бесплатно");
  expect(priceText("contact", null, null)).toBe("Стоимость уточнит администратор");
});

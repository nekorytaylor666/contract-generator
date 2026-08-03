-- Скачивание больше не «выдаёт» документы редакторов: активная платная
-- подписка = право редактирования. Снимаем блокировку с уже скачанных
-- ОТРЕДАКТИРОВАННЫХ документов (v2+), чей автор сейчас на платном тарифе.
-- Просто скачанные из каталога записи (v1) остаются «выданными».
UPDATE "document" d
SET "downloaded_at" = NULL
WHERE d."downloaded_at" IS NOT NULL
  AND d."current_version" > 1
  AND EXISTS (
    SELECT 1
    FROM "user" u
    JOIN "subscription_plan" p ON p."id" = u."subscription_plan_id"
    WHERE u."id" = d."created_by"
      AND p."is_default" = false
      AND (u."subscription_expires_at" IS NULL OR u."subscription_expires_at" > now())
  );

-- Документы, созданные по купленному редактированию шаблона (template_edit /
-- template_purchase), больше не «выдаются» при скачивании: снимаем блокировку
-- с уже скачанных, чтобы они снова стали редактируемыми и не серели в списке.
UPDATE "document" d
SET "downloaded_at" = NULL
WHERE d."downloaded_at" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "payment" p
    WHERE p."user_id" = d."created_by"
      AND p."template_id" = d."template_id"
      AND p."status" = 'paid'
      AND p."purpose" IN ('template_edit', 'template_purchase')
  );

-- 0023 добавила review_quota с DEFAULT 0, но значения тарифов никто не
-- проставил (сид их тоже не задавал). Из-за этого у платных подписчиков
-- кнопка «На проверку юристу» была задизейблена с подсказкой «доступна на
-- платных тарифах». Проставляем квоты из фичи «Проверка документов».
UPDATE "subscription_plan" SET "review_quota" = 1 WHERE "id" = 'plan_basic' AND "review_quota" = 0;--> statement-breakpoint
UPDATE "subscription_plan" SET "review_quota" = 3 WHERE "id" = 'plan_standard' AND "review_quota" = 0;--> statement-breakpoint
UPDATE "subscription_plan" SET "review_quota" = 5 WHERE "id" = 'plan_premium' AND "review_quota" = 0;

ALTER TABLE `weekly_schedule_assignments` ADD `start_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `weekly_schedule_assignments` ADD `end_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `weekly_schedule_assignments`
SET `start_minutes` = CASE
  WHEN `shift_code` = 'late' THEN 1080
  WHEN strftime('%w', `shift_date`) IN ('0', '6') THEN 690
  ELSE 660
END
WHERE `start_minutes` = 0;--> statement-breakpoint
UPDATE `weekly_schedule_assignments`
SET `end_minutes` = CASE WHEN `shift_code` = 'late' THEN 1440 ELSE 1080 END
WHERE `end_minutes` = 0;

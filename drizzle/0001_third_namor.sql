CREATE TABLE `weekly_availability` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`normalized_name` text NOT NULL,
	`display_name` text NOT NULL,
	`availability_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_weekly_availability_week_name` ON `weekly_availability` (`week_start`,`normalized_name`);
--> statement-breakpoint
PRAGMA optimize;

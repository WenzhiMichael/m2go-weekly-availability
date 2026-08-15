CREATE TABLE `availability_employees` (
	`id` integer PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_availability_employees_display_name` ON `availability_employees` (`display_name` COLLATE NOCASE);--> statement-breakpoint
CREATE TABLE `employee_weekly_availability` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`employee_id` integer NOT NULL,
	`availability_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `availability_employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_employee_weekly_availability_week_employee` ON `employee_weekly_availability` (`week_start`,`employee_id`);--> statement-breakpoint
CREATE TABLE `manager_login_attempts` (
	`client_key` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_started` integer NOT NULL
);
--> statement-breakpoint
PRAGMA optimize;

CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'front' NOT NULL,
	`color` text DEFAULT '#75A9F2' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_employees_active` ON `employees` (`active`);--> statement-breakpoint
CREATE TABLE `schedule_weeks` (
	`week_start` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shift_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`weekday` integer NOT NULL,
	`label` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`ends_next_day` integer DEFAULT false NOT NULL,
	`employee_id` integer,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_shift_templates_weekday_label` ON `shift_templates` (`weekday`,`label`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`shift_date` text NOT NULL,
	`label` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`ends_next_day` integer DEFAULT false NOT NULL,
	`employee_id` integer,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`week_start`) REFERENCES `schedule_weeks`(`week_start`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_shifts_date_label` ON `shifts` (`shift_date`,`label`);--> statement-breakpoint
CREATE INDEX `idx_shifts_week_start` ON `shifts` (`week_start`);--> statement-breakpoint
CREATE INDEX `idx_shifts_employee_week` ON `shifts` (`employee_id`,`week_start`);--> statement-breakpoint
PRAGMA optimize;

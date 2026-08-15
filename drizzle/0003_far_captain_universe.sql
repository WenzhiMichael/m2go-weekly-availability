CREATE TABLE `employee_access_tokens` (
	`employee_id` integer PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `availability_employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_employee_access_tokens_hash` ON `employee_access_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `employee_pair_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_a_id` integer NOT NULL,
	`employee_b_id` integer NOT NULL,
	`preference_type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_a_id`) REFERENCES `availability_employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_b_id`) REFERENCES `availability_employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_employee_pair_preference_pair` ON `employee_pair_preferences` (`employee_a_id`,`employee_b_id`);--> statement-breakpoint
CREATE TABLE `weekly_schedule_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`shift_date` text NOT NULL,
	`shift_code` text NOT NULL,
	`employee_id` integer NOT NULL,
	`state` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `availability_employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_weekly_schedule_assignment` ON `weekly_schedule_assignments` (`week_start`,`shift_date`,`shift_code`,`employee_id`,`state`);--> statement-breakpoint
CREATE INDEX `idx_weekly_schedule_state_week` ON `weekly_schedule_assignments` (`state`,`week_start`);--> statement-breakpoint
CREATE TABLE `weekly_schedule_publications` (
	`week_start` text PRIMARY KEY NOT NULL,
	`published_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

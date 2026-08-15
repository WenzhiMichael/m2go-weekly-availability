CREATE TABLE `employee_credentials` (
	`employee_id` integer PRIMARY KEY NOT NULL,
	`pin_hash` text,
	`pin_set_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `availability_employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `employee_login_attempts` (
	`client_key` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_started` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employee_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`employee_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `availability_employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_employee_sessions_employee` ON `employee_sessions` (`employee_id`);--> statement-breakpoint
CREATE INDEX `idx_employee_sessions_expires` ON `employee_sessions` (`expires_at`);
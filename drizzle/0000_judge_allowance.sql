CREATE TABLE `judge_allowance` (
	`id` text PRIMARY KEY NOT NULL,
	`used` integer NOT NULL,
	`lease_until` integer NOT NULL,
	`lease_token` text NOT NULL
);

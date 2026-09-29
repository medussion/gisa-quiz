ALTER TABLE `attempts` ADD `revealed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `attempts` ADD `used_hint` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `hint` text;
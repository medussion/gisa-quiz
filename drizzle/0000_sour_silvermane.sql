CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` text NOT NULL,
	`user_answer` text DEFAULT '' NOT NULL,
	`is_correct` integer NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`mode` text DEFAULT 'today' NOT NULL,
	`exam_session_id` integer,
	`manual_override` integer DEFAULT false NOT NULL,
	`answered_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempts_question_idx` ON `attempts` (`question_id`);--> statement-breakpoint
CREATE INDEX `attempts_answered_at_idx` ON `attempts` (`answered_at`);--> statement-breakpoint
CREATE INDEX `attempts_exam_session_idx` ON `attempts` (`exam_session_id`);--> statement-breakpoint
CREATE TABLE `exam_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`completed_at` text,
	`question_count` integer DEFAULT 0 NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`mode` text DEFAULT 'mock_exam' NOT NULL,
	`question_ids` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `question_progress` (
	`question_id` text PRIMARY KEY NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`wrong_count` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`last_answered_at` text,
	`last_correct_at` text,
	`last_wrong_at` text,
	`next_review_at` text,
	`mastery_score` real DEFAULT 0 NOT NULL,
	`bookmarked` integer DEFAULT false NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `progress_next_review_idx` ON `question_progress` (`next_review_at`);--> statement-breakpoint
CREATE INDEX `progress_bookmarked_idx` ON `question_progress` (`bookmarked`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_label` text DEFAULT '' NOT NULL,
	`source_urls` text DEFAULT '[]' NOT NULL,
	`year` integer,
	`round` integer,
	`category` text NOT NULL,
	`subcategory` text,
	`question_type` text NOT NULL,
	`question` text NOT NULL,
	`code` text,
	`code_lang` text,
	`answer` text NOT NULL,
	`accepted_answers` text DEFAULT '[]' NOT NULL,
	`choices` text,
	`case_sensitive` integer DEFAULT false NOT NULL,
	`order_sensitive` integer DEFAULT false NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	`difficulty` integer DEFAULT 3 NOT NULL,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`verification_count` integer DEFAULT 0 NOT NULL,
	`based_on` text,
	`normalized_text` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `questions_category_idx` ON `questions` (`category`);--> statement-breakpoint
CREATE INDEX `questions_source_type_idx` ON `questions` (`source_type`);--> statement-breakpoint
CREATE INDEX `questions_question_type_idx` ON `questions` (`question_type`);--> statement-breakpoint
CREATE INDEX `questions_year_round_idx` ON `questions` (`year`,`round`);
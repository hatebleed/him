CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'INVITED', 'SUSPENDED', 'DEACTIVATED');--> statement-breakpoint
CREATE TYPE "public"."channel_type" AS ENUM('DIRECT', 'GROUP', 'DEPARTMENT', 'UNIT', 'INCIDENT');--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'General' NOT NULL,
	"is_system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" text NOT NULL,
	"permission_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"job_title" text,
	"badge_number" text,
	"phone" text,
	"avatar_url" text,
	"password_hash" text NOT NULL,
	"password_algo" text DEFAULT 'scrypt' NOT NULL,
	"password_updated_at" timestamp with time zone,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret" text,
	"mfa_method" text,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"department_id" text,
	"timezone" text,
	"metadata" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"parent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"type" text DEFAULT 'HOME' NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"country" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"from_date" timestamp with time zone,
	"to_date" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"type" text DEFAULT 'EMAIL' NOT NULL,
	"value" text NOT NULL,
	"label" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_identifiers" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"type" text DEFAULT 'NATIONAL_ID' NOT NULL,
	"value" text NOT NULL,
	"issuing_authority" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"relationship" text DEFAULT 'OWNER' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"middle_name" text,
	"alias" text,
	"date_of_birth" timestamp with time zone,
	"gender" text,
	"nationality" text,
	"occupation" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"risk_level" text,
	"category_id" text,
	"department_id" text,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "unit_members" (
	"id" text PRIMARY KEY NOT NULL,
	"unit_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"callsign" text NOT NULL,
	"department_id" text,
	"status" text DEFAULT 'AVAILABLE' NOT NULL,
	"status_updated_at" timestamp with time zone,
	"status_note" text,
	"location" text,
	"latitude" double precision,
	"longitude" double precision,
	"vehicle_id" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"registration" text NOT NULL,
	"make" text,
	"model" text,
	"year" integer,
	"colour" text,
	"body_type" text,
	"fuel_type" text,
	"vin" text,
	"engine_size" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"category_id" text,
	"department_id" text,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "call_units" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"status" text DEFAULT 'ASSIGNED' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"arrived_at" timestamp with time zone,
	"cleared_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"type" text DEFAULT 'GENERAL' NOT NULL,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"description" text,
	"location" text,
	"caller_name" text,
	"caller_phone" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"incident_id" text,
	"department_id" text,
	"received_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"incident_id" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"category_id" text,
	"department_id" text,
	"lead_id" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"review_notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "incident_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"unit_id" text,
	"user_id" text,
	"role" text DEFAULT 'ASSIGNED' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cleared_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "incident_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"person_id" text NOT NULL,
	"role" text DEFAULT 'INVOLVED' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"role" text DEFAULT 'INVOLVED' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"category_id" text,
	"department_id" text,
	"location" text,
	"latitude" double precision,
	"longitude" double precision,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"occurred_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"supervisor_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"type" text DEFAULT 'GENERAL' NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"category_id" text,
	"person_id" text,
	"vehicle_id" text,
	"incident_id" text,
	"expires_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by_id" text,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "bolos" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"person_id" text,
	"vehicle_id" text,
	"incident_id" text,
	"expires_at" timestamp with time zone,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"item_number" text NOT NULL,
	"description" text NOT NULL,
	"category_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_label" text,
	"location" text,
	"status" text DEFAULT 'IN_CUSTODY' NOT NULL,
	"incident_id" text,
	"custodian_id" text,
	"collected_at" timestamp with time zone,
	"collected_from" text,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "evidence_events" (
	"id" text PRIMARY KEY NOT NULL,
	"evidence_id" text NOT NULL,
	"type" text DEFAULT 'TRANSFER' NOT NULL,
	"from_location" text,
	"to_location" text,
	"from_custodian_id" text,
	"to_custodian_id" text,
	"actor_id" text,
	"notes" text,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"change_note" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"incident_id" text,
	"case_id" text,
	"category_id" text,
	"author_id" text NOT NULL,
	"reviewer_id" text,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"form_data" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"assignee_id" text,
	"creator_id" text,
	"department_id" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"record_type" text,
	"record_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "warrants" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"person_id" text NOT NULL,
	"type" text DEFAULT 'ARREST' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"description" text,
	"issuing_authority" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "channel_members" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"last_read_at" timestamp with time zone,
	"muted" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "channel_type" DEFAULT 'GROUP' NOT NULL,
	"topic" text,
	"department_id" text,
	"unit_id" text,
	"incident_id" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"mentions" jsonb,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"parent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text DEFAULT 'SYSTEM' NOT NULL,
	"category" text DEFAULT 'SYSTEM' NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"resource_type" text,
	"resource_id" text,
	"metadata" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_type" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"colour" text DEFAULT '#64748b' NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_type" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text DEFAULT 'TEXT' NOT NULL,
	"section" text,
	"help_text" text,
	"placeholder" text,
	"required" boolean DEFAULT false NOT NULL,
	"default_value" text,
	"options" jsonb,
	"validation" jsonb,
	"conditions" jsonb,
	"show_in_list" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text
);
--> statement-breakpoint
CREATE TABLE "custom_field_values" (
	"id" text PRIMARY KEY NOT NULL,
	"definition_id" text NOT NULL,
	"record_id" text NOT NULL,
	"value" text,
	"value_json" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_widgets" (
	"id" text PRIMARY KEY NOT NULL,
	"dashboard_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text,
	"config" jsonb,
	"size" text DEFAULT 'medium' NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"w" integer DEFAULT 1 NOT NULL,
	"h" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text DEFAULT 'Default' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text DEFAULT 'TEXT' NOT NULL,
	"section" text,
	"help_text" text,
	"placeholder" text,
	"required" boolean DEFAULT false NOT NULL,
	"default_value" text,
	"options" jsonb,
	"validation" jsonb,
	"conditions" jsonb,
	"width" text DEFAULT 'full' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"record_type" text,
	"record_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'SUBMITTED' NOT NULL,
	"submitted_by_id" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"resource_type" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_core" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigation_items" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"href" text,
	"icon" text,
	"module_key" text,
	"parent_id" text,
	"permission" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"group" text DEFAULT 'main',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisation_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text DEFAULT 'default' NOT NULL,
	"organisation_name" text DEFAULT 'Northgate Operations' NOT NULL,
	"organisation_short" text,
	"tagline" text,
	"contact_email" text,
	"contact_phone" text,
	"address" text,
	"logo_url" text,
	"favicon_url" text,
	"login_background_url" text,
	"primary_colour" text DEFAULT '#3b82f6' NOT NULL,
	"accent_colour" text DEFAULT '#22d3ee' NOT NULL,
	"sidebar_colour" text DEFAULT '#0b1220' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"query" text NOT NULL,
	"filters" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_type" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"colour" text DEFAULT '#64748b' NOT NULL,
	"icon" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "terminology_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"term_key" text NOT NULL,
	"singular" text NOT NULL,
	"plural" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text DEFAULT 'default' NOT NULL,
	"mode" text DEFAULT 'dark' NOT NULL,
	"accent_colour" text DEFAULT '#3b82f6' NOT NULL,
	"density" text DEFAULT 'comfortable' NOT NULL,
	"radius" text DEFAULT '0.6rem' NOT NULL,
	"sidebar_style" text DEFAULT 'default' NOT NULL,
	"font_family" text DEFAULT 'inter' NOT NULL,
	"motion" text DEFAULT 'full' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "workflow_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_conditions" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"field" text NOT NULL,
	"operator" text DEFAULT 'EQUALS' NOT NULL,
	"value" text,
	"conjunction" text DEFAULT 'AND' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'SUCCESS' NOT NULL,
	"result" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"resource_type" text NOT NULL,
	"trigger" text DEFAULT 'RECORD_CREATED' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" text
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"checksum" text NOT NULL,
	"description" text,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"uploaded_by_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"summary" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"metadata" jsonb,
	"ip" text,
	"user_agent" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"from_type" text NOT NULL,
	"from_id" text NOT NULL,
	"to_type" text NOT NULL,
	"to_id" text NOT NULL,
	"relation_type" text DEFAULT 'RELATED' NOT NULL,
	"metadata" jsonb,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"type" text DEFAULT 'SYSTEM' NOT NULL,
	"message" text NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_addresses" ADD CONSTRAINT "person_addresses_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_contacts" ADD CONSTRAINT "person_contacts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_identifiers" ADD CONSTRAINT "person_identifiers_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_vehicles" ADD CONSTRAINT "person_vehicles_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_vehicles" ADD CONSTRAINT "person_vehicles_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_units" ADD CONSTRAINT "call_units_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_units" ADD CONSTRAINT "call_units_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_received_by_id_users_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_incidents" ADD CONSTRAINT "case_incidents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_incidents" ADD CONSTRAINT "case_incidents_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_lead_id_users_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_participants" ADD CONSTRAINT "incident_participants_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_participants" ADD CONSTRAINT "incident_participants_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_vehicles" ADD CONSTRAINT "incident_vehicles_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_vehicles" ADD CONSTRAINT "incident_vehicles_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_id_users_id_fk" FOREIGN KEY ("acknowledged_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolos" ADD CONSTRAINT "bolos_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolos" ADD CONSTRAINT "bolos_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolos" ADD CONSTRAINT "bolos_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolos" ADD CONSTRAINT "bolos_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolos" ADD CONSTRAINT "bolos_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_custodian_id_users_id_fk" FOREIGN KEY ("custodian_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_events" ADD CONSTRAINT "evidence_events_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_events" ADD CONSTRAINT "evidence_events_from_custodian_id_users_id_fk" FOREIGN KEY ("from_custodian_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_events" ADD CONSTRAINT "evidence_events_to_custodian_id_users_id_fk" FOREIGN KEY ("to_custodian_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_events" ADD CONSTRAINT "evidence_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warrants" ADD CONSTRAINT "warrants_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warrants" ADD CONSTRAINT "warrants_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warrants" ADD CONSTRAINT "warrants_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_definition_id_custom_field_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."custom_field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_settings" ADD CONSTRAINT "organisation_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_settings" ADD CONSTRAINT "theme_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_conditions" ADD CONSTRAINT "workflow_conditions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_relationships" ADD CONSTRAINT "record_relationships_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_token_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_key_unique" ON "permissions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "permissions_resource_idx" ON "permissions" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "permissions_category_idx" ON "permissions" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permission_unique" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE INDEX "role_permission_permission_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_key_unique" ON "roles" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_unique" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "user_role_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_department_idx" ON "users" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "users_deleted_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_name_unique" ON "departments" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_code_unique" ON "departments" USING btree ("code");--> statement-breakpoint
CREATE INDEX "departments_active_idx" ON "departments" USING btree ("active");--> statement-breakpoint
CREATE INDEX "person_address_person_idx" ON "person_addresses" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_contact_person_idx" ON "person_contacts" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_contact_value_idx" ON "person_contacts" USING btree ("value");--> statement-breakpoint
CREATE UNIQUE INDEX "person_identifier_unique" ON "person_identifiers" USING btree ("person_id","type","value");--> statement-breakpoint
CREATE INDEX "person_identifier_value_idx" ON "person_identifiers" USING btree ("value");--> statement-breakpoint
CREATE UNIQUE INDEX "person_vehicle_unique" ON "person_vehicles" USING btree ("person_id","vehicle_id","relationship");--> statement-breakpoint
CREATE INDEX "person_vehicle_vehicle_idx" ON "person_vehicles" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_reference_unique" ON "persons" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "persons_name_idx" ON "persons" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "persons_status_idx" ON "persons" USING btree ("status");--> statement-breakpoint
CREATE INDEX "persons_department_idx" ON "persons" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "persons_deleted_idx" ON "persons" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "persons_created_idx" ON "persons" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_member_unique" ON "unit_members" USING btree ("unit_id","user_id");--> statement-breakpoint
CREATE INDEX "unit_member_user_idx" ON "unit_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "units_callsign_unique" ON "units" USING btree ("callsign");--> statement-breakpoint
CREATE INDEX "units_status_idx" ON "units" USING btree ("status");--> statement-breakpoint
CREATE INDEX "units_department_idx" ON "units" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "units_deleted_idx" ON "units" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_reference_unique" ON "vehicles" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_registration_unique" ON "vehicles" USING btree ("registration");--> statement-breakpoint
CREATE INDEX "vehicles_status_idx" ON "vehicles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vehicles_registration_idx" ON "vehicles" USING btree ("registration");--> statement-breakpoint
CREATE INDEX "vehicles_department_idx" ON "vehicles" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "vehicles_deleted_idx" ON "vehicles" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "call_unit_unique" ON "call_units" USING btree ("call_id","unit_id");--> statement-breakpoint
CREATE INDEX "call_unit_unit_idx" ON "call_units" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calls_reference_unique" ON "calls" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "calls_status_idx" ON "calls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "calls_priority_idx" ON "calls" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "calls_received_idx" ON "calls" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "case_incident_unique" ON "case_incidents" USING btree ("case_id","incident_id");--> statement-breakpoint
CREATE INDEX "case_incident_incident_idx" ON "case_incidents" USING btree ("incident_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cases_reference_unique" ON "cases" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "cases_status_idx" ON "cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cases_priority_idx" ON "cases" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "cases_department_idx" ON "cases" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "cases_deleted_idx" ON "cases" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "incident_assignment_incident_idx" ON "incident_assignments" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incident_assignment_unit_idx" ON "incident_assignments" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "incident_assignment_user_idx" ON "incident_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "incident_participant_unique" ON "incident_participants" USING btree ("incident_id","person_id","role");--> statement-breakpoint
CREATE INDEX "incident_participant_person_idx" ON "incident_participants" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "incident_vehicle_unique" ON "incident_vehicles" USING btree ("incident_id","vehicle_id","role");--> statement-breakpoint
CREATE INDEX "incident_vehicle_vehicle_idx" ON "incident_vehicles" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_reference_unique" ON "incidents" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "incidents_priority_idx" ON "incidents" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "incidents_reported_idx" ON "incidents" USING btree ("reported_at");--> statement-breakpoint
CREATE INDEX "incidents_department_idx" ON "incidents" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "incidents_deleted_idx" ON "incidents" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_reference_unique" ON "alerts" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alerts_priority_idx" ON "alerts" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "alerts_type_idx" ON "alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "alerts_deleted_idx" ON "alerts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "alerts_created_idx" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bolos_reference_unique" ON "bolos" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "bolos_status_idx" ON "bolos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bolos_priority_idx" ON "bolos" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "bolos_deleted_idx" ON "bolos" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_item_number_unique" ON "evidence" USING btree ("item_number");--> statement-breakpoint
CREATE INDEX "evidence_status_idx" ON "evidence" USING btree ("status");--> statement-breakpoint
CREATE INDEX "evidence_incident_idx" ON "evidence" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "evidence_custodian_idx" ON "evidence" USING btree ("custodian_id");--> statement-breakpoint
CREATE INDEX "evidence_deleted_idx" ON "evidence" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "evidence_event_evidence_idx" ON "evidence_events" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "evidence_event_occurred_idx" ON "evidence_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "report_version_unique" ON "report_versions" USING btree ("report_id","version");--> statement-breakpoint
CREATE INDEX "report_version_report_idx" ON "report_versions" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_reference_unique" ON "reports" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reports_author_idx" ON "reports" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "reports_incident_idx" ON "reports" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "reports_case_idx" ON "reports" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "reports_deleted_idx" ON "reports" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "reports_created_idx" ON "reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "task_comment_task_idx" ON "task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_reference_unique" ON "tasks" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "tasks_record_idx" ON "tasks" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "tasks_deleted_idx" ON "tasks" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "warrants_reference_unique" ON "warrants" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "warrants_person_idx" ON "warrants" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "warrants_status_idx" ON "warrants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "warrants_expires_idx" ON "warrants" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "warrants_deleted_idx" ON "warrants" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_member_unique" ON "channel_members" USING btree ("channel_id","user_id");--> statement-breakpoint
CREATE INDEX "channel_member_user_idx" ON "channel_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "channels_type_idx" ON "channels" USING btree ("type");--> statement-breakpoint
CREATE INDEX "channels_unit_idx" ON "channels" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "channels_department_idx" ON "channels" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "messages_channel_idx" ON "messages" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_author_idx" ON "messages" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preference_unique" ON "notification_preferences" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_category_idx" ON "notifications" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "category_definition_unique" ON "category_definitions" USING btree ("resource_type","key");--> statement-breakpoint
CREATE INDEX "category_definition_type_idx" ON "category_definitions" USING btree ("resource_type");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_definition_unique" ON "custom_field_definitions" USING btree ("resource_type","key");--> statement-breakpoint
CREATE INDEX "custom_field_definition_type_idx" ON "custom_field_definitions" USING btree ("resource_type","active");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_value_unique" ON "custom_field_values" USING btree ("definition_id","record_id");--> statement-breakpoint
CREATE INDEX "custom_field_value_record_idx" ON "custom_field_values" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "dashboard_widget_dashboard_idx" ON "dashboard_widgets" USING btree ("dashboard_id");--> statement-breakpoint
CREATE INDEX "dashboards_user_idx" ON "dashboards" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_field_unique" ON "form_fields" USING btree ("form_id","key");--> statement-breakpoint
CREATE INDEX "form_field_form_idx" ON "form_fields" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_submission_form_idx" ON "form_submissions" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_submission_record_idx" ON "form_submissions" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "forms_key_unique" ON "forms" USING btree ("key");--> statement-breakpoint
CREATE INDEX "forms_resource_type_idx" ON "forms" USING btree ("resource_type");--> statement-breakpoint
CREATE UNIQUE INDEX "modules_key_unique" ON "modules" USING btree ("key");--> statement-breakpoint
CREATE INDEX "modules_enabled_idx" ON "modules" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "navigation_items_key_unique" ON "navigation_items" USING btree ("key");--> statement-breakpoint
CREATE INDEX "navigation_items_parent_idx" ON "navigation_items" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organisation_settings_key_unique" ON "organisation_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "saved_search_user_idx" ON "saved_searches" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "saved_view_user_idx" ON "saved_views" USING btree ("user_id","resource_type");--> statement-breakpoint
CREATE UNIQUE INDEX "status_definition_unique" ON "status_definitions" USING btree ("resource_type","key");--> statement-breakpoint
CREATE INDEX "status_definition_type_idx" ON "status_definitions" USING btree ("resource_type");--> statement-breakpoint
CREATE UNIQUE INDEX "system_settings_key_unique" ON "system_settings" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "terminology_term_key_unique" ON "terminology_entries" USING btree ("term_key");--> statement-breakpoint
CREATE UNIQUE INDEX "theme_settings_key_unique" ON "theme_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "workflow_action_workflow_idx" ON "workflow_actions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_condition_workflow_idx" ON "workflow_conditions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_run_record_idx" ON "workflow_runs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "workflow_run_started_idx" ON "workflow_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflows_key_unique" ON "workflows" USING btree ("key");--> statement-breakpoint
CREATE INDEX "workflows_resource_idx" ON "workflows" USING btree ("resource_type","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_storage_key_unique" ON "attachments" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "attachments_record_idx" ON "attachments" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "notes_record_idx" ON "notes" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "record_relationship_unique" ON "record_relationships" USING btree ("from_type","from_id","to_type","to_id","relation_type");--> statement-breakpoint
CREATE INDEX "record_relationship_from_idx" ON "record_relationships" USING btree ("from_type","from_id");--> statement-breakpoint
CREATE INDEX "record_relationship_to_idx" ON "record_relationships" USING btree ("to_type","to_id");--> statement-breakpoint
CREATE INDEX "timeline_record_idx" ON "timeline_entries" USING btree ("record_type","record_id","occurred_at");
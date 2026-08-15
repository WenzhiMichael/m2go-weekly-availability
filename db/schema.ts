import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const employees = sqliteTable(
  "employees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    role: text("role").notNull().default("front"),
    color: text("color").notNull().default("#75A9F2"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_employees_active").on(table.active)],
);

export const scheduleWeeks = sqliteTable("schedule_weeks", {
  weekStart: text("week_start").primaryKey(),
  status: text("status").notNull().default("draft"),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const shiftTemplates = sqliteTable(
  "shift_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    weekday: integer("weekday").notNull(),
    label: text("label").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    endsNextDay: integer("ends_next_day", { mode: "boolean" }).notNull().default(false),
    employeeId: integer("employee_id").references(() => employees.id, { onDelete: "set null" }),
    note: text("note").notNull().default(""),
  },
  (table) => [uniqueIndex("idx_shift_templates_weekday_label").on(table.weekday, table.label)],
);

export const shifts = sqliteTable(
  "shifts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    weekStart: text("week_start").notNull().references(() => scheduleWeeks.weekStart, { onDelete: "cascade" }),
    shiftDate: text("shift_date").notNull(),
    label: text("label").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    endsNextDay: integer("ends_next_day", { mode: "boolean" }).notNull().default(false),
    employeeId: integer("employee_id").references(() => employees.id, { onDelete: "set null" }),
    note: text("note").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_shifts_date_label").on(table.shiftDate, table.label),
    index("idx_shifts_week_start").on(table.weekStart),
    index("idx_shifts_employee_week").on(table.employeeId, table.weekStart),
  ],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const weeklyAvailability = sqliteTable(
  "weekly_availability",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    weekStart: text("week_start").notNull(),
    normalizedName: text("normalized_name").notNull(),
    displayName: text("display_name").notNull(),
    availabilityJson: text("availability_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_weekly_availability_week_name").on(table.weekStart, table.normalizedName)],
);

export const availabilityEmployees = sqliteTable(
  "availability_employees",
  {
    id: integer("id").primaryKey(),
    displayName: text("display_name").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_availability_employees_display_name").on(table.displayName)],
);

export const employeeWeeklyAvailability = sqliteTable(
  "employee_weekly_availability",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    weekStart: text("week_start").notNull(),
    employeeId: integer("employee_id").notNull().references(() => availabilityEmployees.id, { onDelete: "cascade" }),
    availabilityJson: text("availability_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_employee_weekly_availability_week_employee").on(table.weekStart, table.employeeId)],
);

export const managerLoginAttempts = sqliteTable("manager_login_attempts", {
  clientKey: text("client_key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStarted: integer("window_started").notNull(),
});

export const employeeAccessTokens = sqliteTable(
  "employee_access_tokens",
  {
    employeeId: integer("employee_id").primaryKey().references(() => availabilityEmployees.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_employee_access_tokens_hash").on(table.tokenHash)],
);

export const weeklyScheduleAssignments = sqliteTable(
  "weekly_schedule_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    weekStart: text("week_start").notNull(),
    shiftDate: text("shift_date").notNull(),
    shiftCode: text("shift_code").notNull(),
    employeeId: integer("employee_id").notNull().references(() => availabilityEmployees.id, { onDelete: "cascade" }),
    state: text("state").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_weekly_schedule_assignment").on(table.weekStart, table.shiftDate, table.shiftCode, table.employeeId, table.state),
    index("idx_weekly_schedule_state_week").on(table.state, table.weekStart),
  ],
);

export const weeklySchedulePublications = sqliteTable("weekly_schedule_publications", {
  weekStart: text("week_start").primaryKey(),
  publishedAt: text("published_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const employeePairPreferences = sqliteTable(
  "employee_pair_preferences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeAId: integer("employee_a_id").notNull().references(() => availabilityEmployees.id, { onDelete: "cascade" }),
    employeeBId: integer("employee_b_id").notNull().references(() => availabilityEmployees.id, { onDelete: "cascade" }),
    preferenceType: text("preference_type").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_employee_pair_preference_pair").on(table.employeeAId, table.employeeBId)],
);

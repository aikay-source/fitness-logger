-- Add composite indexes for dashboard and cron query performance

-- Session: coachId + date for monthly/streak queries on dashboard
CREATE INDEX "Session_coachId_date_idx" ON "Session"("coachId", "date");

-- Client: coachId + active + sessionsRemaining for low-sessions alert queries
CREATE INDEX "Client_coachId_active_sessionsRemaining_idx" ON "Client"("coachId", "active", "sessionsRemaining");

-- User: reminderEnabled + reminderTime for daily-reminders cron filtering
CREATE INDEX "User_reminderEnabled_reminderTime_idx" ON "User"("reminderEnabled", "reminderTime");

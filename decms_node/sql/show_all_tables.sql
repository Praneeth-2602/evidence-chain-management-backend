-- show_all_tables.sql
-- A single SQL file with useful queries to inspect all DECMS tables, views, triggers, and procedures.
-- Run this in MySQL Workbench connected to the server. If your schema name is different, replace 'decms'.

USE `decms`;

-- 1) List tables
SHOW TABLES;

-- 2) Table row estimates
SELECT TABLE_NAME, TABLE_ROWS
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'decms'
ORDER BY TABLE_NAME;

-- 3) List triggers
SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_STATEMENT
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE TRIGGER_SCHEMA = 'decms';

-- 4) List stored procedures/functions
SELECT ROUTINE_NAME, ROUTINE_TYPE
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_SCHEMA = 'decms'
ORDER BY ROUTINE_TYPE, ROUTINE_NAME;

-- 5) SHOW CREATE / DESCRIBE and sample rows for each table

-- users
SELECT 'users' AS table_name;
SHOW CREATE TABLE `decms`.`users`\G
DESCRIBE `decms`.`users`;
SELECT * FROM `decms`.`users` LIMIT 100;

-- cases
SELECT 'cases' AS table_name;
SHOW CREATE TABLE `decms`.`cases`\G
DESCRIBE `decms`.`cases`;
SELECT * FROM `decms`.`cases` LIMIT 100;

-- storage_locations
SELECT 'storage_locations' AS table_name;
SHOW CREATE TABLE `decms`.`storage_locations`\G
DESCRIBE `decms`.`storage_locations`;
SELECT * FROM `decms`.`storage_locations` LIMIT 100;

-- evidence_items
SELECT 'evidence_items' AS table_name;
SHOW CREATE TABLE `decms`.`evidence_items`\G
DESCRIBE `decms`.`evidence_items`;
SELECT * FROM `decms`.`evidence_items` LIMIT 100;

-- evidence_transfers
SELECT 'evidence_transfers' AS table_name;
SHOW CREATE TABLE `decms`.`evidence_transfers`\G
DESCRIBE `decms`.`evidence_transfers`;
SELECT * FROM `decms`.`evidence_transfers` LIMIT 100;

-- analysis_reports
SELECT 'analysis_reports' AS table_name;
SHOW CREATE TABLE `decms`.`analysis_reports`\G
DESCRIBE `decms`.`analysis_reports`;
SELECT * FROM `decms`.`analysis_reports` LIMIT 100;

-- access_logs
SELECT 'access_logs' AS table_name;
SHOW CREATE TABLE `decms`.`access_logs`\G
DESCRIBE `decms`.`access_logs`;
SELECT * FROM `decms`.`access_logs` LIMIT 200;

-- notifications
SELECT 'notifications' AS table_name;
SHOW CREATE TABLE `decms`.`notifications`\G
DESCRIBE `decms`.`notifications`;
SELECT * FROM `decms`.`notifications` LIMIT 200;

-- Views
SELECT 'vw_case_overview' AS view_name;
SHOW CREATE VIEW `decms`.`vw_case_overview`\G
SELECT * FROM `decms`.`vw_case_overview` LIMIT 200;

-- Procedures (show create for known procedure if exists)
SELECT 'sp_generate_analysis_summary' AS procedure_name;
SHOW CREATE PROCEDURE `decms`.`sp_generate_analysis_summary`\G

-- Helpful: list all indexes per table
SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'decms'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- End of file

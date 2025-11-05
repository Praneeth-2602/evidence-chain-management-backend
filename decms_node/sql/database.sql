-- DECMS database schema (MySQL)
-- Run this file to create schema, triggers, and stored procedures

CREATE DATABASE IF NOT EXISTS decms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE decms;

-- Users
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('Admin','Investigator','Lab Staff') NOT NULL,
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cases
CREATE TABLE IF NOT EXISTS cases (
  case_id INT AUTO_INCREMENT PRIMARY KEY,
  case_title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to INT, -- user_id
  status VARCHAR(50) DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (assigned_to),
  FOREIGN KEY (assigned_to) REFERENCES users(user_id)
);

-- Storage locations
CREATE TABLE IF NOT EXISTS storage_locations (
  storage_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  location_details TEXT,
  capacity INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Active'
);

-- Evidence items
CREATE TABLE IF NOT EXISTS evidence_items (
  evidence_id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  collected_by INT,
  evidence_type VARCHAR(100),
  description TEXT,
  storage_id INT,
  current_status VARCHAR(50) DEFAULT 'Collected',
  collected_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  current_custodian_id INT,
  file_path VARCHAR(1024),
  INDEX (case_id),
  INDEX (collected_by),
  FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (storage_id) REFERENCES storage_locations(storage_id)
);

-- Transfers
CREATE TABLE IF NOT EXISTS evidence_transfers (
  transfer_id INT AUTO_INCREMENT PRIMARY KEY,
  evidence_id INT NOT NULL,
  from_user INT NOT NULL,
  to_user INT NOT NULL,
  remarks TEXT,
  transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id) ON DELETE CASCADE
);

-- Reports
CREATE TABLE IF NOT EXISTS analysis_reports (
  report_id INT AUTO_INCREMENT PRIMARY KEY,
  evidence_id INT NOT NULL,
  analyst_id INT NOT NULL,
  findings TEXT,
  report_file VARCHAR(1024),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id) ON DELETE CASCADE
);

-- Logs
CREATE TABLE IF NOT EXISTS access_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  evidence_id INT,
  action VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Example trigger: after insert on evidence_transfers, insert a log entry
DELIMITER $$
CREATE TRIGGER trg_after_transfer
AFTER INSERT ON evidence_transfers
FOR EACH ROW
BEGIN
  INSERT INTO access_logs(user_id, evidence_id, action, timestamp) VALUES (NEW.to_user, NEW.evidence_id, CONCAT('TRANSFER_FROM_', NEW.from_user, '_TO_', NEW.to_user), NEW.transfer_date);
  -- Also update evidence current custodian (defensive)
  UPDATE evidence_items SET current_custodian_id = NEW.to_user WHERE evidence_id = NEW.evidence_id;
END$$
DELIMITER ;

-- Stored procedure example: aggregate findings into a report summary
DELIMITER $$
CREATE PROCEDURE sp_generate_analysis_summary(IN p_evidence_id INT)
BEGIN
  DECLARE summary TEXT DEFAULT '';
  SELECT GROUP_CONCAT(CONCAT('[', DATE_FORMAT(created_at, '%Y-%m-%d'), '] ', LEFT(findings,200)) SEPARATOR '\n') INTO summary FROM analysis_reports WHERE evidence_id = p_evidence_id;
  INSERT INTO analysis_reports (evidence_id, analyst_id, findings, report_file, created_at) VALUES (p_evidence_id, NULL, CONCAT('AutoSummary:\n', IFNULL(summary, 'No findings')), NULL, NOW());
END$$
DELIMITER ;

-- View: case overview
CREATE OR REPLACE VIEW vw_case_overview AS
SELECT c.case_id, c.case_title, c.status, COUNT(e.evidence_id) AS evidence_count
FROM cases c LEFT JOIN evidence_items e ON c.case_id = e.case_id
GROUP BY c.case_id, c.case_title, c.status;

#!/usr/bin/env node
/**
 * Simple helper script to show a mysqldump command for backing up the DECMS database.
 * Could be extended to execute the dump automatically if mysqldump is installed.
 */
require('dotenv').config();

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

function buildCommand() {
  return [
    'mysqldump',
    `-h ${DB_HOST || 'localhost'}`,
    `-P ${DB_PORT || '3306'}`,
    `-u ${DB_USER || 'root'}`,
    DB_PASSWORD ? `-p${DB_PASSWORD}` : '',
    DB_NAME || 'decms',
    '> decms_backup.sql'
  ].filter(Boolean).join(' ');
}

console.log('\nBackup command suggestion:\n');
console.log(buildCommand());
console.log('\nNOTE: Ensure mysqldump is installed and in PATH.');
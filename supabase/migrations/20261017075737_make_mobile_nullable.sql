/*
# Make mobile nullable for Google OAuth users

Google OAuth users don't have a mobile number when they first sign in.
They complete their profile (including mobile) after the initial Google login.
This migration makes the mobile column nullable to support that flow.

## Changes
- `profiles.mobile` changed from NOT NULL to nullable
- Unique constraint preserved (nulls are not counted as duplicates in Postgres)
*/

ALTER TABLE profiles ALTER COLUMN mobile DROP NOT NULL;

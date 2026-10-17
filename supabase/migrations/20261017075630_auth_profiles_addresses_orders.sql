/*
# Authentication System: Profiles, Addresses, Orders, Password Resets

## Overview
This migration creates the core tables for a custom mobile-number + password authentication system.
Since Supabase Auth does not natively support mobile+password without OTP, we use a custom
server-side auth approach with Edge Functions handling bcrypt password hashing and JWT session
management. Google OAuth users are linked via their Google identity.

## New Tables

### 1. `profiles`
Stores customer profile data linked to Supabase Auth users.
- `id` (uuid, PK) — references `auth.users(id)`, one-to-one with auth users
- `mobile` (text, unique, not null) — Indian mobile number, 10 digits starting with 6-9
- `full_name` (text, not null) — customer's display name
- `gender` (text, nullable) — 'male', 'female', 'other', or 'prefer_not_to_say'
- `avatar_url` (text, nullable) — profile photo URL (Google OAuth users may have this)
- `google_id` (text, nullable) — Google OAuth subject ID, for dedup
- `password_hash` (text, nullable) — bcrypt hash; null for Google-only users
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### 2. `addresses`
Saved delivery addresses for each customer.
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, not null)
- `full_name` (text, not null)
- `mobile` (text, not null)
- `pincode` (text, not null) — 6-digit Indian PIN code
- `address_line` (text, not null)
- `city` (text, not null)
- `state` (text, not null)
- `is_default` (boolean, default false)

### 3. `orders`
Order records for each customer.
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, not null)
- `order_number` (text, unique, not null) — human-readable order number like TW-XXXXX
- `items` (jsonb, not null) — array of cart items at time of order
- `subtotal` (integer, not null) — in paise/rupees
- `shipping` (integer, not null)
- `discount` (integer, default 0)
- `total` (integer, not null)
- `status` (text, default 'placed') — placed, dispatched, delivered, cancelled
- `shipping_address` (jsonb, not null)
- `payment_method` (text, not null)
- `created_at` (timestamptz, default now())

### 4. `password_resets`
Secure password reset tokens.
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, not null)
- `token_hash` (text, not null) — bcrypt hash of the reset token
- `expires_at` (timestamptz, not null)
- `used_at` (timestamptz, nullable)

### 5. `auth_rate_limits`
Login attempt rate limiting per mobile number.
- `id` (uuid, PK)
- `mobile` (text, not null)
- `attempted_at` (timestamptz, default now())

## Security
- RLS enabled on all tables.
- `profiles`: users can read/update only their own profile. INSERT is via SECURITY DEFINER function (edge function creates auth user + profile together).
- `addresses`: full CRUD scoped to owner.
- `orders`: SELECT only for owner; INSERT via edge function.
- `password_resets`: no direct access from client; managed by edge function with service role.
- `auth_rate_limits`: no direct access from client; managed by edge function with service role.
*/

-- ============ profiles ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mobile text UNIQUE NOT NULL,
  full_name text NOT NULL,
  gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  avatar_url text,
  google_id text,
  password_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ addresses ============
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  mobile text NOT NULL,
  pincode text NOT NULL,
  address_line text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_addresses" ON addresses;
CREATE POLICY "select_own_addresses" ON addresses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_addresses" ON addresses;
CREATE POLICY "insert_own_addresses" ON addresses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_addresses" ON addresses;
CREATE POLICY "update_own_addresses" ON addresses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_addresses" ON addresses;
CREATE POLICY "delete_own_addresses" ON addresses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ orders ============
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number text UNIQUE NOT NULL,
  items jsonb NOT NULL,
  subtotal integer NOT NULL,
  shipping integer NOT NULL,
  discount integer DEFAULT 0,
  total integer NOT NULL,
  status text DEFAULT 'placed',
  shipping_address jsonb NOT NULL,
  payment_method text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ============ password_resets ============
CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
-- No policies: only accessible via service role key from edge functions

-- ============ auth_rate_limits ============
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL,
  attempted_at timestamptz DEFAULT now()
);

ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only accessible via service role key from edge functions

-- Index for rate limit lookups
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_mobile ON auth_rate_limits(mobile, attempted_at);

-- Index for profile lookups by mobile
CREATE INDEX IF NOT EXISTS idx_profiles_mobile ON profiles(mobile);

-- Index for orders by user
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id, created_at DESC);

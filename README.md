# E-Presensi Mobile

Mobile attendance application built with Expo Router, TypeScript, and Supabase. It uses Supabase Auth, PostgreSQL RLS/RPC validation, and private Storage for attendance evidence.

## Start

1. Copy `.env.example` to `.env` and set the Supabase URL and **anon/publishable** key.
2. Apply `supabase/migrations/20260902000000_epresensi.sql` through the Supabase CLI or SQL editor.
3. Create Auth users, then insert their associated `profiles` rows using trusted administration tooling. Never place `service_role` credentials in this app.
4. Run `npm install` then `npm start`.

## Security design

The database migration contains RLS policies and security-definer RPCs for check-in/out. RPCs derive the profile from `auth.uid()`, enforce one attendance per day, validate the expected private storage path, enforce online reasons, and perform the final Haversine radius validation in PostgreSQL. The mobile client only uses public Expo environment variables.

## Known platform note

A map view is deliberately not a dependency in this baseline; coordinates, areas, and programmatic server validation are implemented. A map provider can be introduced behind a UI component without weakening attendance validation.

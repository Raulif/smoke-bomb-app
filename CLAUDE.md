# Smoke Bomb — Project Brief

## Purpose

A mobile game for friend groups who go out clubbing together. Players sneak out of the club without saying goodbye — called **throwing a smoke bomb** — and earn points the longer they go undetected. Other players try to guess who left. The game runs in sessions tied to a night out, with persistent groups and an all-time leaderboard.

---

## Tech Stack

- **Expo + React Native** — iOS and Android
- **Supabase** — auth, database, real-time, edge functions
- **Expo Notifications** — push notifications
- **pnpm** — package manager (always use pnpm, never npm or yarn)

---

## Database Schema

| Table           | Fields                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`         | id, username, avatar_url, phone, lifetime_points, created_at                                                                                 |
| `groups`        | id, name, invite_code, created_by, created_at                                                                                                |
| `group_members` | id, group_id, user_id, total_points, joined_at                                                                                               |
| `sessions`      | id, group_id, started_by, status (active/closed), created_at, closed_at                                                                      |
| `smoke_bombs`   | id, session_id, thrown_by, activated_at, arrived_home_at, status (active/discovered/escaped), victory_message, caught_message, points_earned |
| `accusations`   | id, smoke_bomb_id, accused_by, accused_user_id, correct (bool), accused_at, points_earned                                                    |
| `badges`        | id, user_id, badge_type, earned_at                                                                                                           |

---

## Auth

- Phone number + SMS verification **or** Google/Apple sign-in via Supabase Auth
- Random avatar assigned on signup, replaceable with photo
- Username chosen on first login

---

## Core Game Logic

- One smoke bomb active per session at a time
- Smoke bomb activation is **silent** — no notification sent to the group or information on the app
- Timer starts on activation
- Session ends when:
  - Thrower presses "I'm home"
  - A correct accusation is made
  - Last player manually closes it
- **Thrower points** scale with time elapsed — longer undetected = more points
- **Accuser points** scale with how quickly they accused (correct accusation)
- Wrong accusation: accuser loses points, wrongly accused gets compensation points (per-session cap)
- Once a smoke bomb is thrown, thrower is **locked out** of session interactions
- Thrower writes two messages on activation:
  - **Victory message** — shown to the whole group if they escape
  - **Caught message** — shown privately to whoever correctly accuses them

---

## Real-time Requirements

All of the following must sync instantly across all players via **Supabase real-time subscriptions**:

- Session state
- Smoke bomb timer (must be consistent for all players)
- Accusation resolution

---

## Edge Functions

- **Points calculation** — triggered when session ends; calculates and assigns all points
- **Badge awards** — triggered after each session; checks and awards badges

### Badge Criteria

| Badge      | Criteria                                  |
| ---------- | ----------------------------------------- |
| Ghost      | Escaped once                              |
| Phantom    | Escaped 3 sessions in a row               |
| Sprinter   | Fastest time home in group history        |
| Bloodhound | 1 correct accusation                      |
| Detective  | 5 correct accusations                     |
| Founder    | Created a group                           |
| Legend     | Top of group leaderboard for a full month |

---

## Screens

| Screen            | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| Auth / Onboarding | Phone/Google/Apple sign-in, username + avatar setup         |
| Home              | List of your groups                                         |
| Group             | Leaderboard, session history, member profiles               |
| Session           | Active players list, smoke bomb button, accusation controls |
| Smoke Trail       | Post-session timeline of events from the night              |
| Profile           | Username, avatar, badges, lifetime points                   |

---

## Build Order

1. Auth and user profiles
2. Group creation and joining via invite code
3. Session management
4. Smoke bomb mechanic and timer
5. Points system
6. Accusations mechanic
7. Smoke Trail post-session timeline
8. Badges and reputation system

---

## Current Status

- [x] Step 1 — Auth and user profiles
- [x] Step 2 — Group creation and joining
- [x] Step 3 — Session management
- [x] Step 4 — Smoke bomb mechanic and timer
- [x] Step 5 — Points system
- [x] Step 6 — Accusations mechanic
- [x] Step 7 — Smoke Trail
- [x] Step 8 — Badges and reputation system

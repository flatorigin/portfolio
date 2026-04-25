# Moderation, Reporting, and Copyright Intake

## Current product behavior

Users can currently report:

- public profiles
- public projects
- project images
- homeowner reference images
- message threads
- private messages

Reports are submitted through `/api/reports/` and stored as `UserReport`
records. Admin staff can review reports and take moderation action through
Django admin.

## Admin capabilities currently implemented

Staff roles and admin gating exist.

Moderation tools currently include:

- report queue
- report status updates
- account freeze/unfreeze
- account deactivation
- direct-message disable
- moderation action logging
- admin audit logging

Relevant internal models:

- `UserReport`
- `ModerationAction`
- `AdminAuditLog`
- `StaffAccess`

## Notice-and-action posture

Current user-facing terms state that:

- users can report unsafe, unlawful, infringing, misleading, or abusive content
- FlatOrigin reviews reports internally
- urgent safety/illegal-content reports are intended to receive initial review
  within 24 to 48 hours when reasonably possible

This is an operational target, not a guaranteed SLA.

## Current DMCA / copyright posture

The site now has a dedicated `/copyright` page that describes:

- what a notice should include
- how the platform may respond
- repeat-infringer handling
- the designated intake address currently shown to users

Current placeholder contact:

- `copyright@flatorigin.com`

## Repeat infringer posture

The current intended platform position is that repeated or serious copyright
violations may lead to:

- content removal
- account restrictions
- profile freeze
- permanent removal

Internal logs may be retained to support repeat-infringer enforcement.

## Operational gaps counsel should review

1. Exact DMCA notice language
2. Counter-notice handling language and workflow
3. Threshold for repeat-infringer enforcement
4. Evidence preservation expectations
5. Whether the current public timing language should be narrower or broader
6. Whether the designated copyright intake details are sufficient for launch

## Questions for counsel

1. What exact takedown and counter-notice process should be published?
2. What timeline language is safest to publish?
3. What threshold should trigger repeat-infringer restrictions or termination?
4. Should any content categories require mandatory escalation language?
5. What records must be retained for defensibility?

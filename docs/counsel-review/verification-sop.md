# Contractor Document Review SOP

This document defines the current intended workflow for contractor trust badges.

The goal is to support a narrow, defensible review claim. It is not a promise
that FlatOrigin independently validates every regulatory fact about a business.

## Inputs a contractor may submit

- license number
- license state or jurisdiction
- insurance provider
- insurance policy number
- insurance expiration date

## System states

Internal status values:

- `unverified`
- `pending`
- `verified`
- `rejected`
- `expired`

Public badge language:

- `Review pending`
- `Credentials reviewed`
- `Review expired`

## Badge meaning

### Review pending

Meaning:

- the contractor submitted information for staff review
- FlatOrigin has not yet approved the review badge

This does not mean:

- the platform confirmed a license
- the platform confirmed insurance coverage
- the platform endorses the contractor

### Credentials reviewed

Meaning:

- staff reviewed the submitted information under the then-current internal process
- the profile may show a review badge until the review expires or is changed

This does not mean:

- the platform guarantees current legal licensing in every jurisdiction
- the platform guarantees insurance is active at the time of hire
- the platform guarantees work quality, code compliance, honesty, or safety

### Review expired

Meaning:

- the prior review is no longer current under the platform's review window or
  expiration rules

## Minimum internal review steps

Before setting a profile to `verified` / public label `Credentials reviewed`,
staff should record that they reviewed at least some combination of:

- submitted license identifier
- submitted jurisdiction
- submitted insurance information
- expiration date where available
- any additional supporting notes

Staff should not apply the reviewed state if:

- the submission is blank or materially incomplete
- the documentation appears inconsistent
- the expiration date has already passed
- there is unresolved fraud or impersonation concern on the account

## Admin behavior currently implemented

Admin can:

- mark review pending
- mark reviewed
- mark rejected
- mark expired

When a profile is marked reviewed:

- `verification_reviewed_at` is set
- `verification_review_due_at` defaults to roughly one year ahead if blank
- `verification_expires_at` may follow the submitted insurance expiration if present

When the expiration date passes:

- the effective public state downgrades automatically to `expired`

## Claims staff should not make

Do not tell users:

- "FlatOrigin guarantees this contractor is licensed"
- "FlatOrigin guarantees active insurance coverage"
- "FlatOrigin approves this contractor"
- "FlatOrigin guarantees workmanship or legal compliance"

Preferred wording:

- "Credentials reviewed"
- "Review pending"
- "Review expired"
- "Submitted license and insurance information was reviewed by staff"

## Questions for counsel

1. Is `Credentials reviewed` the right public label?
2. Should the public label be even narrower?
3. Should state-specific caveats be added for contractor licensing claims?
4. What exact supporting process is required before a reviewed badge can be shown?
5. Should insurance-related review be separated from license-related review?

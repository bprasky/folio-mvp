# Non-Negotiables

## Purpose

This document defines immutable constraints, requirements, and principles that cannot be compromised or changed without explicit authorization.

## Sections

- Technical Constraints
- Business Rules
- Security Requirements
- Data Integrity Rules

### Content and Publishing Constraints
- The canonical user term is INDIVIDUAL. The term "homeowner" is deprecated and must not be used.
- Editorial is a status earned by a Posted Project, not a parallel publishing system.
- Editorial Edition is a curation layer applied only after Editorial status is achieved.
- All UI, copy, and logic must follow the canonical taxonomy:
  Project → Posted Project → Editorial Project → Editorial Edition Project.

---

## Commerce Addendum

This addendum extends the Non-Negotiables document with immutable constraints for the commerce and credit system.

### Commerce Non-Negotiables

#### Folio Credit Properties

- Folio Credit is NEVER redeemable for cash. No exceptions, no edge cases, no special circumstances.
- Folio Credit is ONLY spendable within the Folio ecosystem on participating vendor products at trade price.
- Folio Credit is non-transferable between users.
- Taxable events occur at redemption, not accrual. This is the structural basis for the credit system.

#### Trade Discount Handling

- Folio must hold the wholesale/trade account for any vendor participating in commerce. Folio is the purchasing entity.
- Trade pricing is NEVER posted publicly. The "Folio Price" is a discount from retail, not trade pricing exposed.
- Attribution is legitimate. Every commerce transaction must trace to real designer influence (product tag in published project).

#### Split Integrity

- Designer commission is earned, not promised. Credit only accrues on completed, non-returned orders.
- Rep attribution is funded from Folio's margin, not as an additional vendor cost.
- Hold periods exist for returns protection. No credit becomes available until the returns window closes.

#### User Terminology

- The canonical term for non-cash earnings is Folio Credit.
- Do not use: points, rewards, tokens, coins, balance dollars, or any term implying cash equivalence.
- Folio Credit may be abbreviated to Credit in UI after first use establishes context.

#### Financial Operations

- All monetary amounts in database are stored in cents (integers) to avoid floating point errors.
- Credit balances are stored as Decimal for precision.
- Orders must complete before credit accrues. Pending orders do not generate credit.
- Cancelled orders reverse credit redemptions but do not claw back earned credit (unless earned from that order).

### Prohibited Patterns

#### Never Implement

- Cash withdrawal of Folio Credit
- Credit transfer between users
- Credit expiration without user notification and grace period
- Automatic credit spending without explicit user action
- Credit earning on incomplete/pending orders
- Trade pricing visible to non-authenticated users
- Commission promises before order completion

#### Always Require

- Explicit user action to apply credit to an order
- Clear display of pending vs. available credit
- Audit trail for all credit transactions
- Admin visibility into all commerce operations
- Returns-period hold on credit availability

### Exception Authority

Any exception to these non-negotiables requires:

1. Written documentation of the exception and rationale
2. Review of tax and legal implications
3. Update to this document before implementation

No code changes to commerce systems should proceed if they violate these constraints.

# 14_MONETIZATION_AND_VERIFICATION

## Purpose

This document defines Folio's approach to designer and vendor monetization, verification, and tier structure. It establishes the philosophy that security comes from structure, not surveillance—and that conversion comes from demonstrated value, not sales pressure.

## Core Philosophy

### Launch Prep, Not Free Trial

Folio rejects the traditional SaaS model of "free trial → pay → onboard → hope they stay." Instead, Folio inverts the sequence:

```
Sign up → Build → See value accumulate → Pay to release it → Already retained
```

The free tier is not a destination. It is a launch prep mode where designers build their portfolio, tag products, and perfect their presence before going public. By the time they see a payment screen, they're looking at:

> "You have 6 projects with 847 products tagged representing $312,000 in specified value. Ready to go live?"

That's not a subscription pitch. That's a launch button.

### Security Through Structure

Fraud is not deterred by forms and checkboxes. It is deterred by **consequential verification**—steps that are easy for legitimate users but require actual criminal fraud to fake.

The natural progression creates its own fraud deterrent:
- Creating fake portfolio work (effort + risk of theft claims)
- Paying monthly (cost)
- Obtaining fraudulent resale certificate (actual crime with tax implications)

The economics don't pencil for fraudsters. The juice isn't worth the squeeze.

## Designer Tier Structure

| Tier | What It Is | Capabilities | Restrictions |
|------|------------|--------------|--------------|
| **Individual** | Consumer | Browse, save, build moodboards, hire designers | Cannot post projects, no trade access |
| **Designer Free** | Launch Prep | Productivity tools, AI editorial generation, internal tagging, private project workspace | Tags not visible publicly, cannot earn affiliate, projects not posted to feed |
| **Designer Pro** | Professional Practice | Public posting, visible tags, affiliate earnings, organization claiming, Folio Credit | Requires paid subscription |
| **Designer Pro + Trade** | Full Trade Access | Everything above + trade pricing access, Folio Credit at trade rates | Requires resale certificate on file |

### Designer Free: The Waiting Room

Designer Free is explicitly a staging area, not a functional tier. Designers can:
- Upload projects to their private workspace
- Use AI editorial generation tools
- Tag products (stored in their directory only)
- Add team members to their organization
- Learn the platform and perfect their presence

They cannot:
- Post projects to the public feed
- Have their product tags visible to vendors
- Earn affiliate revenue
- Access trade pricing

**Why this works:** A designer who uploads six projects, tags hundreds of products, and perfects their editorial posts has invested significant time. When Folio shows them their accumulated influence value and offers to flip the switch, conversion is a no-brainer.

### Designer Pro: The Professional Practice

Designer Pro unlocks public participation:
- Projects post to the feed
- Product tags create vendor attribution
- Affiliate revenue flows from tagged products
- Organization can be claimed and verified
- Folio Credit accumulates (redeemable at retail initially)

**Trade pricing requires additional verification** (see below).

## Trade Pricing and Resale Certificates

### Why Trade Access Is Gated Separately

Trade pricing exists because designers buy for resale to clients. This is a legal and tax distinction, not just a business preference. Vendors can offer trade pricing because:
- They're not collecting sales tax (the designer or client handles it at final sale)
- The buyer has legal accountability as a trade professional
- There's a paper trail for tax purposes

A resale certificate is:
- Free or cheap to obtain in most states
- Required for legitimate trade purchasing anyway
- A legal document with actual consequences for fraud
- Something every practicing designer already has or can easily get

### The Gate Structure

**Designer Pro (no resale cert):**
- Full platform access
- Affiliate revenue on consumer purchases
- Folio Credit accumulates and redeems at retail pricing

**Designer Pro + Trade Verified:**
- Resale certificate on file
- Access to vendor trade pricing programs
- Folio Credit redeems at trade pricing
- Full participation in trade discount arbitrage

### Protecting Designer Value

This structure protects the economic advantage that makes designer services valuable:

> "Trade pricing is reserved for verified professionals. When you hire a Folio designer, you're accessing pricing that isn't available to you directly."

Retail clients cannot game the system to get trade pricing because they would need to:
1. Create a designer profile with real work
2. Pay for Pro subscription
3. Obtain a resale certificate (requires business registration)
4. Actually operate as a trade buyer (or commit tax fraud)

The resale certificate is the choke point. It's not a Folio requirement—it's a legal document that exists precisely to distinguish trade buyers from retail buyers.

## Organization Structure

### Organization Types

Organizations represent professional identities under which design work is practiced:

| Type | Description | Verification |
|------|-------------|--------------|
| **Solo Practice** | Individual designer, may or may not be incorporated | Personal bank account, personal identity |
| **Design Firm** | Registered business with multiple people | Business bank account matching org name |
| **Vendor** | Product company | Business verification, product catalog |

### Solo Practice: The Democratic Option

A Solo Practice is a single designer operating under their own name. This serves:
- Designers doing side work while employed elsewhere
- Independents who haven't yet incorporated
- Professionals testing the waters before formalizing

Solo Practice designers:
- Can use their personal name or a DBA-style practice name ("Sarah Chen Design")
- Verify via personal bank account and identity (Stripe handles this)
- Receive 1099s for tax reporting
- Don't need business documentation

**This is not gatekeeping by wealth or connections. It's democratizing access while maintaining accountability.**

### Organization Claiming and Verification

**Creating an Organization:**
1. Search for existing organization
2. If not found, create with basic info
3. Organization exists in unverified state
4. Can add team members, build projects internally

**Monetization Triggers Verification:**
- Stripe Connect onboarding (handles bank account, identity, tax info)
- Bank account name match to organization name (automated fuzzy matching)
- Activity threshold: 2+ published projects, 14+ days on platform

**Why this works:** Squatters who grab a name and do nothing can't monetize. Legitimate users hit activity thresholds naturally before they're ready to monetize.

### Dispute Resolution

When someone claims "this is my company, someone else has it":

**Automated first pass:**
- Does the challenger have a verified bank account matching the name?
- Does the challenger control the domain email (can receive at name@company.com)?
- Does the current holder have any monetization enabled?

**Resolution ladder:**
1. If current holder isn't verified/monetized → 30-day notice, then transfer
2. If both claim verification → request incorporation docs from both, human review
3. If one has domain email + bank match and other doesn't → clear winner

**Domain email as accelerator:** Verifying you can receive email at yourname@companydomain.com combined with bank account match = instant approval.

## Vendor Verification

### The "You Were Tagged" Loop

Vendors discover their existing presence on Folio through attribution notifications:

> "Your products were tagged in 12 projects by 8 designers this month."

This is high-converting because:
- Designers are already using their products (Folio already tracked this)
- Intelligence exists before they join
- They're claiming attribution, not creating it from scratch

### Vendor Tier Structure

| Tier | Access | Requirements |
|------|--------|--------------|
| **Claimed** | View attribution data, basic analytics | Claim organization |
| **Verified** | Full analytics, messaging, product catalog | Business bank account match, Stripe verification |
| **Trade Partner** | Trade pricing programs, advanced analytics, API access | Additional partnership agreement |

### Vendor Verification Requirements

- Business bank account matching organization name
- Stripe Connect business verification
- Product catalog upload (with SKU data, pricing, specs)
- Domain email verification (optional accelerator)

## Fraud Prevention Summary

The system prevents fraud through layered structural barriers:

**For fake designers trying to access trade pricing:**
1. Must create portfolio of real work (whose work? risk of theft claims)
2. Must maintain activity thresholds (ongoing effort)
3. Must pay monthly subscription (cost)
4. Must obtain resale certificate (legal registration, tax liability)
5. Must have bank account for payouts (identity trail)

**For organization squatters:**
1. Can't monetize without activity thresholds
2. Can't verify without bank account match
3. Real owner can dispute with documentation
4. No value in holding empty container

**For retail clients gaming trade access:**
1. Would need fake portfolio
2. Would need to pay subscription
3. Would need business registration for resale cert
4. Would face tax fraud liability if misusing cert

Each gate serves a legitimate purpose. Collectively, they make fraud impractical without creating friction for legitimate users.

## Conversion Psychology

### The Traditional SaaS Problem

```
Sign up → Free trial (14 days) → Pay or lose access → Onboard → Hope they stay
```

Users pay before they've built anything. They're paying for potential. The moment friction hits, they question the spend. Churn is baked in.

### The Folio Model

```
Sign up → Build → See value accumulate → Pay to release it → Already retained
```

By payment time, the designer has:
- 6 polished projects ready to publish
- Hundreds of products tagged
- Calculated influence value visible
- Investment they don't want to abandon

**The cost of not subscribing becomes tangible.** They built something. It's theirs. It's just dormant.

### Folio as Launch Partner

During free tier, Folio acts as collaborator:
- "Your portfolio is coming together"
- "This project is strong—have you considered adding the detail shots?"
- "You've tagged 200+ products. Your fingerprint is emerging."

Then, when ready:
- "You have 6 publish-ready projects. Want to go live?"

That's not sales pressure. That's a partner saying "you're ready."

### Retention Front-Loading

Month one isn't setup—setup already happened. Month one is going public:
- Portfolio already polished
- Projects going live
- Engagement starting
- Value already evident

The fragile period (figuring things out, questioning value) happens before payment, when losing them costs nothing.

## Founding Designer Program

Founding designers receive Designer Pro + Trade access free of charge. This allows:
- Building the actual production experience they'll use long-term
- Testing the full monetization flow
- Providing feedback on the real system, not a limited preview
- Creating success stories before general availability

When the platform opens to paid subscriptions, founding designers:
- Retain free access (grandfather clause)
- Have established portfolios and engagement
- Serve as proof points for conversion messaging

## Metrics That Matter

Traditional SaaS optimizes for "free to paid in X days."

Folio optimizes for:
- **Projects prepped before conversion** (more = higher retention)
- **Time from ready-state to payment** (shorter = clearer value prop)
- **Post-conversion engagement** (should be immediate, not ramping)
- **Influence value at conversion** (higher = stronger lock-in)

A designer who takes 3 months to build 6 projects then converts is a better outcome than one who converts day one and churns month two.

## Implementation Notes

### Stripe Connect Integration

Stripe handles:
- Identity verification (ID upload, SSN for individuals)
- Business verification (EIN, business docs for firms)
- Bank account verification
- Tax reporting (1099 generation)
- Payout processing

Folio adds:
- Bank account name matching to organization name
- Activity threshold checks before enabling monetization
- Resale certificate storage and verification
- Trade pricing access controls

### Activity Thresholds

Before monetization is enabled:
- Minimum 2 published projects (Designer Pro)
- Minimum 14 days on platform
- At least one complete project with tagged products

These thresholds are low enough that legitimate users hit them naturally, high enough that squatters can't quickly flip accounts.

### Resale Certificate Verification

Initial implementation:
- User uploads certificate image/PDF
- Manual review for validity
- State-by-state format recognition (future: automated)
- Annual renewal reminder

Future enhancement:
- API integration with state databases where available
- Automated OCR and validation
- Expiration tracking and renewal prompts

## Conclusion

Folio's monetization system embodies the platform's core values:
- **Democratization**: Solo practitioners and established firms both have paths to professional status
- **Merit-based**: Verification comes from real work and legal accountability, not connections or capital
- **Trust**: Security through structure means legitimate users face no friction while fraud is impractical
- **Partnership**: Folio helps designers succeed, then shares in that success

The system converts users not through pressure but through demonstrated value. By the time designers pay, they're not buying a tool—they're launching a practice.

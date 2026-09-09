# Synthetic vendor records — future remediation proposal

Date: 2026-09-09. Status: **proposal only; no data changes authorized or performed**.

The current read-only audit found zero users matching the old creator's email pattern in the configured database. No matching historical repair is currently indicated there. The source fix prevents new synthetic users from that path.

If matching records are found in another environment or later investigation:

1. Inventory exact source markers together: email starts `vendor+` and ends `@folio.local`, role VENDOR, passwordHash `external`. Treat partial/changed markers as uncertain; a matching name alone is never sufficient.
2. Review each candidate's Product ownership, OrganizationUser membership, legacy Vendor.userId links, onboarding and available authentication/activity evidence. JWT sessions alone cannot establish absence of login. Export a restricted candidate manifest and dependency counts without publishing credentials or personal data.
3. Identify a proposed destination for every Product. Prefer preserving existing Product.brand and removing only the proven synthetic ownership link so the established unclaimed claim/review path can operate. Do not fuzzy-merge by manufacturer name or assign a real Organization based solely on text.
4. Quarantine any account with authenticated activity, memberships, changed credentials or other meaningful relations for manual review. Do not delete such accounts automatically.
5. Obtain explicit approval for the exact affected rows and repair plan, with a backup and rollback mapping. Apply small transactions using conditional writes that require the old synthetic vendorId to still match. Preserve Product IDs, tags, selections, quotes, provenance and historical attribution.
6. Verify product/tag counts, display attribution, claimability, organization ownership and core journeys. Only consider deleting an empty synthetic User after a separate dependency review and explicit authorization.

There is no bulk-delete or merge script in this change. Automated identification can assist a later review; automated identity reconciliation is not safe based on the existing naming convention alone.

# IDOR / Authorization-Gap Scan Report

_Generated: 2026-04-13T15:21:40.950Z_
_Scanned root: `src/app/api`_
_Files scanned: 523_

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 425 |
| Medium | 58 |
| Low | 40 |

### By rule

| Rule | Count |
|---|---|
| IDOR003 | 254 |
| IDOR004 | 167 |
| IDOR005 | 88 |
| IDOR006 | 10 |
| IDOR007 | 4 |

## High (425)

### `src/app/api/admin/impersonate/exit/route.ts`:48 — IDOR004 [POST]

Mutation prisma.impersonationLog.updateMany uses where: { id } with no ownership constraint.

```ts
{
        adminId: impersonationData.originalAdminId,
        targetUserId: impersonationData.targetUserId,
        endedAt: null,
      }
```

### `src/app/api/atelier/deployments/[deploymentId]/route.ts`:28 — IDOR003 [GET]

prisma.atelierDeployment.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: deploymentId }
```

### `src/app/api/atelier/deployments/[deploymentId]/route.ts`:100 — IDOR003 [GET]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: deployment.developmentId }
```

### `src/app/api/atelier/deployments/[deploymentId]/route.ts`:163 — IDOR003 [PATCH]

prisma.atelierDeployment.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: deploymentId }
```

### `src/app/api/atelier/deployments/[deploymentId]/route.ts`:184 — IDOR003 [PATCH]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: existingDeployment.developmentId }
```

### `src/app/api/atelier/deployments/[deploymentId]/route.ts`:231 — IDOR003 [PATCH]

prisma.atelierDeployment.update uses where: { id } with no ownership constraint.

```ts
{ id: deploymentId }
```

### `src/app/api/atelier/deployments/[deploymentId]/route.ts`:290 — IDOR003 [DELETE]

prisma.atelierDeployment.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: deploymentId }
```

### `src/app/api/atelier/deployments/[deploymentId]/route.ts`:321 — IDOR003 [DELETE]

prisma.atelierDeployment.update uses where: { id } with no ownership constraint.

```ts
{ id: deploymentId }
```

### `src/app/api/atelier/deployments/[deploymentId]/route.ts`:231 — IDOR004 [PATCH]

Mutation prisma.atelierDeployment.update uses where: { id } with no ownership constraint.

```ts
{ id: deploymentId }
```

### `src/app/api/atelier/deployments/[deploymentId]/route.ts`:321 — IDOR004 [DELETE]

Mutation prisma.atelierDeployment.update uses where: { id } with no ownership constraint.

```ts
{ id: deploymentId }
```

### `src/app/api/atelier/fingerprints/[fingerprintId]/route.ts`:37 — IDOR003 [GET]

prisma.atelierFingerprint.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: fingerprintId }
```

### `src/app/api/auth/me/orgs/[membershipId]/route.ts`:46 — IDOR003 [PATCH]

prisma.organizationUser.update uses where: { id } with no ownership constraint.

```ts
{ id: membershipId }
```

### `src/app/api/auth/me/orgs/[membershipId]/route.ts`:46 — IDOR004 [PATCH]

Mutation prisma.organizationUser.update uses where: { id } with no ownership constraint.

```ts
{ id: membershipId }
```

### `src/app/api/auth/rep-onboarding/complete/route.ts`:84 — IDOR004 [POST]

Mutation prisma.pendingRepInvite.update uses where: { id } with no ownership constraint.

```ts
{ id: inv.id }
```

### `src/app/api/buyer/auth/route.ts`:124 — IDOR004 [POST]

Mutation prisma.consultationBuyer.update uses where: { id } with no ownership constraint.

```ts
{ id: buyer.id }
```

### `src/app/api/buyer/auth/route.ts`:178 — IDOR004 [DELETE]

Mutation prisma.consultationBuyer.update uses where: { id } with no ownership constraint.

```ts
{ id: buyer.id }
```

### `src/app/api/buyer/register/route.ts`:43 — IDOR004 [POST]

Mutation prisma.consultationBuyer.update uses where: { id } with no ownership constraint.

```ts
{ id: buyer.id }
```

### `src/app/api/collaboration/stories/[id]/approve/route.ts`:40 — IDOR003 [POST]

prisma.collaborationStory.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/approve/route.ts`:75 — IDOR003 [POST]

prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/approve/route.ts`:130 — IDOR003 [POST]

prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/approve/route.ts`:211 — IDOR003 [GET]

prisma.collaborationStory.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/approve/route.ts`:75 — IDOR004 [POST]

Mutation prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/approve/route.ts`:130 — IDOR004 [POST]

Mutation prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/generate/route.ts`:49 — IDOR003 [POST]

prisma.collaborationStory.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/generate/route.ts`:77 — IDOR003 [POST]

prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/generate/route.ts`:124 — IDOR003 [POST]

prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/generate/route.ts`:157 — IDOR003 [POST]

prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/generate/route.ts`:77 — IDOR004 [POST]

Mutation prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/generate/route.ts`:124 — IDOR004 [POST]

Mutation prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/generate/route.ts`:157 — IDOR004 [POST]

Mutation prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/publish/route.ts`:33 — IDOR003 [POST]

prisma.collaborationStory.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/publish/route.ts`:86 — IDOR003 [POST]

prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/publish/route.ts`:154 — IDOR003 [DELETE]

prisma.collaborationStory.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/publish/route.ts`:171 — IDOR003 [DELETE]

prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/publish/route.ts`:86 — IDOR004 [POST]

Mutation prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/publish/route.ts`:171 — IDOR004 [DELETE]

Mutation prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/respond/route.ts`:28 — IDOR003 [POST]

prisma.collaborationStory.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/respond/route.ts`:66 — IDOR003 [POST]

prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/respond/route.ts`:98 — IDOR003 [POST]

prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/respond/route.ts`:66 — IDOR004 [POST]

Mutation prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/respond/route.ts`:98 — IDOR004 [POST]

Mutation prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/round/[round]/route.ts`:109 — IDOR003 [GET]

prisma.collaborationStory.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/round/[round]/route.ts`:247 — IDOR003 [POST]

prisma.collaborationStory.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/round/[round]/route.ts`:308 — IDOR003 [POST]

prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/round/[round]/route.ts`:308 — IDOR004 [POST]

Mutation prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/route.ts`:45 — IDOR003 [GET]

prisma.collaborationStory.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/route.ts`:111 — IDOR003 [PATCH]

prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/route.ts`:164 — IDOR003 [DELETE]

prisma.collaborationStory.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/route.ts`:189 — IDOR003 [DELETE]

prisma.collaborationStory.delete uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/route.ts`:111 — IDOR004 [PATCH]

Mutation prisma.collaborationStory.update uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/collaboration/stories/[id]/route.ts`:189 — IDOR004 [DELETE]

Mutation prisma.collaborationStory.delete uses where: { id } with no ownership constraint.

```ts
{ id: storyId }
```

### `src/app/api/consultations/[consultationId]/complete/route.ts`:23 — IDOR003 [POST]

prisma.consultation.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: consultationId }
```

### `src/app/api/consultations/[consultationId]/complete/route.ts`:91 — IDOR003 [POST]

prisma.consultation.update uses where: { id } with no ownership constraint.

```ts
{ id: consultationId }
```

### `src/app/api/consultations/[consultationId]/complete/route.ts`:91 — IDOR004 [POST]

Mutation prisma.consultation.update uses where: { id } with no ownership constraint.

```ts
{ id: consultationId }
```

### `src/app/api/consultations/route.ts`:136 — IDOR004 [POST]

Mutation prisma.consultationBuyer.update uses where: { id } with no ownership constraint.

```ts
{ id: buyer.id }
```

### `src/app/api/contacts/import/route.ts`:114 — IDOR004 [POST]

Mutation prisma.contactImportJob.update uses where: { id } with no ownership constraint.

```ts
{ id: job.id }
```

### `src/app/api/contacts/route.ts`:104 — IDOR004 [POST]

Mutation prisma.contactImportJob.update uses where: { id } with no ownership constraint.

```ts
{ id: firstContact.importSourceId }
```

### `src/app/api/debug/project/[id]/route.ts`:24 — IDOR003 [GET]

prisma.project.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/debug/project/[id]/route.ts`:30 — IDOR003 [GET]

prisma.project.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/designer/folders/[id]/assign-sections/route.ts`:46 — IDOR003 [POST]

prisma.folderProduct.findFirst uses where: { id } with no ownership constraint.

```ts
{
          id: itemId,
          folderId: folderId,
        }
```

### `src/app/api/designer/folders/[id]/route.ts`:80 — IDOR003 [DELETE]

prisma.folder.delete uses where: { id } with no ownership constraint.

```ts
{ id: folderId }
```

### `src/app/api/designer/folders/[id]/route.ts`:80 — IDOR004 [DELETE]

Mutation prisma.folder.delete uses where: { id } with no ownership constraint.

```ts
{ id: folderId }
```

### `src/app/api/designer/qa/answer/route.ts`:48 — IDOR004 [POST]

Mutation prisma.profileQA.update uses where: { id } with no ownership constraint.

```ts
{ id: questionId }
```

### `src/app/api/designer/qa/hide/route.ts`:39 — IDOR004 [POST]

Mutation prisma.profileQA.update uses where: { id } with no ownership constraint.

```ts
{ id: parsed.data.questionId }
```

### `src/app/api/designer/qa/pin/route.ts`:39 — IDOR004 [POST]

Mutation prisma.profileQA.update uses where: { id } with no ownership constraint.

```ts
{ id: parsed.data.questionId }
```

### `src/app/api/designer/qa/skip/route.ts`:38 — IDOR004 [POST]

Mutation prisma.profileQA.update uses where: { id } with no ownership constraint.

```ts
{ id: parsed.data.questionId }
```

### `src/app/api/designer/shop/boosts/[boostId]/route.ts`:30 — IDOR003 [PATCH]

prisma.shopBoost.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: boostId }
```

### `src/app/api/designer/shop/boosts/[boostId]/route.ts`:59 — IDOR003 [PATCH]

prisma.shopBoost.update uses where: { id } with no ownership constraint.

```ts
{ id: boostId }
```

### `src/app/api/designer/shop/boosts/[boostId]/route.ts`:89 — IDOR003 [PATCH]

prisma.shopBoost.update uses where: { id } with no ownership constraint.

```ts
{ id: boostId }
```

### `src/app/api/designer/shop/boosts/[boostId]/route.ts`:59 — IDOR004 [PATCH]

Mutation prisma.shopBoost.update uses where: { id } with no ownership constraint.

```ts
{ id: boostId }
```

### `src/app/api/designer/shop/boosts/[boostId]/route.ts`:89 — IDOR004 [PATCH]

Mutation prisma.shopBoost.update uses where: { id } with no ownership constraint.

```ts
{ id: boostId }
```

### `src/app/api/designer/shop/products/[productId]/route.ts`:31 — IDOR003 [PATCH]

prisma.shopProduct.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: shopProductId }
```

### `src/app/api/designer/shop/products/[productId]/route.ts`:65 — IDOR003 [PATCH]

prisma.shopProduct.update uses where: { id } with no ownership constraint.

```ts
{ id: shopProductId }
```

### `src/app/api/designer/shop/products/[productId]/route.ts`:110 — IDOR003 [DELETE]

prisma.shopProduct.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: shopProductId }
```

### `src/app/api/designer/shop/products/[productId]/route.ts`:124 — IDOR003 [DELETE]

prisma.shopProduct.update uses where: { id } with no ownership constraint.

```ts
{ id: shopProductId }
```

### `src/app/api/designer/shop/products/[productId]/route.ts`:65 — IDOR004 [PATCH]

Mutation prisma.shopProduct.update uses where: { id } with no ownership constraint.

```ts
{ id: shopProductId }
```

### `src/app/api/designer/shop/products/[productId]/route.ts`:124 — IDOR004 [DELETE]

Mutation prisma.shopProduct.update uses where: { id } with no ownership constraint.

```ts
{ id: shopProductId }
```

### `src/app/api/developments/[developmentId]/designers/[designerId]/route.ts`:69 — IDOR003 [PATCH]

prisma.developmentDesigner.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/developments/[developmentId]/designers/[designerId]/route.ts`:152 — IDOR003 [DELETE]

prisma.developmentDesigner.delete uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/developments/[developmentId]/designers/[designerId]/route.ts`:160 — IDOR003 [DELETE]

prisma.developmentDesigner.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/developments/[developmentId]/designers/[designerId]/route.ts`:69 — IDOR004 [PATCH]

Mutation prisma.developmentDesigner.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/developments/[developmentId]/designers/[designerId]/route.ts`:152 — IDOR004 [DELETE]

Mutation prisma.developmentDesigner.delete uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/developments/[developmentId]/designers/[designerId]/route.ts`:160 — IDOR004 [DELETE]

Mutation prisma.developmentDesigner.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/developments/[developmentId]/designers/route.ts`:27 — IDOR003 [POST]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/designers/route.ts`:85 — IDOR003 [POST]

prisma.developmentDesigner.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/developments/[developmentId]/designers/route.ts`:163 — IDOR003 [GET]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/designers/route.ts`:85 — IDOR004 [POST]

Mutation prisma.developmentDesigner.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/developments/[developmentId]/finish-packages/[packageId]/route.ts`:24 — IDOR003 [PATCH]

prisma.finishPackage.findFirst uses where: { id } with no ownership constraint.

```ts
{ id: packageId, developmentId }
```

### `src/app/api/developments/[developmentId]/finish-packages/[packageId]/route.ts`:71 — IDOR003 [PATCH]

prisma.finishPackage.update uses where: { id } with no ownership constraint.

```ts
{ id: packageId }
```

### `src/app/api/developments/[developmentId]/finish-packages/[packageId]/route.ts`:117 — IDOR003 [DELETE]

prisma.finishPackage.findFirst uses where: { id } with no ownership constraint.

```ts
{ id: packageId, developmentId }
```

### `src/app/api/developments/[developmentId]/finish-packages/[packageId]/route.ts`:149 — IDOR003 [DELETE]

prisma.finishPackage.delete uses where: { id } with no ownership constraint.

```ts
{ id: packageId }
```

### `src/app/api/developments/[developmentId]/finish-packages/[packageId]/route.ts`:55 — IDOR004 [PATCH]

Mutation prisma.finishPackageDefault.deleteMany uses where: { id } with no ownership constraint.

```ts
{ finishPackageId: packageId }
```

### `src/app/api/developments/[developmentId]/finish-packages/[packageId]/route.ts`:71 — IDOR004 [PATCH]

Mutation prisma.finishPackage.update uses where: { id } with no ownership constraint.

```ts
{ id: packageId }
```

### `src/app/api/developments/[developmentId]/finish-packages/[packageId]/route.ts`:149 — IDOR004 [DELETE]

Mutation prisma.finishPackage.delete uses where: { id } with no ownership constraint.

```ts
{ id: packageId }
```

### `src/app/api/developments/[developmentId]/finish-packages/route.ts`:28 — IDOR003 [POST]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/finish-packages/route.ts`:147 — IDOR003 [GET]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/products/[productId]/route.ts`:28 — IDOR003 [PATCH]

prisma.developmentProduct.findUnique uses where: { id } with no ownership constraint.

```ts
{
        developmentId_productId: {
          developmentId,
          productId,
        },
      }
```

### `src/app/api/developments/[developmentId]/products/[productId]/route.ts`:87 — IDOR003 [PATCH]

prisma.developmentProduct.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/developments/[developmentId]/products/[productId]/route.ts`:131 — IDOR003 [DELETE]

prisma.developmentProduct.findUnique uses where: { id } with no ownership constraint.

```ts
{
        developmentId_productId: {
          developmentId,
          productId,
        },
      }
```

### `src/app/api/developments/[developmentId]/products/[productId]/route.ts`:181 — IDOR003 [DELETE]

prisma.developmentProduct.delete uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/developments/[developmentId]/products/[productId]/route.ts`:87 — IDOR004 [PATCH]

Mutation prisma.developmentProduct.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/developments/[developmentId]/products/[productId]/route.ts`:181 — IDOR004 [DELETE]

Mutation prisma.developmentProduct.delete uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/developments/[developmentId]/products/route.ts`:28 — IDOR003 [POST]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/products/route.ts`:63 — IDOR003 [POST]

prisma.product.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: productId }
```

### `src/app/api/developments/[developmentId]/products/route.ts`:72 — IDOR003 [POST]

prisma.developmentProduct.findUnique uses where: { id } with no ownership constraint.

```ts
{
        developmentId_productId: {
          developmentId,
          productId,
        },
      }
```

### `src/app/api/developments/[developmentId]/products/route.ts`:153 — IDOR003 [GET]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/route.ts`:22 — IDOR003 [GET]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/route.ts`:172 — IDOR003 [PATCH]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/route.ts`:241 — IDOR003 [PATCH]

prisma.development.update uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/route.ts`:289 — IDOR003 [DELETE]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/route.ts`:331 — IDOR003 [DELETE]

prisma.development.delete uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/route.ts`:339 — IDOR003 [DELETE]

prisma.development.update uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/route.ts`:241 — IDOR004 [PATCH]

Mutation prisma.development.update uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/route.ts`:331 — IDOR004 [DELETE]

Mutation prisma.development.delete uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/route.ts`:339 — IDOR004 [DELETE]

Mutation prisma.development.update uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/unit-types/[unitTypeId]/route.ts`:23 — IDOR003 [GET]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/developments/[developmentId]/unit-types/[unitTypeId]/route.ts`:44 — IDOR003 [GET]

prisma.unitType.findFirst uses where: { id } with no ownership constraint.

```ts
{
        id: unitTypeId,
        developmentId,
      }
```

### `src/app/api/developments/[developmentId]/unit-types/[unitTypeId]/route.ts`:100 — IDOR003 [PATCH]

prisma.unitType.findFirst uses where: { id } with no ownership constraint.

```ts
{ id: unitTypeId, developmentId }
```

### `src/app/api/developments/[developmentId]/unit-types/[unitTypeId]/route.ts`:149 — IDOR003 [PATCH]

prisma.unitType.update uses where: { id } with no ownership constraint.

```ts
{ id: unitTypeId }
```

### `src/app/api/developments/[developmentId]/unit-types/[unitTypeId]/route.ts`:186 — IDOR003 [DELETE]

prisma.unitType.findFirst uses where: { id } with no ownership constraint.

```ts
{ id: unitTypeId, developmentId }
```

### `src/app/api/developments/[developmentId]/unit-types/[unitTypeId]/route.ts`:221 — IDOR003 [DELETE]

prisma.unitType.delete uses where: { id } with no ownership constraint.

```ts
{ id: unitTypeId }
```

### `src/app/api/developments/[developmentId]/unit-types/[unitTypeId]/route.ts`:149 — IDOR004 [PATCH]

Mutation prisma.unitType.update uses where: { id } with no ownership constraint.

```ts
{ id: unitTypeId }
```

### `src/app/api/developments/[developmentId]/unit-types/[unitTypeId]/route.ts`:221 — IDOR004 [DELETE]

Mutation prisma.unitType.delete uses where: { id } with no ownership constraint.

```ts
{ id: unitTypeId }
```

### `src/app/api/developments/[developmentId]/unit-types/route.ts`:149 — IDOR003 [GET]

prisma.development.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: developmentId }
```

### `src/app/api/email/inbound/route.ts`:68 — IDOR004 [POST]

Mutation prisma.emailThread.update uses where: { id } with no ownership constraint.

```ts
{ id: match.threadId }
```

### `src/app/api/email/inbound/route.ts`:81 — IDOR004 [POST]

Mutation prisma.conversation.update uses where: { id } with no ownership constraint.

```ts
{ id: match.conversationId }
```

### `src/app/api/email/inbound/route.ts`:124 — IDOR004 [POST]

Mutation prisma.repShadowProfile.update uses where: { id } with no ownership constraint.

```ts
{ id: repShadow.id }
```

### `src/app/api/email/threads/[threadId]/reply/route.ts`:34 — IDOR003 [POST]

prisma.emailThread.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: threadId }
```

### `src/app/api/email/threads/[threadId]/reply/route.ts`:125 — IDOR003 [POST]

prisma.emailThread.update uses where: { id } with no ownership constraint.

```ts
{ id: threadId }
```

### `src/app/api/email/threads/[threadId]/reply/route.ts`:132 — IDOR003 [POST]

prisma.conversation.update uses where: { id } with no ownership constraint.

```ts
{ id: thread.conversationId }
```

### `src/app/api/email/threads/[threadId]/reply/route.ts`:125 — IDOR004 [POST]

Mutation prisma.emailThread.update uses where: { id } with no ownership constraint.

```ts
{ id: threadId }
```

### `src/app/api/email/threads/[threadId]/reply/route.ts`:132 — IDOR004 [POST]

Mutation prisma.conversation.update uses where: { id } with no ownership constraint.

```ts
{ id: thread.conversationId }
```

### `src/app/api/events/[id]/ai/analytics/route.ts`:20 — IDOR003 [GET]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/ai/optimize-guest-list/route.ts`:23 — IDOR003 [POST]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/ai/recommendations/route.ts`:23 — IDOR003 [GET]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/audience/lifecycle-scores/route.ts`:25 — IDOR003 [GET]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/audience/match-scores/route.ts`:26 — IDOR003 [GET]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/audience/premium/route.ts`:24 — IDOR003 [GET]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/check-in/manual/route.ts`:67 — IDOR003 [POST]

prisma.eventRSVP.update uses where: { id } with no ownership constraint.

```ts
{ id: rsvp.id }
```

### `src/app/api/events/[id]/check-in/manual/route.ts`:67 — IDOR004 [POST]

Mutation prisma.eventRSVP.update uses where: { id } with no ownership constraint.

```ts
{ id: rsvp.id }
```

### `src/app/api/events/[id]/check-in/scan/route.ts`:79 — IDOR003 [POST]

prisma.eventRSVP.update uses where: { id } with no ownership constraint.

```ts
{ id: rsvp.id }
```

### `src/app/api/events/[id]/check-in/scan/route.ts`:79 — IDOR004 [POST]

Mutation prisma.eventRSVP.update uses where: { id } with no ownership constraint.

```ts
{ id: rsvp.id }
```

### `src/app/api/events/[id]/graph/route.ts`:20 — IDOR003 [GET]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/graph/route.ts`:118 — IDOR003 [GET]

prisma.eventEngagementMetrics.findUnique uses where: { id } with no ownership constraint.

```ts
{ eventId: params.id }
```

### `src/app/api/events/[id]/graph/route.ts`:237 — IDOR003 [POST]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/graph/route.ts`:258 — IDOR003 [POST]

prisma.eventDesignerEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/events/[id]/graph/route.ts`:277 — IDOR003 [POST]

prisma.eventVendorEdge.findFirst uses where: { id } with no ownership constraint.

```ts
{
          eventId: params.id,
          vendorId: targetId,
        }
```

### `src/app/api/events/[id]/graph/route.ts`:285 — IDOR003 [POST]

prisma.eventVendorEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/events/[id]/graph/route.ts`:303 — IDOR003 [POST]

prisma.eventProductEdge.findFirst uses where: { id } with no ownership constraint.

```ts
{
          eventId: params.id,
          productId: targetId,
        }
```

### `src/app/api/events/[id]/graph/route.ts`:311 — IDOR003 [POST]

prisma.eventProductEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/events/[id]/graph/route.ts`:329 — IDOR003 [POST]

prisma.eventRepEdge.findFirst uses where: { id } with no ownership constraint.

```ts
{
          eventId: params.id,
          repId: targetId,
        }
```

### `src/app/api/events/[id]/graph/route.ts`:337 — IDOR003 [POST]

prisma.eventRepEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/events/[id]/graph/route.ts`:258 — IDOR004 [POST]

Mutation prisma.eventDesignerEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/events/[id]/graph/route.ts`:285 — IDOR004 [POST]

Mutation prisma.eventVendorEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/events/[id]/graph/route.ts`:311 — IDOR004 [POST]

Mutation prisma.eventProductEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/events/[id]/graph/route.ts`:337 — IDOR004 [POST]

Mutation prisma.eventRepEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/events/[id]/invites/lists/route.ts`:147 — IDOR003 [PUT]

prisma.eventInviteList.findFirst uses where: { id } with no ownership constraint.

```ts
{
        id: params.listId,
        hostProfileId: hostProfile.id,
      }
```

### `src/app/api/events/[id]/invites/lists/route.ts`:159 — IDOR003 [PUT]

prisma.eventInviteList.update uses where: { id } with no ownership constraint.

```ts
{ id: params.listId }
```

### `src/app/api/events/[id]/invites/lists/route.ts`:159 — IDOR004 [PUT]

Mutation prisma.eventInviteList.update uses where: { id } with no ownership constraint.

```ts
{ id: params.listId }
```

### `src/app/api/events/[id]/invites/route.ts`:19 — IDOR003 [GET]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/invites/route.ts`:112 — IDOR003 [POST]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/invites/route.ts`:122 — IDOR003 [POST]

prisma.event.update uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/invites/route.ts`:152 — IDOR003 [POST]

prisma.eventContact.update uses where: { id } with no ownership constraint.

```ts
{ id: existingContact.id }
```

### `src/app/api/events/[id]/invites/route.ts`:192 — IDOR003 [POST]

prisma.eventRelationshipEdge.findFirst uses where: { id } with no ownership constraint.

```ts
{
                hostProfileId: hostProfile.id,
                sourceType: 'host',
                sourceId: hostProfile.id,
                targetType: 'designer',
                targetId: existin
```

### `src/app/api/events/[id]/invites/route.ts`:205 — IDOR003 [POST]

prisma.eventRelationshipEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: existingEdge.id }
```

### `src/app/api/events/[id]/invites/route.ts`:237 — IDOR003 [POST]

prisma.eventHostProfile.update uses where: { id } with no ownership constraint.

```ts
{ id: hostProfile.id }
```

### `src/app/api/events/[id]/invites/route.ts`:122 — IDOR004 [POST]

Mutation prisma.event.update uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/invites/route.ts`:152 — IDOR004 [POST]

Mutation prisma.eventContact.update uses where: { id } with no ownership constraint.

```ts
{ id: existingContact.id }
```

### `src/app/api/events/[id]/invites/route.ts`:205 — IDOR004 [POST]

Mutation prisma.eventRelationshipEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: existingEdge.id }
```

### `src/app/api/events/[id]/invites/route.ts`:237 — IDOR004 [POST]

Mutation prisma.eventHostProfile.update uses where: { id } with no ownership constraint.

```ts
{ id: hostProfile.id }
```

### `src/app/api/events/[id]/invites/upload/route.ts`:59 — IDOR003 [POST]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/invites/upload/route.ts`:150 — IDOR003 [POST]

prisma.eventContact.update uses where: { id } with no ownership constraint.

```ts
{ id: existingContact.id }
```

### `src/app/api/events/[id]/invites/upload/route.ts`:189 — IDOR003 [POST]

prisma.eventRelationshipEdge.findFirst uses where: { id } with no ownership constraint.

```ts
{
              hostProfileId: hostProfile.id,
              sourceType: 'host',
              sourceId: hostProfile.id,
              targetType: 'designer',
              targetId: existingUser.id,

```

### `src/app/api/events/[id]/invites/upload/route.ts`:202 — IDOR003 [POST]

prisma.eventRelationshipEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: existingEdge.id }
```

### `src/app/api/events/[id]/invites/upload/route.ts`:233 — IDOR003 [POST]

prisma.eventHostProfile.update uses where: { id } with no ownership constraint.

```ts
{ id: hostProfile.id }
```

### `src/app/api/events/[id]/invites/upload/route.ts`:150 — IDOR004 [POST]

Mutation prisma.eventContact.update uses where: { id } with no ownership constraint.

```ts
{ id: existingContact.id }
```

### `src/app/api/events/[id]/invites/upload/route.ts`:202 — IDOR004 [POST]

Mutation prisma.eventRelationshipEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: existingEdge.id }
```

### `src/app/api/events/[id]/invites/upload/route.ts`:233 — IDOR004 [POST]

Mutation prisma.eventHostProfile.update uses where: { id } with no ownership constraint.

```ts
{ id: hostProfile.id }
```

### `src/app/api/events/[id]/my-collection/export/route.ts`:22 — IDOR003 [GET]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: eventId }
```

### `src/app/api/events/[id]/route.ts`:116 — IDOR007 [PATCH]

where clause consumes params.* but session.user.id was not read before the query.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/rsvp/route.ts`:42 — IDOR003 [PATCH]

prisma.eventRSVP.update uses where: { id } with no ownership constraint.

```ts
{ id: rsvp.id }
```

### `src/app/api/events/[id]/rsvp/route.ts`:42 — IDOR004 [PATCH]

Mutation prisma.eventRSVP.update uses where: { id } with no ownership constraint.

```ts
{ id: rsvp.id }
```

### `src/app/api/events/[id]/scan/route.ts`:40 — IDOR003 [POST]

prisma.product.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: productId }
```

### `src/app/api/events/[id]/workflow/follow/route.ts`:23 — IDOR003 [POST]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/workflow/follow/route.ts`:106 — IDOR003 [POST]

prisma.eventRelationshipEdge.findFirst uses where: { id } with no ownership constraint.

```ts
{
              hostProfileId: event.hostProfileId,
              sourceType: 'host',
              sourceId: event.hostProfileId,
              targetType: 'vendor',
              targetId: edge.vend
```

### `src/app/api/events/[id]/workflow/follow/route.ts`:137 — IDOR003 [POST]

prisma.eventWorkflowJob.update uses where: { id } with no ownership constraint.

```ts
{ id: job.id }
```

### `src/app/api/events/[id]/workflow/follow/route.ts`:137 — IDOR004 [POST]

Mutation prisma.eventWorkflowJob.update uses where: { id } with no ownership constraint.

```ts
{ id: job.id }
```

### `src/app/api/events/[id]/workflow/followups/route.ts`:20 — IDOR003 [POST]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/workflow/followups/route.ts`:93 — IDOR003 [POST]

prisma.eventWorkflowJob.update uses where: { id } with no ownership constraint.

```ts
{ id: job.id }
```

### `src/app/api/events/[id]/workflow/followups/route.ts`:93 — IDOR004 [POST]

Mutation prisma.eventWorkflowJob.update uses where: { id } with no ownership constraint.

```ts
{ id: job.id }
```

### `src/app/api/events/[id]/workflow/recap/route.ts`:44 — IDOR003 [POST]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: eventId }
```

### `src/app/api/events/[id]/workflow/recap/route.ts`:146 — IDOR003 [POST]

prisma.eventWorkflowJob.update uses where: { id } with no ownership constraint.

```ts
{ id: job.id }
```

### `src/app/api/events/[id]/workflow/recap/route.ts`:146 — IDOR004 [POST]

Mutation prisma.eventWorkflowJob.update uses where: { id } with no ownership constraint.

```ts
{ id: job.id }
```

### `src/app/api/events/[id]/workflow/roi/route.ts`:23 — IDOR003 [POST]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/events/[id]/workflow/roi/route.ts`:50 — IDOR003 [POST]

prisma.eventVendorEdge.findFirst uses where: { id } with no ownership constraint.

```ts
{
        eventId: params.id,
        vendorId: vendorId,
      }
```

### `src/app/api/events/[id]/workflow/roi/route.ts`:58 — IDOR003 [POST]

prisma.eventVendorEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: vendorEdge.id }
```

### `src/app/api/events/[id]/workflow/roi/route.ts`:79 — IDOR003 [POST]

prisma.eventEngagementMetrics.findUnique uses where: { id } with no ownership constraint.

```ts
{ eventId: params.id }
```

### `src/app/api/events/[id]/workflow/roi/route.ts`:84 — IDOR003 [POST]

prisma.eventEngagementMetrics.update uses where: { id } with no ownership constraint.

```ts
{ eventId: params.id }
```

### `src/app/api/events/[id]/workflow/roi/route.ts`:93 — IDOR003 [POST]

prisma.eventWorkflowJob.update uses where: { id } with no ownership constraint.

```ts
{ id: job.id }
```

### `src/app/api/events/[id]/workflow/roi/route.ts`:58 — IDOR004 [POST]

Mutation prisma.eventVendorEdge.update uses where: { id } with no ownership constraint.

```ts
{ id: vendorEdge.id }
```

### `src/app/api/events/[id]/workflow/roi/route.ts`:84 — IDOR004 [POST]

Mutation prisma.eventEngagementMetrics.update uses where: { id } with no ownership constraint.

```ts
{ eventId: params.id }
```

### `src/app/api/events/[id]/workflow/roi/route.ts`:93 — IDOR004 [POST]

Mutation prisma.eventWorkflowJob.update uses where: { id } with no ownership constraint.

```ts
{ id: job.id }
```

### `src/app/api/events/[id]/workflow/vendor-dashboard/route.ts`:31 — IDOR003 [POST]

prisma.event.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: eventId }
```

### `src/app/api/events/[id]/workflow/vendor-dashboard/route.ts`:90 — IDOR003 [POST]

prisma.eventWorkflowJob.update uses where: { id } with no ownership constraint.

```ts
{ id: job.id }
```

### `src/app/api/events/[id]/workflow/vendor-dashboard/route.ts`:90 — IDOR004 [POST]

Mutation prisma.eventWorkflowJob.update uses where: { id } with no ownership constraint.

```ts
{ id: job.id }
```

### `src/app/api/extractions/[extractionId]/complete-item/route.ts`:102 — IDOR003 [POST]

prisma.pdfExtraction.update uses where: { id } with no ownership constraint.

```ts
{ id: extractionId }
```

### `src/app/api/extractions/[extractionId]/complete-item/route.ts`:211 — IDOR003 [PATCH]

prisma.pdfExtraction.update uses where: { id } with no ownership constraint.

```ts
{ id: extractionId }
```

### `src/app/api/extractions/[extractionId]/complete-item/route.ts`:102 — IDOR004 [POST]

Mutation prisma.pdfExtraction.update uses where: { id } with no ownership constraint.

```ts
{ id: extractionId }
```

### `src/app/api/extractions/[extractionId]/complete-item/route.ts`:211 — IDOR004 [PATCH]

Mutation prisma.pdfExtraction.update uses where: { id } with no ownership constraint.

```ts
{ id: extractionId }
```

### `src/app/api/extractions/[extractionId]/confirm/route.ts`:85 — IDOR003 [POST]

prisma.room.findFirst uses where: { id } with no ownership constraint.

```ts
{
        id: roomId,
        projectId: extraction.projectId
      }
```

### `src/app/api/extractions/[extractionId]/confirm/route.ts`:137 — IDOR003 [POST]

prisma.pdfExtraction.update uses where: { id } with no ownership constraint.

```ts
{ id: extractionId }
```

### `src/app/api/extractions/[extractionId]/confirm/route.ts`:137 — IDOR004 [POST]

Mutation prisma.pdfExtraction.update uses where: { id } with no ownership constraint.

```ts
{ id: extractionId }
```

### `src/app/api/import/[sessionId]/analyze/route.ts`:59 — IDOR003 [POST]

prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/analyze/route.ts`:93 — IDOR003 [POST]

prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/analyze/route.ts`:143 — IDOR003 [POST]

prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/analyze/route.ts`:59 — IDOR004 [POST]

Mutation prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/analyze/route.ts`:93 — IDOR004 [POST]

Mutation prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/analyze/route.ts`:143 — IDOR004 [POST]

Mutation prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/batch-verify/route.ts`:196 — IDOR003 [POST]

prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/batch-verify/route.ts`:196 — IDOR004 [POST]

Mutation prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/finalize/route.ts`:88 — IDOR003 [POST]

prisma.pendingProductTag.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: product.pendingTagId }
```

### `src/app/api/import/[sessionId]/finalize/route.ts`:184 — IDOR003 [POST]

prisma.pendingProductTag.update uses where: { id } with no ownership constraint.

```ts
{ id: pendingTag.id }
```

### `src/app/api/import/[sessionId]/finalize/route.ts`:195 — IDOR003 [POST]

prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/finalize/route.ts`:184 — IDOR004 [POST]

Mutation prisma.pendingProductTag.update uses where: { id } with no ownership constraint.

```ts
{ id: pendingTag.id }
```

### `src/app/api/import/[sessionId]/finalize/route.ts`:195 — IDOR004 [POST]

Mutation prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/route.ts`:94 — IDOR003 [DELETE]

prisma.importSession.delete uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/route.ts`:169 — IDOR003 [PATCH]

prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/route.ts`:94 — IDOR004 [DELETE]

Mutation prisma.importSession.delete uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/[sessionId]/route.ts`:169 — IDOR004 [PATCH]

Mutation prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/finish-schedule/route.ts`:102 — IDOR004 [POST]

Mutation prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: importSession.id }
```

### `src/app/api/import/pending-tag/[tagId]/verify/route.ts`:39 — IDOR003 [POST]

prisma.pendingProductTag.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: tagId }
```

### `src/app/api/import/pending-tag/[tagId]/verify/route.ts`:63 — IDOR003 [POST]

prisma.pendingProductTag.update uses where: { id } with no ownership constraint.

```ts
{ id: tagId }
```

### `src/app/api/import/pending-tag/[tagId]/verify/route.ts`:119 — IDOR003 [POST]

prisma.product.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: productId }
```

### `src/app/api/import/pending-tag/[tagId]/verify/route.ts`:146 — IDOR003 [POST]

prisma.pendingProductTag.update uses where: { id } with no ownership constraint.

```ts
{ id: tagId }
```

### `src/app/api/import/pending-tag/[tagId]/verify/route.ts`:158 — IDOR003 [POST]

prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: pendingTag.importSessionId }
```

### `src/app/api/import/pending-tag/[tagId]/verify/route.ts`:198 — IDOR003 [GET]

prisma.pendingProductTag.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: tagId }
```

### `src/app/api/import/pending-tag/[tagId]/verify/route.ts`:63 — IDOR004 [POST]

Mutation prisma.pendingProductTag.update uses where: { id } with no ownership constraint.

```ts
{ id: tagId }
```

### `src/app/api/import/pending-tag/[tagId]/verify/route.ts`:146 — IDOR004 [POST]

Mutation prisma.pendingProductTag.update uses where: { id } with no ownership constraint.

```ts
{ id: tagId }
```

### `src/app/api/import/pending-tag/[tagId]/verify/route.ts`:158 — IDOR004 [POST]

Mutation prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: pendingTag.importSessionId }
```

### `src/app/api/import/presentation/route.ts`:181 — IDOR004 [POST]

Mutation prisma.importSession.update uses where: { id } with no ownership constraint.

```ts
{ id: sessionId }
```

### `src/app/api/import/product/route.ts`:199 — IDOR004 [POST]

Mutation prisma.cachedProduct.update uses where: { id } with no ownership constraint.

```ts
{ id: cachedProduct.id }
```

### `src/app/api/interviews/[id]/approve-highlights/route.ts`:25 — IDOR003 [POST]

prisma.interviewSession.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/approve-highlights/route.ts`:79 — IDOR003 [POST]

prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/approve-highlights/route.ts`:49 — IDOR004 [POST]

Mutation prisma.quoteHighlight.updateMany uses where: { id } with no ownership constraint.

```ts
{
        id: { in: parsed.highlightIds },
        interviewSessionId: interviewId,
      }
```

### `src/app/api/interviews/[id]/approve-highlights/route.ts`:62 — IDOR004 [POST]

Mutation prisma.quoteHighlight.deleteMany uses where: { id } with no ownership constraint.

```ts
{
          id: { in: parsed.rejectIds },
          interviewSessionId: interviewId,
        }
```

### `src/app/api/interviews/[id]/approve-highlights/route.ts`:79 — IDOR004 [POST]

Mutation prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/confirm-upload/route.ts`:30 — IDOR003 [POST]

prisma.interviewSession.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/confirm-upload/route.ts`:65 — IDOR003 [POST]

prisma.mediaAsset.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewSession.recordingAssetId }
```

### `src/app/api/interviews/[id]/confirm-upload/route.ts`:94 — IDOR003 [POST]

prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/confirm-upload/route.ts`:65 — IDOR004 [POST]

Mutation prisma.mediaAsset.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewSession.recordingAssetId }
```

### `src/app/api/interviews/[id]/confirm-upload/route.ts`:94 — IDOR004 [POST]

Mutation prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:23 — IDOR003 [POST]

prisma.interviewSession.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:87 — IDOR003 [POST]

prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:145 — IDOR003 [POST]

prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:154 — IDOR003 [POST]

prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:168 — IDOR003 [POST]

prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:303 — IDOR003 [POST]

prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:322 — IDOR003 [POST]

prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:87 — IDOR004 [POST]

Mutation prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:145 — IDOR004 [POST]

Mutation prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:154 — IDOR004 [POST]

Mutation prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:168 — IDOR004 [POST]

Mutation prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:303 — IDOR004 [POST]

Mutation prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/process/route.ts`:322 — IDOR004 [POST]

Mutation prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/publish/route.ts`:19 — IDOR003 [POST]

prisma.interviewSession.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/publish/route.ts`:54 — IDOR003 [POST]

prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/publish/route.ts`:68 — IDOR003 [POST]

prisma.interviewSession.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/publish/route.ts`:74 — IDOR003 [POST]

prisma.vendorBoostRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewWithRequest.vendorBoostRequestId }
```

### `src/app/api/interviews/[id]/publish/route.ts`:54 — IDOR004 [POST]

Mutation prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/publish/route.ts`:74 — IDOR004 [POST]

Mutation prisma.vendorBoostRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewWithRequest.vendorBoostRequestId }
```

### `src/app/api/interviews/[id]/status/route.ts`:19 — IDOR003 [GET]

prisma.interviewSession.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/upload-url/route.ts`:29 — IDOR003 [POST]

prisma.interviewSession.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/upload/route.ts`:22 — IDOR003 [POST]

prisma.interviewSession.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/upload/route.ts`:87 — IDOR003 [POST]

prisma.mediaAsset.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewSession.recordingAssetId }
```

### `src/app/api/interviews/[id]/upload/route.ts`:108 — IDOR003 [POST]

prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/interviews/[id]/upload/route.ts`:87 — IDOR004 [POST]

Mutation prisma.mediaAsset.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewSession.recordingAssetId }
```

### `src/app/api/interviews/[id]/upload/route.ts`:108 — IDOR004 [POST]

Mutation prisma.interviewSession.update uses where: { id } with no ownership constraint.

```ts
{ id: interviewId }
```

### `src/app/api/invites/[token]/accept/route.ts`:37 — IDOR003 [POST]

prisma.teamMemberInvite.update uses where: { id } with no ownership constraint.

```ts
{ id: invite.id }
```

### `src/app/api/invites/[token]/accept/route.ts`:64 — IDOR003 [POST]

prisma.teamMemberInvite.update uses where: { id } with no ownership constraint.

```ts
{ id: invite.id }
```

### `src/app/api/invites/[token]/accept/route.ts`:96 — IDOR003 [POST]

prisma.teamMemberInvite.update uses where: { id } with no ownership constraint.

```ts
{ id: invite.id }
```

### `src/app/api/invites/[token]/accept/route.ts`:37 — IDOR004 [POST]

Mutation prisma.teamMemberInvite.update uses where: { id } with no ownership constraint.

```ts
{ id: invite.id }
```

### `src/app/api/invites/[token]/accept/route.ts`:64 — IDOR004 [POST]

Mutation prisma.teamMemberInvite.update uses where: { id } with no ownership constraint.

```ts
{ id: invite.id }
```

### `src/app/api/invites/[token]/accept/route.ts`:96 — IDOR004 [POST]

Mutation prisma.teamMemberInvite.update uses where: { id } with no ownership constraint.

```ts
{ id: invite.id }
```

### `src/app/api/invites/[token]/decline/route.ts`:35 — IDOR003 [POST]

prisma.teamMemberInvite.update uses where: { id } with no ownership constraint.

```ts
{ id: invite.id }
```

### `src/app/api/invites/[token]/decline/route.ts`:35 — IDOR004 [POST]

Mutation prisma.teamMemberInvite.update uses where: { id } with no ownership constraint.

```ts
{ id: invite.id }
```

### `src/app/api/meeting-notes/[noteId]/attachments/route.ts`:34 — IDOR003 [POST]

prisma.meetingNote.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: noteId }
```

### `src/app/api/meeting-notes/[noteId]/attachments/route.ts`:50 — IDOR003 [POST]

prisma.room.findFirst uses where: { id } with no ownership constraint.

```ts
{ id, projectId: note.projectId }
```

### `src/app/api/meeting-notes/[noteId]/attachments/route.ts`:60 — IDOR003 [POST]

prisma.projectProductTag.findFirst uses where: { id } with no ownership constraint.

```ts
{ id, projectId: note.projectId }
```

### `src/app/api/meeting-notes/[noteId]/attachments/route.ts`:143 — IDOR003 [DELETE]

prisma.meetingNote.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: noteId }
```

### `src/app/api/meeting-notes/[noteId]/attachments/route.ts`:158 — IDOR003 [DELETE]

prisma.noteAttachment.findFirst uses where: { id } with no ownership constraint.

```ts
{ id: attachmentId, noteId }
```

### `src/app/api/meeting-notes/[noteId]/attachments/route.ts`:170 — IDOR003 [DELETE]

prisma.noteAttachment.delete uses where: { id } with no ownership constraint.

```ts
{ id: attachmentId }
```

### `src/app/api/meeting-notes/[noteId]/attachments/route.ts`:170 — IDOR004 [DELETE]

Mutation prisma.noteAttachment.delete uses where: { id } with no ownership constraint.

```ts
{ id: attachmentId }
```

### `src/app/api/messages/conversations/[id]/messages/route.ts`:52 — IDOR003 [POST]

prisma.conversation.update uses where: { id } with no ownership constraint.

```ts
{ id: conversationId }
```

### `src/app/api/messages/conversations/[id]/messages/route.ts`:52 — IDOR004 [POST]

Mutation prisma.conversation.update uses where: { id } with no ownership constraint.

```ts
{ id: conversationId }
```

### `src/app/api/messages/conversations/[id]/route.ts`:28 — IDOR003 [GET]

prisma.conversation.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: conversationId }
```

### `src/app/api/messages/conversations/route.ts`:52 — IDOR004 [POST]

Mutation prisma.conversation.update uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/org/[orgId]/territory/[assignmentId]/route.ts`:47 — IDOR003 [DELETE]

prisma.orgTerritoryAssignment.delete uses where: { id } with no ownership constraint.

```ts
{ id: assignmentId }
```

### `src/app/api/org/[orgId]/territory/[assignmentId]/route.ts`:47 — IDOR004 [DELETE]

Mutation prisma.orgTerritoryAssignment.delete uses where: { id } with no ownership constraint.

```ts
{ id: assignmentId }
```

### `src/app/api/orgs/[orgId]/bio-interview/coverage/route.ts`:45 — IDOR003 [POST]

prisma.interviewQuestionCoverage.upsert uses where: { id } with no ownership constraint.

```ts
{
          orgBioInterviewId_questionId: {
            orgBioInterviewId: interview.id,
            questionId: item.questionId,
          },
        }
```

### `src/app/api/orgs/[orgId]/bio-interview/coverage/route.ts`:45 — IDOR004 [POST]

Mutation prisma.interviewQuestionCoverage.upsert uses where: { id } with no ownership constraint.

```ts
{
          orgBioInterviewId_questionId: {
            orgBioInterviewId: interview.id,
            questionId: item.questionId,
          },
        }
```

### `src/app/api/orgs/[orgId]/join/route.ts`:71 — IDOR003 [POST]

prisma.orgJoinRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: existingRequest.id }
```

### `src/app/api/orgs/[orgId]/join/route.ts`:226 — IDOR003 [PATCH]

prisma.orgJoinRequest.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/orgs/[orgId]/join/route.ts`:257 — IDOR003 [PATCH]

prisma.orgJoinRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/orgs/[orgId]/join/route.ts`:272 — IDOR003 [PATCH]

prisma.orgJoinRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/orgs/[orgId]/join/route.ts`:71 — IDOR004 [POST]

Mutation prisma.orgJoinRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: existingRequest.id }
```

### `src/app/api/orgs/[orgId]/join/route.ts`:257 — IDOR004 [PATCH]

Mutation prisma.orgJoinRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/orgs/[orgId]/join/route.ts`:272 — IDOR004 [PATCH]

Mutation prisma.orgJoinRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/orgs/[orgId]/team/[orgUserId]/quiz/generate/route.ts`:22 — IDOR003 [POST]

prisma.organizationUser.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: orgUserId }
```

### `src/app/api/orgs/[orgId]/team/[orgUserId]/quiz/route.ts`:21 — IDOR003 [POST]

prisma.organizationUser.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: orgUserId }
```

### `src/app/api/orgs/[orgId]/team/[orgUserId]/quiz/settings/route.ts`:21 — IDOR003 [PATCH]

prisma.organizationUser.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: orgUserId }
```

### `src/app/api/products/[productId]/generate-3d/route.ts`:17 — IDOR003 [POST]

prisma.product.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.productId }
```

### `src/app/api/products/[productId]/generate-3d/route.ts`:72 — IDOR003 [POST]

prisma.product.update uses where: { id } with no ownership constraint.

```ts
{ id: product.id }
```

### `src/app/api/products/[productId]/generate-3d/route.ts`:72 — IDOR004 [POST]

Mutation prisma.product.update uses where: { id } with no ownership constraint.

```ts
{ id: product.id }
```

### `src/app/api/products/[productId]/in-context-boosts/route.ts`:94 — IDOR003 [POST]

prisma.inContextBoost.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: boostId }
```

### `src/app/api/products/[productId]/in-context-boosts/route.ts`:125 — IDOR003 [POST]

prisma.inContextBoost.update uses where: { id } with no ownership constraint.

```ts
{ id: boostId }
```

### `src/app/api/products/[productId]/in-context-boosts/route.ts`:125 — IDOR004 [POST]

Mutation prisma.inContextBoost.update uses where: { id } with no ownership constraint.

```ts
{ id: boostId }
```

### `src/app/api/products/[productId]/qr/route.ts`:12 — IDOR007 [GET]

where clause consumes params.* but session.user.id was not read before the query.

```ts
{ id: params.productId }
```

### `src/app/api/products/[productId]/request-sample/route.ts`:30 — IDOR003 [POST]

prisma.product.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: productId }
```

### `src/app/api/products/[productId]/route.ts`:12 — IDOR003 [GET]

prisma.product.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.productId }
```

### `src/app/api/products/[productId]/route.ts`:81 — IDOR003 [PUT]

prisma.product.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.productId }
```

### `src/app/api/products/[productId]/route.ts`:126 — IDOR003 [PUT]

prisma.product.update uses where: { id } with no ownership constraint.

```ts
{ id: params.productId }
```

### `src/app/api/products/[productId]/route.ts`:126 — IDOR004 [PUT]

Mutation prisma.product.update uses where: { id } with no ownership constraint.

```ts
{ id: params.productId }
```

### `src/app/api/products/[productId]/route.ts`:12 — IDOR007 [GET]

where clause consumes params.* but session.user.id was not read before the query.

```ts
{ id: params.productId }
```

### `src/app/api/products/[productId]/vendor-insights/route.ts`:25 — IDOR003 [GET]

prisma.product.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: productId }
```

### `src/app/api/profile/pinned/route.ts`:147 — IDOR004 [POST]

Mutation prisma.project.update uses where: { id } with no ownership constraint.

```ts
{ id: itemId }
```

### `src/app/api/profile/pinned/route.ts`:153 — IDOR004 [POST]

Mutation prisma.media.update uses where: { id } with no ownership constraint.

```ts
{ id: itemId }
```

### `src/app/api/profile/pinned/route.ts`:159 — IDOR004 [POST]

Mutation prisma.recognition.update uses where: { id } with no ownership constraint.

```ts
{ id: itemId }
```

### `src/app/api/profile/pinned/route.ts`:165 — IDOR004 [POST]

Mutation prisma.collaboration.update uses where: { id } with no ownership constraint.

```ts
{ id: itemId }
```

### `src/app/api/project-product-tags/[id]/action-items/route.ts`:24 — IDOR003 [GET]

prisma.projectProductTag.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: productTagId }
```

### `src/app/api/project-product-tags/[id]/action-items/route.ts`:119 — IDOR003 [POST]

prisma.projectProductTag.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: productTagId }
```

### `src/app/api/project-product-tags/[id]/action-items/route.ts`:135 — IDOR003 [POST]

prisma.meetingNote.findFirst uses where: { id } with no ownership constraint.

```ts
{ id: sourceNoteId, projectId: tag.projectId }
```

### `src/app/api/projects/[id]/availability-check/route.ts`:34 — IDOR003 [POST]

prisma.project.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: projectId }
```

### `src/app/api/projects/[id]/bulk-request/route.ts`:37 — IDOR003 [POST]

prisma.project.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: projectId }
```

### `src/app/api/projects/[id]/bulk-request/route.ts`:88 — IDOR003 [POST]

prisma.projectProductPricing.upsert uses where: { id } with no ownership constraint.

```ts
{
            projectId_productId_roomId: {
              projectId,
              productId: p.productId,
              roomId: null,
            },
          }
```

### `src/app/api/projects/[id]/bulk-request/route.ts`:145 — IDOR003 [POST]

prisma.bulkPricingRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: bulkRequest.id }
```

### `src/app/api/projects/[id]/bulk-request/route.ts`:88 — IDOR004 [POST]

Mutation prisma.projectProductPricing.upsert uses where: { id } with no ownership constraint.

```ts
{
            projectId_productId_roomId: {
              projectId,
              productId: p.productId,
              roomId: null,
            },
          }
```

### `src/app/api/projects/[id]/bulk-request/route.ts`:145 — IDOR004 [POST]

Mutation prisma.bulkPricingRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: bulkRequest.id }
```

### `src/app/api/projects/[id]/lead-time-request/route.ts`:35 — IDOR003 [POST]

prisma.project.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: projectId }
```

### `src/app/api/projects/[id]/overview/route.ts`:23 — IDOR003 [GET]

prisma.project.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: projectId }
```

### `src/app/api/projects/[id]/overview/route.ts`:41 — IDOR003 [GET]

prisma.project.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: projectId }
```

### `src/app/api/projects/[id]/pricing/route.ts`:68 — IDOR003 [POST]

prisma.projectProductPricing.upsert uses where: { id } with no ownership constraint.

```ts
{
        projectId_productId_roomId: {
          projectId: params.id,
          productId,
          roomId: roomId || null,
        },
      }
```

### `src/app/api/projects/[id]/pricing/route.ts`:68 — IDOR004 [POST]

Mutation prisma.projectProductPricing.upsert uses where: { id } with no ownership constraint.

```ts
{
        projectId_productId_roomId: {
          projectId: params.id,
          productId,
          roomId: roomId || null,
        },
      }
```

### `src/app/api/projects/[id]/quotes/[quoteId]/status/route.ts`:28 — IDOR003 [PATCH]

prisma.quoteAttachment.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: quoteId }
```

### `src/app/api/projects/[id]/quotes/[quoteId]/status/route.ts`:52 — IDOR003 [PATCH]

prisma.quoteAttachment.update uses where: { id } with no ownership constraint.

```ts
{ id: quoteId }
```

### `src/app/api/projects/[id]/quotes/[quoteId]/status/route.ts`:52 — IDOR004 [PATCH]

Mutation prisma.quoteAttachment.update uses where: { id } with no ownership constraint.

```ts
{ id: quoteId }
```

### `src/app/api/projects/[id]/settings/route.ts`:20 — IDOR003 [PATCH]

prisma.project.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/projects/[id]/settings/route.ts`:42 — IDOR003 [PATCH]

prisma.project.update uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/projects/[id]/settings/route.ts`:42 — IDOR004 [PATCH]

Mutation prisma.project.update uses where: { id } with no ownership constraint.

```ts
{ id: params.id }
```

### `src/app/api/projects/handoff/route.ts`:102 — IDOR004 [POST]

Mutation prisma.project.update uses where: { id } with no ownership constraint.

```ts
{ id: project.id as any }
```

### `src/app/api/prompted-content/answers/route.ts`:59 — IDOR004 [POST]

Mutation prisma.promptedQuestion.update uses where: { id } with no ownership constraint.

```ts
{ id: questionId }
```

### `src/app/api/prompted-content/answers/route.ts`:80 — IDOR004 [POST]

Mutation prisma.promptedAnswer.update uses where: { id } with no ownership constraint.

```ts
{ id: answer.id }
```

### `src/app/api/prompted-content/questions/route.ts`:96 — IDOR004 [GET]

Mutation prisma.promptedQuestion.updateMany uses where: { id } with no ownership constraint.

```ts
{ id: { in: questionIds } }
```

### `src/app/api/rep-contacts/request-spec/route.ts`:56 — IDOR004 [POST]

Mutation prisma.vendorRepContact.update uses where: { id } with no ownership constraint.

```ts
{ id: repContactId }
```

### `src/app/api/rooms/[id]/approvals/generate-concept-image/route.ts`:19 — IDOR003 [POST]

prisma.room.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: roomId }
```

### `src/app/api/rooms/[id]/approvals/generate-concept-image/route.ts`:40 — IDOR003 [POST]

prisma.projectImage.findFirst uses where: { id } with no ownership constraint.

```ts
{
        projectId: project.id,
        room: room.name,
        name: { contains: CONCEPT_IMAGE_MARKER },
      }
```

### `src/app/api/rooms/[id]/approvals/generate-skeletons/route.ts`:18 — IDOR003 [POST]

prisma.room.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: roomId }
```

### `src/app/api/search/signals/route.ts`:55 — IDOR004 [POST]

Mutation prisma.projectImage.update uses where: { id } with no ownership constraint.

```ts
{ id: momentId }
```

### `src/app/api/search/signals/route.ts`:81 — IDOR004 [POST]

Mutation prisma.momentIndex.updateMany uses where: { id } with no ownership constraint.

```ts
{ projectImageId: momentId }
```

### `src/app/api/tags/[tagId]/generate-3d/route.ts`:19 — IDOR003 [POST]

prisma.productTag.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.tagId }
```

### `src/app/api/tags/[tagId]/generate-3d/route.ts`:53 — IDOR003 [POST]

prisma.productTag.update uses where: { id } with no ownership constraint.

```ts
{ id: tag.id }
```

### `src/app/api/tags/[tagId]/generate-3d/route.ts`:74 — IDOR003 [POST]

prisma.productTag.update uses where: { id } with no ownership constraint.

```ts
{ id: tag.id }
```

### `src/app/api/tags/[tagId]/generate-3d/route.ts`:111 — IDOR003 [POST]

prisma.productTag.update uses where: { id } with no ownership constraint.

```ts
{ id: tag.id }
```

### `src/app/api/tags/[tagId]/generate-3d/route.ts`:141 — IDOR003 [POST]

prisma.productTag.update uses where: { id } with no ownership constraint.

```ts
{ id: params.tagId }
```

### `src/app/api/tags/[tagId]/generate-3d/route.ts`:53 — IDOR004 [POST]

Mutation prisma.productTag.update uses where: { id } with no ownership constraint.

```ts
{ id: tag.id }
```

### `src/app/api/tags/[tagId]/generate-3d/route.ts`:74 — IDOR004 [POST]

Mutation prisma.productTag.update uses where: { id } with no ownership constraint.

```ts
{ id: tag.id }
```

### `src/app/api/tags/[tagId]/generate-3d/route.ts`:111 — IDOR004 [POST]

Mutation prisma.productTag.update uses where: { id } with no ownership constraint.

```ts
{ id: tag.id }
```

### `src/app/api/tags/[tagId]/generate-3d/route.ts`:141 — IDOR004 [POST]

Mutation prisma.productTag.update uses where: { id } with no ownership constraint.

```ts
{ id: params.tagId }
```

### `src/app/api/users/[userId]/follow/route.ts`:27 — IDOR003 [POST]

prisma.userRelationship.findUnique uses where: { id } with no ownership constraint.

```ts
{ followerId_followingId: { followerId, followingId } }
```

### `src/app/api/users/[userId]/follow/route.ts`:36 — IDOR003 [POST]

prisma.userRelationship.findUnique uses where: { id } with no ownership constraint.

```ts
{ followerId_followingId: { followerId: followingId, followingId: followerId } }
```

### `src/app/api/users/[userId]/follow/route.ts`:56 — IDOR003 [POST]

prisma.userRelationship.update uses where: { id } with no ownership constraint.

```ts
{ id: reverse.id }
```

### `src/app/api/users/[userId]/follow/route.ts`:68 — IDOR003 [POST]

prisma.user.update uses where: { id } with no ownership constraint.

```ts
{ id: followerId }
```

### `src/app/api/users/[userId]/follow/route.ts`:72 — IDOR003 [POST]

prisma.user.update uses where: { id } with no ownership constraint.

```ts
{ id: followingId }
```

### `src/app/api/users/[userId]/follow/route.ts`:108 — IDOR003 [DELETE]

prisma.userRelationship.findUnique uses where: { id } with no ownership constraint.

```ts
{ followerId_followingId: { followerId, followingId } }
```

### `src/app/api/users/[userId]/follow/route.ts`:117 — IDOR003 [DELETE]

prisma.userRelationship.delete uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/users/[userId]/follow/route.ts`:123 — IDOR003 [DELETE]

prisma.userRelationship.findUnique uses where: { id } with no ownership constraint.

```ts
{ followerId_followingId: { followerId: followingId, followingId: followerId } }
```

### `src/app/api/users/[userId]/follow/route.ts`:128 — IDOR003 [DELETE]

prisma.userRelationship.update uses where: { id } with no ownership constraint.

```ts
{ id: reverse.id }
```

### `src/app/api/users/[userId]/follow/route.ts`:141 — IDOR003 [DELETE]

prisma.user.update uses where: { id } with no ownership constraint.

```ts
{ id: followerId }
```

### `src/app/api/users/[userId]/follow/route.ts`:145 — IDOR003 [DELETE]

prisma.user.update uses where: { id } with no ownership constraint.

```ts
{ id: followingId }
```

### `src/app/api/users/[userId]/follow/route.ts`:56 — IDOR004 [POST]

Mutation prisma.userRelationship.update uses where: { id } with no ownership constraint.

```ts
{ id: reverse.id }
```

### `src/app/api/users/[userId]/follow/route.ts`:68 — IDOR004 [POST]

Mutation prisma.user.update uses where: { id } with no ownership constraint.

```ts
{ id: followerId }
```

### `src/app/api/users/[userId]/follow/route.ts`:72 — IDOR004 [POST]

Mutation prisma.user.update uses where: { id } with no ownership constraint.

```ts
{ id: followingId }
```

### `src/app/api/users/[userId]/follow/route.ts`:117 — IDOR004 [DELETE]

Mutation prisma.userRelationship.delete uses where: { id } with no ownership constraint.

```ts
{ id: existing.id }
```

### `src/app/api/users/[userId]/follow/route.ts`:128 — IDOR004 [DELETE]

Mutation prisma.userRelationship.update uses where: { id } with no ownership constraint.

```ts
{ id: reverse.id }
```

### `src/app/api/users/[userId]/follow/route.ts`:141 — IDOR004 [DELETE]

Mutation prisma.user.update uses where: { id } with no ownership constraint.

```ts
{ id: followerId }
```

### `src/app/api/users/[userId]/follow/route.ts`:145 — IDOR004 [DELETE]

Mutation prisma.user.update uses where: { id } with no ownership constraint.

```ts
{ id: followingId }
```

### `src/app/api/users/[userId]/relationship/route.ts`:33 — IDOR003 [GET]

prisma.userRelationship.findUnique uses where: { id } with no ownership constraint.

```ts
{ followerId_followingId: { followerId: currentUserId, followingId: targetId } }
```

### `src/app/api/users/[userId]/relationship/route.ts`:37 — IDOR003 [GET]

prisma.userRelationship.findUnique uses where: { id } with no ownership constraint.

```ts
{ followerId_followingId: { followerId: targetId, followingId: currentUserId } }
```

### `src/app/api/vendor-boost/[id]/accept/route.ts`:19 — IDOR003 [POST]

prisma.vendorBoostRequest.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/vendor-boost/[id]/accept/route.ts`:54 — IDOR003 [POST]

prisma.vendorBoostRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/vendor-boost/[id]/accept/route.ts`:83 — IDOR003 [POST]

prisma.vendorBoostRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/vendor-boost/[id]/accept/route.ts`:54 — IDOR004 [POST]

Mutation prisma.vendorBoostRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/vendor-boost/[id]/accept/route.ts`:83 — IDOR004 [POST]

Mutation prisma.vendorBoostRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/vendor-boost/[id]/decline/route.ts`:19 — IDOR003 [POST]

prisma.vendorBoostRequest.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/vendor-boost/[id]/decline/route.ts`:50 — IDOR003 [POST]

prisma.vendorBoostRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/vendor-boost/[id]/decline/route.ts`:50 — IDOR004 [POST]

Mutation prisma.vendorBoostRequest.update uses where: { id } with no ownership constraint.

```ts
{ id: requestId }
```

### `src/app/api/vendor/actions/confirm-spec/route.ts`:50 — IDOR004 [POST]

Mutation prisma.selection.update uses where: { id } with no ownership constraint.

```ts
{ id: productId }
```

### `src/app/api/vendor/actions/confirm-spec/route.ts`:58 — IDOR004 [POST]

Mutation prisma.project.update uses where: { id } with no ownership constraint.

```ts
{ id: projectId }
```

### `src/app/api/vendor/actions/priority-support/route.ts`:35 — IDOR004 [POST]

Mutation prisma.selection.update uses where: { id } with no ownership constraint.

```ts
{ id: selectionId }
```

### `src/app/api/vendor/actions/priority-support/route.ts`:44 — IDOR004 [POST]

Mutation prisma.project.update uses where: { id } with no ownership constraint.

```ts
{ id: projectId }
```

### `src/app/api/vendor/boosts/[opportunityId]/boost/route.ts`:24 — IDOR003 [POST]

prisma.boostOpportunity.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.opportunityId }
```

### `src/app/api/vendor/boosts/[opportunityId]/boost/route.ts`:97 — IDOR003 [POST]

prisma.boostOpportunity.update uses where: { id } with no ownership constraint.

```ts
{ id: opportunity.id }
```

### `src/app/api/vendor/boosts/[opportunityId]/boost/route.ts`:97 — IDOR004 [POST]

Mutation prisma.boostOpportunity.update uses where: { id } with no ownership constraint.

```ts
{ id: opportunity.id }
```

### `src/app/api/vendor/boosts/[opportunityId]/decline/route.ts`:14 — IDOR003 [POST]

prisma.boostOpportunity.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.opportunityId }
```

### `src/app/api/vendor/boosts/[opportunityId]/decline/route.ts`:48 — IDOR003 [POST]

prisma.boostOpportunity.update uses where: { id } with no ownership constraint.

```ts
{ id: params.opportunityId }
```

### `src/app/api/vendor/boosts/[opportunityId]/decline/route.ts`:48 — IDOR004 [POST]

Mutation prisma.boostOpportunity.update uses where: { id } with no ownership constraint.

```ts
{ id: params.opportunityId }
```

### `src/app/api/vendor/claim-product/route.ts`:55 — IDOR004 [POST]

Mutation prisma.vendorPreviewToken.update uses where: { id } with no ownership constraint.

```ts
{ id: previewTokenId }
```

### `src/app/api/vendor/claim-product/route.ts`:61 — IDOR004 [POST]

Mutation prisma.vendor.update uses where: { id } with no ownership constraint.

```ts
{ id: vendor.id }
```

### `src/app/api/vendor/claim-product/route.ts`:72 — IDOR004 [POST]

Mutation prisma.product.update uses where: { id } with no ownership constraint.

```ts
{ id: previewToken.productId }
```

### `src/app/api/vendor/claim-product/route.ts`:82 — IDOR004 [POST]

Mutation prisma.vendorPreviewToken.update uses where: { id } with no ownership constraint.

```ts
{ id: previewTokenId }
```

### `src/app/api/vendor/collaborations/[participantId]/spend/route.ts`:29 — IDOR003 [PATCH]

prisma.projectParticipant.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: participantId }
```

### `src/app/api/vendor/collaborations/[participantId]/spend/route.ts`:100 — IDOR003 [PATCH]

prisma.projectParticipant.update uses where: { id } with no ownership constraint.

```ts
{ id: participantId }
```

### `src/app/api/vendor/collaborations/[participantId]/spend/route.ts`:100 — IDOR004 [PATCH]

Mutation prisma.projectParticipant.update uses where: { id } with no ownership constraint.

```ts
{ id: participantId }
```

### `src/app/api/vendor/visits/[visitId]/attach-project/route.ts`:19 — IDOR003 [POST]

prisma.vendorVisit.findUnique uses where: { id } with no ownership constraint.

```ts
{ id: params.visitId }
```

### `src/app/api/vendor/visits/[visitId]/attach-project/route.ts`:27 — IDOR003 [POST]

prisma.vendorVisit.update uses where: { id } with no ownership constraint.

```ts
{ id: params.visitId }
```

### `src/app/api/vendor/visits/[visitId]/attach-project/route.ts`:27 — IDOR004 [POST]

Mutation prisma.vendorVisit.update uses where: { id } with no ownership constraint.

```ts
{ id: params.visitId }
```

### `src/app/api/visit-tokens/[token]/choose-destination/route.ts`:143 — IDOR003 [POST]

prisma.quoteAttachment.update uses where: { id } with no ownership constraint.

```ts
{ id: visit.handoffPackage.quoteAttachmentId }
```

### `src/app/api/visit-tokens/[token]/choose-destination/route.ts`:153 — IDOR003 [POST]

prisma.vendorVisit.update uses where: { id } with no ownership constraint.

```ts
{ id: visit.id }
```

### `src/app/api/visit-tokens/[token]/choose-destination/route.ts`:161 — IDOR003 [POST]

prisma.project.update uses where: { id } with no ownership constraint.

```ts
{ id: visit.project.id as any }
```

### `src/app/api/visit-tokens/[token]/choose-destination/route.ts`:143 — IDOR004 [POST]

Mutation prisma.quoteAttachment.update uses where: { id } with no ownership constraint.

```ts
{ id: visit.handoffPackage.quoteAttachmentId }
```

### `src/app/api/visit-tokens/[token]/choose-destination/route.ts`:153 — IDOR004 [POST]

Mutation prisma.vendorVisit.update uses where: { id } with no ownership constraint.

```ts
{ id: visit.id }
```

### `src/app/api/visit-tokens/[token]/choose-destination/route.ts`:161 — IDOR004 [POST]

Mutation prisma.project.update uses where: { id } with no ownership constraint.

```ts
{ id: visit.project.id as any }
```

### `src/app/api/visit-tokens/[token]/route.ts`:14 — IDOR007 [GET]

where clause consumes params.* but session.user.id was not read before the query.

```ts
{ token: params.token }
```

### `src/app/api/visits/[id]/products/[productId]/save/route.ts`:34 — IDOR003 [POST]

prisma.visitProductShare.findUnique uses where: { id } with no ownership constraint.

```ts
{
        visitRecordId_productId: {
          visitRecordId: id,
          productId,
        },
      }
```

### `src/app/api/visits/[id]/products/[productId]/save/route.ts`:48 — IDOR003 [POST]

prisma.visitProductShare.update uses where: { id } with no ownership constraint.

```ts
{ id: productShare.id }
```

### `src/app/api/visits/[id]/products/[productId]/save/route.ts`:48 — IDOR004 [POST]

Mutation prisma.visitProductShare.update uses where: { id } with no ownership constraint.

```ts
{ id: productShare.id }
```

## Medium (58)

### `src/app/api/admin/festivals/route.ts`:168 — IDOR006 [POST]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
rateLimit({
```

### `src/app/api/analytics/concierge/route.ts`:5 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const analyticsData = await request.json();
```

### `src/app/api/assign-projects/route.ts`:47 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const projects = loadProjects();
```

### `src/app/api/auth/force-logout/route.ts`:6 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
// Only allow in development
if (process.env.NODE_ENV === "production") {
```

### `src/app/api/auth/me/avatar/route.ts`:21 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
const userId = await getUserId(req);
if (!userId) {
```

### `src/app/api/auth/me/route.ts`:79 — IDOR005 [PUT]

Mutating route handler PUT has no session check.

```ts
{
const id = await getUserId(req);
if (!id) return NextResponse.json({ ok: false }, { status: 401 });
```

### `src/app/api/auth/signup/route.ts`:35 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
// Rate limiting: Check IP-level limit (prevents mass signup from single source)
// This is generous to avoid false positives from corporate networks/VPNs
```

### `src/app/api/buyer/auth/route.ts`:94 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/buyer/auth/route.ts`:157 — IDOR005 [DELETE]

Mutating route handler DELETE has no session check.

```ts
{
try {
const searchParams = req.nextUrl.searchParams;
```

### `src/app/api/buyer/register/route.ts`:12 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/consultations/route.ts`:14 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/context/match/route.ts`:103 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/context/match/route.ts`:28 — IDOR006 [GET]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const { searchParams } = new URL(req.url);
```

### `src/app/api/context/match/route.ts`:103 — IDOR006 [POST]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/cron/process-boost-opportunities/route.ts`:48 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
return GET(request);
}
```

### `src/app/api/cron/process-boost-revenue/route.ts`:19 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
// Verify cron secret (skip in development)
const cronSecret = process.env.CRON_SECRET;
```

### `src/app/api/dev/supabase-login/route.ts`:7 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
if (process.env.NODE_ENV === 'production') {
return NextResponse.json({ error: 'Disabled in production' }, { status: 403 });
```

### `src/app/api/editorial-submissions/route.ts`:51 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const { projectId, designerId } = await request.json();
```

### `src/app/api/editorial-submissions/route.ts`:161 — IDOR005 [PUT]

Mutating route handler PUT has no session check.

```ts
{
try {
const { submissionId, action, rejectionReason, reviewedBy } = await request.json();
```

### `src/app/api/email/inbound/route.ts`:16 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await request.json();
```

### `src/app/api/event-concierge/parse/route.ts`:135 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const { input } = await request.json();
```

### `src/app/api/export/spec-html/route.ts`:6 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
const { projectId } = await req.json();
if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
```

### `src/app/api/festivals/route.ts`:50 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
// ...festival creation logic...
}
```

### `src/app/api/festivals/route.ts`:54 — IDOR005 [PATCH]

Mutating route handler PATCH has no session check.

```ts
{
// ...festival update logic...
}
```

### `src/app/api/init-db/route.ts`:8 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
console.log('🔌 Connecting to database...');
```

### `src/app/api/instagram/campaign/generate/route.ts`:24 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body: GenerateCampaignRequest = await request.json();
```

### `src/app/api/instagram/campaign/preview/route.ts`:11 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body: PreviewRequest = await request.json();
```

### `src/app/api/maintenance/elevate-role/route.ts`:7 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
// Only allow in development
if (process.env.NODE_ENV === "production") {
```

### `src/app/api/maintenance/upsert-admin/route.ts`:12 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
// Only allow in non-production
if (process.env.NODE_ENV === "production") {
```

### `src/app/api/messages/inbox/route.ts`:5 — IDOR006 [GET]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
const userId = await getUserIdFromRequest(req);
if (!userId) {
```

### `src/app/api/og-fetch/route.ts`:8 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await request.json();
```

### `src/app/api/orb-agent/route.ts`:136 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body: OrbAgentRequest = await request.json();
```

### `src/app/api/organizations/route.ts`:8 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await request.json();
```

### `src/app/api/orgs/route.ts`:15 — IDOR006 [GET]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const url = new URL(request.url);
```

### `src/app/api/orgs/route.ts`:121 — IDOR006 [POST]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession(authOptions);
```

### `src/app/api/photographer/dashboard/route.ts`:12 — IDOR006 [GET]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession(authOptions);
```

### `src/app/api/profiles/route.ts`:130 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const { role, ...profileData } = await request.json();
```

### `src/app/api/projects/[id]/rooms/[roomId]/gen-image/feedback/route.ts`:10 — IDOR006 [POST]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession();
```

### `src/app/api/projects/handoff/route.ts`:121 — IDOR005 [PUT]

Mutating route handler PUT has no session check.

```ts
{
try {
const body = await request.json();
```

### `src/app/api/quotes/route.ts`:8 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const formData = await request.formData();
```

### `src/app/api/scrape-product/route.ts`:347 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const { url } = await request.json();
```

### `src/app/api/seed/events/route.ts`:6 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
// STRICT GUARD: only allow in development
if (process.env.NODE_ENV === 'production') {
```

### `src/app/api/selections/route.ts`:7 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await request.json();
```

### `src/app/api/set-active-profile/route.ts`:5 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const { profileId, role } = await request.json();
```

### `src/app/api/support/chat/route.ts`:60 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
if (!process.env.ANTHROPIC_API_KEY) {
```

### `src/app/api/update-designer-profile/route.ts`:5 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const profileData = await request.json();
```

### `src/app/api/upload-spec-sheet/route.ts`:8 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const formData = await request.formData();
```

### `src/app/api/user/workspace-context/route.ts`:16 — IDOR006 [POST]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession(authOptions);
```

### `src/app/api/user/workspace-context/route.ts`:99 — IDOR006 [GET]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession(authOptions);
```

### `src/app/api/vendor-actions/create-appreciation-dinner/route.ts`:92 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/vendor-actions/create-discovery-lunch/route.ts`:93 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/vendor-analytics/chat/route.ts`:75 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = (await req.json()) as VendorAnalyticsChatRequest;
```

### `src/app/api/vendor/ai-actions/route.ts`:9 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/vendor/ai-analyst/route.ts`:10 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/vendor/claim-product/route.ts`:6 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/vendors/events/create/route.ts`:8 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
// Debug: Log the content type and try to parse the body
```

### `src/app/api/videos/clips/route.ts`:7 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await request.json();
```

### `src/app/api/waitlist/route.ts`:8 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await request.json();
```

## Low (40)

### `src/app/api/auth/me/route.ts`:15 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
const id = await getUserId(req);
if (!id) return NextResponse.json({ ok: false }, { status: 401 });
```

### `src/app/api/auth/rep-onboarding/validate/route.ts`:13 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/buyer/auth/route.ts`:11 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const searchParams = req.nextUrl.searchParams;
```

### `src/app/api/context/match/route.ts`:28 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(req.url);
```

### `src/app/api/cron/dormancy-check/route.ts`:18 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const authHeader = request.headers.get('authorization');
```

### `src/app/api/cron/process-boost-opportunities/route.ts`:20 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
// Verify cron secret (for security)
```

### `src/app/api/designers/route.ts`:8 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
// Load designers from database
```

### `src/app/api/dev/find-product/route.ts`:10 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/directory/vendors/route.ts`:11 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/editorial-submissions/route.ts`:121 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const url = new URL(request.url);
```

### `src/app/api/event-import/route.ts`:84 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/export-all-tagged-products/route.ts`:22 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const projects = loadProjects();
```

### `src/app/api/export-project-tags/route.ts`:43 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/export-spec-sheet/route.ts`:8 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/export-tearsheet/route.ts`:22 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/feed/route.ts`:9 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
const posts = await getPublishedProjectPosts({ take: 8 });
return NextResponse.json({ posts });
```

### `src/app/api/festivals/active/route.ts`:8 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const now = new Date();
```

### `src/app/api/festivals/route.ts`:10 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const festivals = await prisma.event.findMany({
```

### `src/app/api/get-designer-profile/route.ts`:5 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/health/llm/route.ts`:5 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
// Match generator logic: key must exist AND ANTHROPIC_ENABLED !== "false"
const enabled = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";
```

### `src/app/api/init-db/route.ts`:132 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
await prisma.$connect();
```

### `src/app/api/instagram/proxy-image/route.ts`:10 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const searchParams = request.nextUrl.searchParams;
```

### `src/app/api/magazine/filters/route.ts`:23 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const filters: SmartFilter[] = [];
```

### `src/app/api/magazine/posts/route.ts`:26 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = req.nextUrl;
```

### `src/app/api/maintenance/upsert-admin/route.ts`:8 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
```

### `src/app/api/orb-faqs/route.ts`:6 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const searchParams = request.nextUrl.searchParams;
```

### `src/app/api/organizations/route.ts`:54 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/orgs/route.ts`:15 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const url = new URL(request.url);
```

### `src/app/api/orgs/search/route.ts`:24 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
const debugInfo: string[] = [];
debugInfo.push('1. Route handler started');
```

### `src/app/api/posting/_debug/status/route.ts`:6 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
ensureDev();
```

### `src/app/api/products/bulk/route.ts`:7 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/products/route.ts`:11 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/products/search/route.ts`:7 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/profiles/route.ts`:8 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const url = new URL(request.url);
```

### `src/app/api/projects/handoff/route.ts`:182 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/search/all/route.ts`:10 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/tag-product-to-image/route.ts`:542 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/vendor/qbr/route.ts`:12 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
// For now, use demo state. In production, this would fetch from DB based on vendorId
```

### `src/app/api/vendor/visits/route.ts`:127 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const t = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
```

### `src/app/api/videos/clips/route.ts`:76 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

---

This scanner is a high-recall heuristic linter. Add `// @idor-allow: <token> reason="..."` to the top of a route file to suppress false positives. See `scripts/security/idor-scan.ts` for the full rule catalog.

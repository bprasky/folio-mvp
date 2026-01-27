# 12_INTELLIGENCE_SYSTEM

## Purpose

This document defines Folio's intelligence system—the interconnected layers that capture user signals, infer taste patterns, deliver personalized content, power designer workflows, and enable vendor monetization. This is the technical and strategic foundation of Folio's competitive moat.

---

## Executive Summary

Folio's intelligence system transforms passive engagement into structured taste data, then uses that data to:

1. **Help users discover their own taste** (self-facing value)
2. **Connect users to designers who match their aesthetic** (marketplace value)
3. **Give designers context before they even meet clients** (workflow value)
4. **Enable vendors to create targeted content with guaranteed distribution** (monetization)

The system operates across seven interconnected layers, each feeding the next.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: SIGNAL CAPTURE                                                │
│  Likes (impulsive) + Saves (intentional) + Views + Tags                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: PATTERN INFERENCE                                             │
│  Silent detection of taste patterns from behavior                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: INSIGHT CONFIRMATION                                          │
│  Micro-interactions to confirm/deny inferred patterns                   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: PERSONALIZED CONTENT                                          │
│  Different content for likes vs saves; mini-articles; conviction        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 5: USER PROFILE & SELF-DISCOVERY                                 │
│  Taste profile, style articulation, auto-boards, designer matching      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 6: DESIGNER ECOSYSTEM                                            │
│  Welcome back, supplemental quotes, trend interviews, editorial         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 7: VENDOR INSIGHTS & MONETIZATION                                │
│  Engagement analytics, content opportunities, targeted distribution     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Signal Capture

### Overview

Every user action produces a signal. Different actions have different weights and meanings.

### Signal Types

| Signal | Type | Weight | Meaning |
|--------|------|--------|---------|
| View | Passive | Low | Browsing, curiosity |
| Like | Impulsive | Medium | "This is beautiful" - aesthetic approval |
| Save | Intentional | High | "I want this for something" - intent |
| Save to Room | Structured | Highest | Specific use case identified |
| Tag (designer) | Professional | Highest | Specification decision |

### Likes vs Saves: Core Distinction

**Likes are impulsive:**
- Quick dopamine response
- "This is beautiful"
- No commitment implied
- Broad taste signal

**Saves are intentional:**
- "I want this for something"
- Often assigned to room/board
- Implies future action
- Specific intent signal

Both feed the fingerprint, but weighted differently.

### Data Model

```prisma
model Like {
  id            String   @id @default(cuid())
  userId        String
  productId     String
  createdAt     DateTime @default(now())

  // Extracted attributes (populated async)
  productAttributes Json?  // { colors: [], materials: [], shapes: [], styles: [] }

  user          User     @relation(...)
  product       Product  @relation(...)

  @@unique([userId, productId])
  @@index([userId, createdAt])
}

model Save {
  id            String   @id @default(cuid())
  userId        String
  productId     String

  // Organization
  boardId       String?  // User-created or auto-generated board
  roomType      String?  // "living_room", "bedroom", etc.

  // Extracted attributes (populated async)
  productAttributes Json?

  createdAt     DateTime @default(now())

  user          User     @relation(...)
  product       Product  @relation(...)
  board         Board?   @relation(...)

  @@unique([userId, productId])
  @@index([userId, boardId])
  @@index([userId, createdAt])
}
```

### Signal Recording

```typescript
// Record any engagement signal
async function recordSignal(params: {
  userId: string;
  productId: string;
  signalType: 'view' | 'like' | 'save' | 'tag';
  metadata?: Record<string, any>;
}) {
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    select: { colors: true, materials: true, shapes: true, styles: true, category: true }
  });

  // Store the signal
  await prisma[params.signalType].create({
    data: {
      userId: params.userId,
      productId: params.productId,
      productAttributes: {
        colors: product.colors,
        materials: product.materials,
        shapes: product.shapes,
        styles: product.styles,
        category: product.category
      },
      ...params.metadata
    }
  });

  // Trigger async pattern detection
  await queuePatternDetection(params.userId);
}
```

---

## Layer 2: Pattern Inference

### Overview

After collecting signals, the system silently detects patterns without asking the user. The key insight: **infer, then confirm** (not ask upfront).

### Pattern Detection Logic

```typescript
async function detectTastePatterns(userId: string): Promise<TasteInference[]> {
  const recentLikes = await getLikes(userId, { limit: 50 });
  const recentSaves = await getSaves(userId, { limit: 50 });
  const allSignals = [...recentLikes, ...recentSaves];

  const inferences: TasteInference[] = [];

  // 1. FREQUENCY PATTERNS
  // Count attribute occurrences
  const attributeCounts = countAttributes(allSignals);

  for (const [attribute, count] of Object.entries(attributeCounts)) {
    if (count >= 3) {
      inferences.push({
        attribute,
        type: inferAttributeType(attribute), // 'color', 'shape', 'material', 'style'
        confidence: count / allSignals.length,
        evidence: `Appeared in ${count} of ${allSignals.length} engagements`,
        source: 'frequency'
      });
    }
  }

  // 2. CROSS-PATTERNS (the smart part)
  // Same shape, different colors = shape preference
  const byShape = groupBy(allSignals, s => s.productAttributes.shapes[0]);
  for (const [shape, items] of Object.entries(byShape)) {
    if (items.length >= 2) {
      const uniqueColors = unique(items.flatMap(i => i.productAttributes.colors));
      if (uniqueColors.length >= 2) {
        inferences.push({
          attribute: shape,
          type: 'shape',
          confidence: 0.8,
          evidence: `Saved ${shape} in ${uniqueColors.length} different colors`,
          source: 'cross_pattern'
        });
      }
    }
  }

  // Same color, different shapes = color preference
  const byColor = groupBy(allSignals, s => s.productAttributes.colors[0]);
  for (const [color, items] of Object.entries(byColor)) {
    if (items.length >= 2) {
      const uniqueShapes = unique(items.flatMap(i => i.productAttributes.shapes));
      if (uniqueShapes.length >= 2) {
        inferences.push({
          attribute: color,
          type: 'color',
          confidence: 0.8,
          evidence: `Saved ${color} across ${uniqueShapes.length} different shapes`,
          source: 'cross_pattern'
        });
      }
    }
  }

  // 3. STYLE CLUSTERING
  const styleSignature = computeStyleSignature(allSignals);
  if (styleSignature.dominantStyle) {
    inferences.push({
      attribute: styleSignature.dominantStyle,
      type: 'style',
      confidence: styleSignature.confidence,
      evidence: `${styleSignature.matchingItems} items match ${styleSignature.dominantStyle} aesthetic`,
      source: 'clustering'
    });
  }

  return inferences;
}
```

### Data Model

```prisma
model TasteInference {
  id              String   @id @default(cuid())
  userId          String

  attribute       String   // "curved", "green", "velvet", "warm_modern"
  attributeType   String   // "shape", "color", "material", "style"

  confidence      Float    // 0-1 based on pattern strength
  evidence        String   // Human-readable explanation
  source          String   // "frequency", "cross_pattern", "clustering"

  // User confirmation
  confirmedByUser Boolean? // null = not asked, true = yes, false = no
  confirmedAt     DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User     @relation(...)

  @@unique([userId, attribute])
  @@index([userId, confirmedByUser])
}
```

---

## Layer 3: Insight Confirmation

### Overview

Once patterns are detected, surface them to users for confirmation. This converts inferred signals into **high-confidence fingerprint data**.

### Confirmation Flow

```
SAVE 1-4:    Silent. Just collecting.

SAVE 5:      Small banner: "Keep saving! We're learning your taste."

SAVE 10:     First insight surfaces:
             "You seem drawn to [X]. Is that right?"
             [Exactly!] [Not really] [Skip]

SAVE 15:     Cross-pattern insight:
             "You saved this shape in 3 colors.
              Looks like you love the silhouette."
             [Exactly!] [Not really] [Skip]

SAVE 25:     Style name generated:
             "Your emerging style: Warm Modern"
```

### Confirmation UI Component

```tsx
interface InsightConfirmationProps {
  inference: TasteInference;
  onConfirm: () => void;
  onDeny: () => void;
  onSkip: () => void;
}

function InsightConfirmation({ inference, onConfirm, onDeny, onSkip }: InsightConfirmationProps) {
  return (
    <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
      <p className="text-sm text-neutral-500 mb-2">We noticed something ✨</p>
      <p className="font-medium text-neutral-900 mb-1">
        You seem drawn to {inference.attribute}
      </p>
      <p className="text-sm text-neutral-600 mb-4">
        {inference.evidence}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 bg-neutral-900 text-white text-sm rounded-md"
        >
          Exactly!
        </button>
        <button
          onClick={onDeny}
          className="px-3 py-1.5 border border-neutral-300 text-sm rounded-md"
        >
          Not really
        </button>
        <button
          onClick={onSkip}
          className="px-3 py-1.5 text-neutral-500 text-sm"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
```

### Confirmation Outcomes

| Response | Action |
|----------|--------|
| "Exactly!" | `confirmedByUser: true` → High-confidence signal, weighted heavily |
| "Not really" | `confirmedByUser: false` → Removed from active inferences |
| "Skip" | `confirmedByUser: null` → Stays as hypothesis, lower weight |

---

## Layer 4: Personalized Content

### Overview

Likes and saves receive different content because they represent different user states.

### Content Strategy by Signal Type

| Signal | User State | Content Goal | Content Type |
|--------|------------|--------------|--------------|
| Like | "This is beautiful" | Inspire commitment | Social proof, designer quotes, "Ready to commit?" |
| Save | "I want this" | Strengthen conviction | Specs, real rooms, pairings, designer tips |

### Content for Likes (Inspire → Commit)

```tsx
interface LikeEnrichmentProps {
  product: Product;
  likeCount: number;
  saveCount: number;
  designerQuote?: DesignerQuote;
}

function LikeEnrichment({ product, likeCount, saveCount, designerQuote }: LikeEnrichmentProps) {
  return (
    <div className="bg-amber-50 rounded-lg p-4 mt-4">
      <p className="text-sm font-medium text-amber-900 mb-2">
        💭 Why people love it
      </p>

      {designerQuote && (
        <blockquote className="text-sm text-amber-800 italic mb-3">
          "{designerQuote.text}"
          <footer className="text-amber-600 not-italic mt-1">
            — {designerQuote.designerName}
          </footer>
        </blockquote>
      )}

      <p className="text-xs text-amber-700 mb-3">
        {likeCount} others liked this · {saveCount} saved it
      </p>

      <button className="text-sm text-amber-900 font-medium hover:underline">
        Save to a room →
      </button>
    </div>
  );
}
```

### Content for Saves (Strengthen → Act)

```tsx
interface SaveEnrichmentProps {
  product: Product;
  realRooms: ProjectImage[];
  pairings: Product[];
  designerTip?: string;
}

function SaveEnrichment({ product, realRooms, pairings, designerTip }: SaveEnrichmentProps) {
  return (
    <div className="space-y-4 mt-4">
      {/* Practical specs */}
      <div className="bg-neutral-50 rounded-lg p-4">
        <p className="text-sm font-medium mb-2">📐 Things to know</p>
        <ul className="text-sm text-neutral-600 space-y-1">
          <li>Dimensions: {product.dimensions}</li>
          <li>Lead time: {product.leadTime}</li>
          {product.stockCount && <li>In stock: {product.stockCount} left</li>}
        </ul>
      </div>

      {/* Real rooms */}
      {realRooms.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">🏠 In real rooms</p>
          <div className="flex gap-2 overflow-x-auto">
            {realRooms.slice(0, 4).map(room => (
              <img
                key={room.id}
                src={room.url}
                className="w-20 h-20 object-cover rounded"
              />
            ))}
          </div>
          <button className="text-sm text-neutral-600 mt-2 hover:underline">
            See {realRooms.length} projects featuring this →
          </button>
        </div>
      )}

      {/* Pairings */}
      {pairings.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">🎨 Pairs well with</p>
          <p className="text-xs text-neutral-500 mb-2">
            Based on your saves + designer projects
          </p>
          <div className="flex gap-2">
            {pairings.slice(0, 3).map(p => (
              <img
                key={p.id}
                src={p.imageUrl}
                className="w-16 h-16 object-cover rounded"
              />
            ))}
          </div>
        </div>
      )}

      {/* Designer tip */}
      {designerTip && (
        <div className="bg-neutral-50 rounded-lg p-4 border-l-2 border-neutral-300">
          <p className="text-sm font-medium mb-1">💬 Designer's note</p>
          <p className="text-sm text-neutral-600 italic">{designerTip}</p>
        </div>
      )}
    </div>
  );
}
```

### Mini-Articles / Taste Digest

For users with 10+ engagements, generate personalized content:

```typescript
async function generateTasteDigest(userId: string): Promise<TasteDigest> {
  const weeklyLikes = await getLikes(userId, { days: 7 });
  const allSaves = await getSaves(userId);
  const inferences = await getInferences(userId);

  const digest: TasteDigest = { sections: [] };

  // 1. Pattern observation
  const topPattern = findTopPattern(weeklyLikes);
  if (topPattern) {
    digest.sections.push({
      type: 'pattern_observation',
      title: `You've been drawn to ${topPattern.attribute} this week`,
      body: await generatePatternContext(topPattern),
      cta: { label: 'Explore more', action: 'search', query: topPattern.attribute }
    });
  }

  // 2. Board progress
  const boards = groupSavesByBoard(allSaves);
  for (const board of boards) {
    const completeness = assessBoardCompleteness(board);
    if (completeness.missing.length > 0) {
      digest.sections.push({
        type: 'board_progress',
        title: `Your ${board.name} is taking shape`,
        body: generateBoardAdvice(board, completeness),
        progress: completeness,
        cta: { label: `See ${completeness.missing[0]} suggestions`, action: 'search' }
      });
    }
  }

  // 3. Stale save revival
  const staleSaves = allSaves.filter(s => daysSince(s.createdAt) > 7);
  if (staleSaves.length > 0) {
    const save = staleSaves[0];
    const context = await getProductContext(save.productId);
    digest.sections.push({
      type: 'conviction_check',
      title: `Still thinking about ${save.product.name}?`,
      body: context.designerQuote || context.usageContext,
      cta: { label: 'View details', action: 'product', id: save.productId }
    });
  }

  return digest;
}
```

---

## Layer 5: User Profile & Self-Discovery

### Overview

The user profile is a **self-facing dashboard** that helps users understand their own taste. This is Folio's differentiator vs Pinterest.

### Profile Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  YOUR TASTE PROFILE                                                     │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Based on 34 saves                                                      │
│                                                                         │
│  CONFIRMED TASTES                                                       │
│  ✓ Curved silhouettes                                                   │
│  ✓ Velvet textures                                                      │
│  ✓ Brass accents                                                        │
│                                                                         │
│  WE THINK YOU LIKE                                                      │
│  ? Statement lighting      [Confirm?]                                   │
│  ? Deep jewel tones        [Confirm?]                                   │
│                                                                         │
│  YOUR STYLE IN WORDS                                                    │
│  "Warm Modern with Art Deco influence. You gravitate toward             │
│   curved, organic forms in rich textures..."                            │
│                                                                         │
│  DESIGNERS WHO MATCH YOUR TASTE                                         │
│  [Sarah Chen - 94%]  [James Park - 87%]  [View all]                    │
│                                                                         │
│  YOUR BOARDS                                                            │
│  [Living Room - 8 items]  [Inspiration - 12 items]  [Undecided - 4]    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Model

```prisma
model UserTasteProfile {
  id                  String   @id @default(cuid())
  userId              String   @unique

  // AI-generated summary
  styleName           String?  // "Warm Modern with Art Deco influence"
  styleDescription    String?  // Full paragraph description

  // Confirmed preferences (high confidence)
  confirmedAttributes String[]

  // Stats
  totalLikes          Int      @default(0)
  totalSaves          Int      @default(0)
  profileStrength     Float    @default(0) // 0-1 based on confirmations

  // Milestones
  firstInsightAt      DateTime?
  styleNamedAt        DateTime?

  updatedAt           DateTime @updatedAt

  user                User     @relation(...)
}

model Board {
  id            String   @id @default(cuid())
  userId        String

  name          String
  type          String   // 'room', 'style', 'inspiration', 'auto'
  roomType      String?  // If type='room': 'living_room', 'bedroom', etc.

  // Auto-generated boards track their source
  autoGenerated Boolean  @default(false)
  autoSource    String?  // 'room_clustering', 'style_clustering'

  saves         Save[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(...)
}
```

### Style Name Generation

```typescript
async function generateStyleName(userId: string): Promise<string | null> {
  const profile = await getUserTasteProfile(userId);

  if (profile.totalSaves < 25) return null;

  const confirmedInferences = await prisma.tasteInference.findMany({
    where: { userId, confirmedByUser: true }
  });

  if (confirmedInferences.length < 3) return null;

  const prompt = `
    Based on these confirmed taste preferences:
    ${confirmedInferences.map(i => `- ${i.attribute} (${i.attributeType})`).join('\n')}

    Generate a style name (2-4 words) that captures this aesthetic.
    Examples: "Warm Modern", "Coastal Minimalist", "Art Deco Revival", "Scandinavian Warmth"

    Return only the style name, nothing else.
  `;

  return await generateWithClaude(prompt);
}
```

### Designer Matching

```typescript
async function matchDesigners(userId: string): Promise<DesignerMatch[]> {
  const userFingerprint = await getUserFingerprint(userId);

  const designers = await prisma.user.findMany({
    where: { role: 'DESIGNER', atelierFingerprint: { isNot: null } },
    include: { atelierFingerprint: true }
  });

  const matches = designers.map(designer => {
    const similarity = cosineSimilarity(
      userFingerprint.vector,
      designer.atelierFingerprint.vector
    );

    return {
      designer,
      matchScore: similarity,
      matchPercentage: Math.round(similarity * 100),
      sharedAttributes: findSharedAttributes(userFingerprint, designer.atelierFingerprint)
    };
  });

  return matches
    .filter(m => m.matchScore > 0.6)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);
}
```

### Designer Lens Feature

Show user's saves through a designer's aesthetic:

```typescript
async function generateDesignerLens(
  userId: string,
  designerId: string
): Promise<DesignerLensView> {
  const userSaves = await getSaves(userId);
  const designerAtelier = await getDesignerAtelier(designerId);

  // Filter saves to those that match designer's aesthetic
  const relevantSaves = userSaves.filter(save =>
    matchesAtelier(save.product, designerAtelier) > 0.7
  );

  // Generate AI arrangement
  const arrangement = await generateArrangement(relevantSaves, designerAtelier);

  // Generate personalized advice
  const advice = await generateWithClaude(`
    You are ${designerAtelier.designerName}, a designer known for ${designerAtelier.styleDescription}.

    A potential client has saved these items:
    ${relevantSaves.map(s => `- ${s.product.name}`).join('\n')}

    Write 2-3 sentences of advice on how you'd arrange these,
    what's missing, and what direction you'd take.
    Write in first person as the designer.
  `);

  return {
    designer: designerAtelier,
    arrangement,
    advice,
    compatibilityScore: calculateCompatibility(userSaves, designerAtelier)
  };
}
```

---

## Layer 6: Designer Ecosystem

### Overview

The designer ecosystem includes re-engagement, supplemental content, and trend-based collaboration.

### 6.1 Welcome Back System

When designers return to their projects:

```tsx
interface WelcomeBackBannerProps {
  project: Project;
  engagement: {
    views: number;
    saves: number;
    daysSinceVisit: number;
    topInterest?: { productTagId: string; productName: string; count: number };
  };
  onAnswerQuestion: (answer: string) => void;
}

function WelcomeBackBanner({ project, engagement, onAnswerQuestion }: WelcomeBackBannerProps) {
  const [answer, setAnswer] = useState('');

  if (engagement.daysSinceVisit < 1) return null;

  return (
    <div className="bg-stone-50 rounded-lg p-6 mb-6">
      <h3 className="font-medium text-lg mb-2">
        Welcome back to {project.title}
      </h3>

      <p className="text-sm text-neutral-600 mb-4">
        Since your last visit:
      </p>

      <ul className="text-sm space-y-1 mb-4">
        <li>• {engagement.views} people viewed your project</li>
        <li>• {engagement.saves} people saved it</li>
        {engagement.topInterest && (
          <li>• {engagement.topInterest.count} people were interested in {engagement.topInterest.productName}</li>
        )}
      </ul>

      {engagement.topInterest && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">
            Want to add a note about the {engagement.topInterest.productName}?
          </p>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="What drew you to this piece?"
            className="w-full p-3 border rounded-lg text-sm"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onAnswerQuestion(answer)}
              className="px-4 py-2 bg-neutral-900 text-white text-sm rounded-md"
            >
              Add Note
            </button>
            <button className="px-4 py-2 text-neutral-500 text-sm">
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 6.2 Supplemental Quotes System

Micro-answers that enrich posts without full regeneration:

```prisma
model SupplementalQuote {
  id              String   @id @default(cuid())
  projectPostId   String
  productTagId    String?  // If quote is about a specific product

  question        String
  answer          String
  source          String   // 'welcome_back', 'trend_interview', 'user_question'

  // Display control
  pinned          Boolean  @default(false)
  displayLocation String?  // 'near_product', 'sidebar', 'end_of_post'

  createdAt       DateTime @default(now())

  post            ProjectPost @relation(...)
  productTag      ProductTag? @relation(...)

  @@index([projectPostId])
}
```

### 6.3 Trend Detection System

Detect rising signals across the platform:

```prisma
model TrendSignal {
  id            String   @id @default(cuid())

  signalType    String   // 'search', 'save', 'like', 'tag_density'
  topic         String   // 'green chair', 'brass fixtures', 'curved sofa'
  topicType     String   // 'product', 'color', 'material', 'shape', 'style'

  // Metrics
  currentVolume Int      // This period's count
  previousVolume Int     // Last period's count
  growthRate    Float    // Percentage increase
  magnitude     Float    // How strong is the spike (0-1)

  // Related entities
  topProducts   String[] // Product IDs driving the trend
  topDesigners  String[] // Designers who tagged trending items

  // Status
  status        String   // 'detected', 'interviewing', 'published', 'expired'

  // Output
  generatedArticleId String?

  detectedAt    DateTime @default(now())
  expiresAt     DateTime

  interviewRequests TrendInterviewRequest[]
}

model TrendInterviewRequest {
  id              String   @id @default(cuid())
  trendSignalId   String
  designerId      String
  projectId       String
  productTagId    String?

  // The question (AI-generated based on trend)
  question        String

  // Response
  answer          String?
  answeredAt      DateTime?

  // Status
  status          String   // 'pending', 'answered', 'skipped', 'expired'

  // Quality signals
  engagementScore Float?   // How good is this project for the trend

  createdAt       DateTime @default(now())
  expiresAt       DateTime

  trendSignal     TrendSignal @relation(...)
  designer        User        @relation(...)
  project         Project     @relation(...)
}
```

### 6.4 Trend Article Generation

```typescript
async function generateTrendArticle(trendSignalId: string): Promise<Article> {
  const trend = await prisma.trendSignal.findUnique({
    where: { id: trendSignalId },
    include: {
      interviewRequests: {
        where: { status: 'answered' },
        include: { designer: true, project: true }
      }
    }
  });

  if (trend.interviewRequests.length < 3) {
    throw new Error('Need at least 3 responses to generate article');
  }

  // Get product images
  const productImages = await getProductImages(trend.topProducts);

  // Generate article
  const article = await generateWithClaude(`
    Write a trend article titled "The Rise of ${trend.topic}"

    Use these designer quotes:
    ${trend.interviewRequests.map(r =>
      `- "${r.answer}" — ${r.designer.name}`
    ).join('\n')}

    Include:
    - Opening hook about the trend
    - 2-3 designer perspectives with quotes
    - Why this is happening now
    - How to incorporate this trend

    Tone: Editorial, like Architectural Digest
    Length: 400-600 words
  `);

  return await prisma.article.create({
    data: {
      title: `The Rise of ${trend.topic}`,
      body: article,
      type: 'trend',
      trendSignalId,
      designerQuotes: trend.interviewRequests.map(r => ({
        designerId: r.designerId,
        quote: r.answer,
        projectId: r.projectId
      })),
      productIds: trend.topProducts,
      status: 'published',
      publishedAt: new Date()
    }
  });
}
```

---

## Layer 7: Vendor Insights & Monetization

### Overview

Vendors gain intelligence from user engagement data and can create targeted content with guaranteed distribution.

### 7.1 Vendor Analytics Dashboard

```typescript
async function getVendorProductAnalytics(vendorId: string, productId: string) {
  const [likes, saves, tags] = await Promise.all([
    prisma.like.count({ where: { product: { vendorId }, productId } }),
    prisma.save.findMany({
      where: { product: { vendorId }, productId },
      include: { user: { include: { tasteProfile: true } } }
    }),
    prisma.productTag.count({ where: { product: { vendorId }, productId } })
  ]);

  // Analyze fingerprints of engagers
  const fingerprints = saves
    .filter(s => s.user.tasteProfile)
    .map(s => s.user.tasteProfile);

  const fingerprintClusters = clusterFingerprints(fingerprints);

  // Analyze room placement
  const roomDistribution = countBy(saves, s => s.roomType || 'unassigned');

  return {
    engagement: {
      likes,
      saves: saves.length,
      designerTags: tags,
      uncommitted: saves.filter(s => !s.converted).length
    },
    audience: {
      topStyles: fingerprintClusters.slice(0, 3),
      topRooms: Object.entries(roomDistribution).slice(0, 3),
      averageBudget: calculateAverageBudget(fingerprints)
    },
    opportunity: {
      uncommittedCount: saves.filter(s => !s.converted).length,
      estimatedReach: calculateReach(saves, fingerprintClusters)
    }
  };
}
```

### 7.2 Content Opportunity Detection

```prisma
model VendorContentOpportunity {
  id              String   @id @default(cuid())
  vendorId        String
  productId       String

  // Engagement that triggered this
  likeCount       Int
  saveCount       Int
  uncommittedCount Int
  designerTagCount Int

  // Distribution estimate
  tier1Reach      Int      // Direct engagers
  tier2Reach      Int      // Fingerprint matches
  tier3Reach      Int      // Designer followers
  totalReach      Int

  // Status
  status          String   // 'available', 'in_progress', 'published', 'expired'

  // If published
  articleId       String?
  publishedAt     DateTime?

  createdAt       DateTime @default(now())
  expiresAt       DateTime // 7 days default

  vendor          Organization @relation(...)
  product         Product      @relation(...)
}
```

### 7.3 Vendor Content Interview

```typescript
async function generateVendorInterviewQuestions(
  productId: string
): Promise<VendorQuestion[]> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { saves: true, likes: true }
  });

  // Analyze what users react to
  const attributeInterest = analyzeAttributeInterest(product);

  const questions: VendorQuestion[] = [
    {
      id: 'design_story',
      question: 'What inspired this piece? Any design decisions that might not be obvious at first glance?',
      context: 'This helps users understand the craft behind the product.'
    },
    {
      id: 'top_attribute',
      question: `${attributeInterest.topAttribute.percentage}% of saves mention the ${attributeInterest.topAttribute.name}. Why did you choose this ${attributeInterest.topAttribute.type}?`,
      context: `Users are particularly drawn to the ${attributeInterest.topAttribute.name}.`
    },
    {
      id: 'designer_tip',
      question: 'If you could give one piece of advice to someone considering this piece for their space, what would it be?',
      context: 'Practical advice helps convert saves to purchases.'
    }
  ];

  return questions;
}
```

### 7.4 Vendor Article Generation & Distribution

```typescript
async function generateVendorArticle(
  opportunityId: string,
  vendorAnswers: VendorAnswer[]
): Promise<VendorArticle> {
  const opportunity = await prisma.vendorContentOpportunity.findUnique({
    where: { id: opportunityId },
    include: { product: true, vendor: true }
  });

  // Get designer quotes about this product
  const designerQuotes = await prisma.supplementalQuote.findMany({
    where: { productTag: { productId: opportunity.productId } },
    include: { post: { include: { project: { include: { designer: true } } } } }
  });

  // Generate article
  const article = await generateWithClaude(`
    Write a product feature article for "${opportunity.product.name}"

    Vendor perspective:
    ${vendorAnswers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}

    Designer quotes:
    ${designerQuotes.map(q => `"${q.answer}" — ${q.post.project.designer.name}`).join('\n')}

    Structure:
    - Hook: "The story behind the [product] you saved"
    - Section 1: Design story (from vendor)
    - Section 2: Why the key attribute matters (from vendor)
    - Section 3: What designers say (from quotes)
    - Section 4: Practical details (specs, availability)
    - CTA: Save, view, find a designer

    Tone: Editorial, not promotional
    Length: 300-500 words
  `);

  return await prisma.vendorArticle.create({
    data: {
      vendorId: opportunity.vendorId,
      productId: opportunity.productId,
      opportunityId,
      title: `The Story Behind the ${opportunity.product.name} You Saved`,
      body: article,
      designerQuotes: designerQuotes.map(q => ({
        designerId: q.post.project.designerId,
        quote: q.answer
      })),
      status: 'published',
      publishedAt: new Date()
    }
  });
}

async function distributeVendorArticle(articleId: string): Promise<DistributionResult> {
  const article = await prisma.vendorArticle.findUnique({
    where: { id: articleId },
    include: { product: true }
  });

  // TIER 1: Direct engagers (guaranteed)
  const directEngagers = await prisma.user.findMany({
    where: {
      OR: [
        { likes: { some: { productId: article.productId } } },
        { saves: { some: { productId: article.productId } } }
      ]
    }
  });

  // TIER 2: Fingerprint matches
  const productFingerprint = await getProductFingerprint(article.productId);
  const fingerprintMatches = await findSimilarFingerprints(productFingerprint, {
    threshold: 0.75,
    limit: 5000,
    exclude: directEngagers.map(u => u.id)
  });

  // TIER 3: Designer followers
  const taggedByDesigners = await prisma.productTag.findMany({
    where: { productId: article.productId },
    include: { image: { include: { project: { include: { designer: true } } } } }
  });
  const designerIds = unique(taggedByDesigners.map(t => t.image.project.designerId));
  const designerFollowers = await getFollowersOf(designerIds);

  // Create feed items with appropriate context
  const feedItems = [
    ...directEngagers.map(user => ({
      userId: user.id,
      articleId,
      tier: 'direct',
      context: 'Shown because you saved this product'
    })),
    ...fingerprintMatches.map(user => ({
      userId: user.id,
      articleId,
      tier: 'fingerprint',
      context: 'Matches your taste'
    })),
    ...designerFollowers.map(user => ({
      userId: user.id,
      articleId,
      tier: 'social',
      context: 'From designers you follow'
    }))
  ];

  await prisma.feedItem.createMany({ data: feedItems });

  return {
    tier1: directEngagers.length,
    tier2: fingerprintMatches.length,
    tier3: designerFollowers.length,
    total: feedItems.length
  };
}
```

### 7.5 Monetization Tiers

| Tier | Features | Pricing |
|------|----------|---------|
| **Free** | View engagement data, see why people save | Included |
| **Basic** | Content interview, organic reach (Tier 1 only) | $199/article |
| **Boost** | Guaranteed Tier 1-3 distribution | $499/article + $5 CPM |
| **Premium** | Designer collaboration + trend inclusion | $999/month |

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Demo-Ready**

1. ✅ PDF Import → ProductTag connection
2. New Products Banner (post-import regeneration prompt)
3. Welcome Back Banner (engagement summary for returning designers)
4. Supplemental Quotes storage and display

### Phase 2: Signal Layer (Week 3-4)
**Core Value**

5. Likes vs Saves distinction in data model
6. Product attribute extraction (colors, materials, shapes)
7. Basic signal recording with attributes
8. Content enrichment by signal type

### Phase 3: Pattern Detection (Week 5-6)
**Intelligence**

9. Pattern inference logic (frequency + cross-patterns)
10. TasteInference model and storage
11. Insight confirmation UI
12. Basic taste profile page

### Phase 4: User Profile (Week 7-8)
**Self-Discovery**

13. Full taste profile dashboard
14. Style name generation
15. Auto-board clustering
16. Designer matching

### Phase 5: Designer Ecosystem (Week 9-10)
**Flywheel**

17. Trend detection system
18. Trend micro-interviews
19. Multi-designer trend articles
20. Designer Lens feature

### Phase 6: Vendor Monetization (Week 11-12)
**Revenue**

21. Vendor analytics dashboard
22. Content opportunity detection
23. Vendor interview flow
24. Article generation and distribution
25. Monetization tiers

---

## Success Metrics

### User Metrics
- Saves per user (target: 20+ for profile unlock)
- Confirmation rate on inferences (target: 60%+)
- Profile completion rate (target: 40% of users with 25+ saves)
- Designer match click-through (target: 15%)

### Designer Metrics
- Welcome back engagement (target: 30% answer rate)
- Supplemental quote additions (target: 2+ per active project)
- Trend interview response rate (target: 50%)

### Vendor Metrics
- Content opportunity conversion (target: 20%)
- Article engagement rate (target: 5% CTR)
- Tier 1 distribution view rate (target: 40%)

### Platform Metrics
- Signal-to-inference conversion (target: 70% of users get inferences)
- Inference-to-confirmation rate (target: 50%)
- Content piece generation (target: 10+ trend articles/month)

---

## Appendix: API Endpoints

### User Signals
- `POST /api/signals/like` - Record a like
- `POST /api/signals/save` - Record a save
- `GET /api/users/[id]/taste-profile` - Get taste profile
- `GET /api/users/[id]/inferences` - Get taste inferences
- `POST /api/users/[id]/inferences/[inferenceId]/confirm` - Confirm/deny inference

### Designer Ecosystem
- `GET /api/projects/[id]/engagement` - Get project engagement metrics
- `POST /api/projects/[id]/supplemental-quotes` - Add supplemental quote
- `GET /api/trends` - Get active trends
- `POST /api/trends/[id]/respond` - Respond to trend interview

### Vendor
- `GET /api/vendor/products/[id]/analytics` - Get product analytics
- `GET /api/vendor/opportunities` - Get content opportunities
- `POST /api/vendor/opportunities/[id]/interview` - Submit interview answers
- `GET /api/vendor/articles` - Get published articles
- `GET /api/vendor/articles/[id]/performance` - Get article performance

---

## Conclusion

The Folio Intelligence System transforms passive engagement into structured taste data, then uses that data to create value for all participants:

- **Users** discover their own taste and find matching designers
- **Designers** get context before meeting clients and re-engage with their projects
- **Vendors** understand why people save their products and can create targeted content

The system creates a self-reinforcing loop: more engagement → better intelligence → better content → more engagement.

This is Folio's competitive moat.

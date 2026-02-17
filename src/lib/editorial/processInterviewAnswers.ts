import { prisma } from '@/lib/prisma';
import { recordAtelierSignal } from '@/lib/atelier/signals';
import { AtelierOwnerType, AtelierSignalSourceType } from '@prisma/client';
import {
  digestInterviewAnswer,
  buildDigestContext,
  type AnswerDigest,
} from '@/lib/interview/digestInterviewAnswer';

interface ProcessedAnswer {
  answerId: string;
  questionId: string;
  answerText: string;
  questionSource: 'base_question' | 'ai_classification' | 'follow_up';
  linkedImageId?: string;
  linkedProductId?: string;
  attributeType?: string;
  attributeValue?: string;
  // Contextual metadata for digestion
  questionText?: string;
  questionCategory?: string;
  vendors?: string[];
  products?: string[];
  rooms?: string[];
}

interface VerificationResult {
  verified: boolean | null;
  correctedValue?: string;
  confidence: number;
}

/**
 * Analyze answer text to determine if it confirms, corrects, or is neutral
 * about the AI-detected attribute
 */
function analyzeVerification(
  answerText: string,
  attributeType: string,
  attributeValue: string
): VerificationResult {
  const lowerAnswer = answerText.toLowerCase();
  const lowerValue = attributeValue.toLowerCase();

  // Check for explicit corrections
  const correctionPatterns = [
    /actually (?:it's|its|it is|that's|that is) (?:more of )?(?:a |an )?([a-z\s]+)/i,
    /i(?:'d| would) (?:call|describe) (?:it|that) (?:more )?(?:as )?(?:a |an )?([a-z\s]+)/i,
    /not really ([a-z\s]+)[,.]? more like ([a-z\s]+)/i,
    /it's not ([a-z\s]+)[,.]? it's ([a-z\s]+)/i,
  ];

  for (const pattern of correctionPatterns) {
    const match = lowerAnswer.match(pattern);
    if (match) {
      const correctedValue = match[match.length - 1]?.trim();
      if (correctedValue && correctedValue !== lowerValue) {
        return {
          verified: false,
          correctedValue,
          confidence: 0.8,
        };
      }
    }
  }

  // Check for confirmation signals
  const confirmationSignals = [
    lowerAnswer.includes(lowerValue),
    lowerAnswer.includes('yes'),
    lowerAnswer.includes('exactly'),
    lowerAnswer.includes('absolutely'),
    lowerAnswer.includes('that\'s right'),
    lowerAnswer.includes('correct'),
  ];

  const confirmationCount = confirmationSignals.filter(Boolean).length;

  if (confirmationCount >= 2) {
    return { verified: true, confidence: 0.9 };
  } else if (confirmationCount === 1) {
    return { verified: true, confidence: 0.7 };
  }

  // Neutral - answered but didn't clearly confirm or deny
  return { verified: null, confidence: 0.5 };
}

/**
 * Extract decision type from attribute type
 */
function getDecisionType(attributeType?: string): string {
  if (!attributeType) return 'design_decision';
  const mapping: Record<string, string> = {
    color: 'color_choice',
    material: 'material_choice',
    style: 'style_direction',
    mood: 'style_direction',
    element: 'product_selection',
  };
  return mapping[attributeType] || 'style_direction';
}

/**
 * Process a single contextual answer into decision + verification
 */
async function processContextualAnswer(
  answer: ProcessedAnswer,
  designerId: string,
  projectId: string
): Promise<void> {
  if (!answer.attributeType || !answer.attributeValue) {
    return;
  }

  // Analyze verification
  const verification = analyzeVerification(
    answer.answerText,
    answer.attributeType,
    answer.attributeValue
  );

  // Create AttributeVerification record
  try {
    await prisma.attributeVerification.create({
      data: {
        projectId,
        imageId: answer.linkedImageId || null,
        attributeType: answer.attributeType,
        aiValue: answer.attributeValue,
        verified: verification.verified,
        correctedValue: verification.correctedValue,
        designerResponse: answer.answerText,
        questionAsked: answer.questionId,
      },
    });
  } catch (error) {
    console.error('[processInterviewAnswers] Failed to create AttributeVerification:', error);
  }

  // Record Atelier signal for verified attributes
  if (verification.verified !== null) {
    await recordAtelierSignal({
      ownerType: AtelierOwnerType.DESIGNER,
      designerId,
      sourceType: AtelierSignalSourceType.INTERVIEW,
      sourceId: answer.answerId,
      key: `interview_verified_${answer.attributeType}`,
      weight: verification.verified ? 1.5 : 0.5,
      metadata: {
        value: verification.correctedValue || answer.attributeValue,
        attributeType: answer.attributeType,
        verified: verification.verified,
      },
    });
  }
}

/**
 * Process a single answer through the digestion pipeline.
 * Creates DesignerDecision records and emits Atelier signals
 * for ALL answers (not just ai_classification).
 */
async function digestAndRecordAnswer(
  answer: ProcessedAnswer,
  digest: AnswerDigest,
  designerId: string,
  projectId: string,
): Promise<{ decisionCreated: boolean }> {
  let decisionCreated = false;

  // Create DesignerDecision for answers with meaningful richness
  if (digest.richnessScore >= 0.4 && answer.answerText.length > 40) {
    try {
      const decisionType = answer.attributeType
        ? getDecisionType(answer.attributeType)
        : 'design_decision';

      await prisma.designerDecision.create({
        data: {
          designerId,
          projectId,
          decisionType,
          choice: answer.attributeValue || answer.questionCategory || 'interview_response',
          choiceType: answer.attributeType || null,
          imageId: answer.linkedImageId || null,
          reasoning: answer.answerText,
          convictionLevel: digest.richnessScore,
          captureSource: 'interview',
        },
      });
      decisionCreated = true;
    } catch (error) {
      console.error('[processInterviewAnswers] Failed to create DesignerDecision:', error);
    }
  }

  // Emit richness signal
  await recordAtelierSignal({
    ownerType: AtelierOwnerType.DESIGNER,
    designerId,
    sourceType: AtelierSignalSourceType.INTERVIEW,
    sourceId: answer.answerId,
    key: 'interview.answer.richness',
    weight: digest.richnessScore,
    metadata: {
      richnessScore: digest.richnessScore,
      isThin: digest.isThin,
      thinReason: digest.thinReason,
      questionType: answer.questionCategory,
      questionSource: answer.questionSource,
      specificityScore: digest.specificityScore,
    },
  });

  // Emit question effectiveness signal
  await recordAtelierSignal({
    ownerType: AtelierOwnerType.DESIGNER,
    designerId,
    sourceType: AtelierSignalSourceType.INTERVIEW,
    sourceId: answer.answerId,
    key: 'interview.question.effectiveness',
    weight: digest.richnessScore,
    metadata: {
      questionType: answer.questionCategory,
      questionText: answer.questionText?.slice(0, 200),
      questionSource: answer.questionSource,
      effectiveness: digest.questionEffectiveness,
      richnessScore: digest.richnessScore,
      projectId,
    },
  });

  // Emit vendor sentiment signals
  for (const vs of digest.vendorSentiments) {
    if (vs.sentiment === 'positive') {
      await recordAtelierSignal({
        ownerType: AtelierOwnerType.DESIGNER,
        designerId,
        sourceType: AtelierSignalSourceType.INTERVIEW,
        sourceId: answer.answerId,
        key: 'interview.answer.vendor_sentiment',
        weight: vs.boostEligible ? 2.0 : 1.0,
        metadata: {
          vendorName: vs.vendorName,
          sentiment: vs.sentiment,
          phrase: vs.phrase.slice(0, 200),
          boostEligible: vs.boostEligible,
          projectId,
        },
      });
    }
  }

  // Emit philosophy signals
  for (const signal of digest.philosophySignals) {
    await recordAtelierSignal({
      ownerType: AtelierOwnerType.DESIGNER,
      designerId,
      sourceType: AtelierSignalSourceType.INTERVIEW,
      sourceId: answer.answerId,
      key: 'interview.answer.philosophy',
      weight: 1.5,
      metadata: {
        statement: signal.slice(0, 500),
        projectId,
      },
    });
  }

  return { decisionCreated };
}

/**
 * Process all interview answers for a completed interview.
 *
 * Processes ALL answer types (base, contextual, follow-up) through the
 * digestion pipeline. Contextual answers also get attribute verification.
 */
export async function processInterviewAnswers(
  interviewId: string
): Promise<{ decisionsCreated: number; verificationsCreated: number; digestResults: { totalAnswers: number; avgRichness: number; thinCount: number } }> {
  // Fetch interview with answers and project
  const interview = await prisma.editorialInterview.findUnique({
    where: { id: interviewId },
    include: {
      answers: true,
      project: {
        select: {
          id: true,
          designerId: true,
          ownerId: true,
        },
      },
    },
  });

  if (!interview || !interview.project) {
    throw new Error('Interview or project not found');
  }

  const designerId = interview.project.designerId || interview.project.ownerId;
  if (!designerId) {
    throw new Error('No designer ID found for project');
  }

  let decisionsCreated = 0;
  let verificationsCreated = 0;
  let totalRichness = 0;
  let thinCount = 0;
  let answersProcessed = 0;

  for (const answer of interview.answers) {
    const answerText = answer.answerText || '';
    if (!answerText.trim()) continue;

    const processedAnswer: ProcessedAnswer = {
      answerId: answer.id,
      questionId: answer.questionId,
      answerText,
      questionSource: answer.questionSource as ProcessedAnswer['questionSource'],
      linkedImageId: answer.linkedImageId || undefined,
      linkedProductId: answer.linkedProductId || undefined,
      attributeType: answer.aiClassificationAttribute?.split(':')[0],
      attributeValue: answer.aiClassificationAttribute?.split(':')[1],
      questionText: answer.questionText || undefined,
      questionCategory: (answer as any).questionCategory || undefined,
      vendors: (answer as any).vendors || undefined,
      products: (answer as any).products || undefined,
      rooms: (answer as any).rooms || undefined,
    };

    // Run digestion on ALL answers
    const digestCtx = buildDigestContext({
      questionText: processedAnswer.questionText,
      questionType: processedAnswer.questionCategory,
      vendors: processedAnswer.vendors,
      products: processedAnswer.products,
      rooms: processedAnswer.rooms,
    });
    const digest = digestInterviewAnswer(answerText, digestCtx);
    answersProcessed++;
    totalRichness += digest.richnessScore;
    if (digest.isThin) thinCount++;

    // Record digestion signals and create DesignerDecision
    const { decisionCreated } = await digestAndRecordAnswer(
      processedAnswer,
      digest,
      designerId,
      interview.project.id,
    );
    if (decisionCreated) decisionsCreated++;

    // Contextual answers also get attribute verification (legacy behavior)
    if (
      answer.questionSource === 'ai_classification' &&
      processedAnswer.attributeType &&
      processedAnswer.attributeValue
    ) {
      await processContextualAnswer(
        processedAnswer,
        designerId,
        interview.project.id,
      );
      verificationsCreated++;
    }
  }

  // Emit interview completion summary signal
  const avgRichness = answersProcessed > 0 ? totalRichness / answersProcessed : 0;
  await recordAtelierSignal({
    ownerType: AtelierOwnerType.DESIGNER,
    designerId,
    sourceType: AtelierSignalSourceType.INTERVIEW,
    sourceId: interviewId,
    key: 'interview.completion',
    weight: avgRichness,
    metadata: {
      projectId: interview.project.id,
      totalAnswers: answersProcessed,
      avgRichness: Math.round(avgRichness * 100) / 100,
      thinCount,
      decisionsCreated,
      verificationsCreated,
    },
  });

  // Update designer voice profile stats
  await prisma.designerVoiceProfile.upsert({
    where: { designerId },
    create: {
      designerId,
      interviewAnswerCount: interview.answers.length,
      decisionReasoningCount: decisionsCreated,
    },
    update: {
      interviewAnswerCount: { increment: interview.answers.length },
      decisionReasoningCount: { increment: decisionsCreated },
      updatedAt: new Date(),
    },
  });

  return {
    decisionsCreated,
    verificationsCreated,
    digestResults: {
      totalAnswers: answersProcessed,
      avgRichness: Math.round(avgRichness * 100) / 100,
      thinCount,
    },
  };
}

import { prisma } from '@/lib/prisma';
import { recordAtelierSignal } from '@/lib/atelier/signals';
import { AtelierOwnerType, AtelierSignalSourceType } from '@prisma/client';
import { digestInterviewAnswer, type AnswerDigest, type QuestionContext } from '@/lib/interview/digestInterviewAnswer';

interface ProcessedAnswer {
  answerId: string;
  questionId: string;
  questionText?: string;
  answerText: string;
  questionSource: 'base_question' | 'ai_classification' | 'follow_up';
  linkedImageId?: string;
  linkedProductId?: string;
  attributeType?: string;
  attributeValue?: string;
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
function getDecisionType(attributeType: string): string {
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
  if (!answer.attributeType || !answer.attributeValue || !answer.linkedImageId) {
    return;
  }

  // Analyze verification
  const verification = analyzeVerification(
    answer.answerText,
    answer.attributeType,
    answer.attributeValue
  );

  // Create AttributeVerification record
  await prisma.attributeVerification.create({
    data: {
      imageId: answer.linkedImageId,
      designerId,
      attributeType: answer.attributeType,
      aiValue: answer.attributeValue,
      aiConfidence: 0.8, // Default AI confidence
      verified: verification.verified,
      correctedValue: verification.correctedValue,
      designerResponse: answer.answerText,
      interviewAnswerId: answer.answerId,
      questionAsked: answer.questionId,
    },
  });

  // Create DesignerDecision record if there's actual reasoning
  if (answer.answerText.length > 50) { // Meaningful answer threshold
    const decisionType = getDecisionType(answer.attributeType);
    const choiceValue = verification.correctedValue || answer.attributeValue;

    await prisma.designerDecision.create({
      data: {
        designerId,
        projectId,
        decisionType,
        choice: choiceValue,
        choiceType: answer.attributeType,
        imageId: answer.linkedImageId,
        reasoning: answer.answerText,
        convictionLevel: verification.confidence,
        captureSource: 'interview',
      },
    });
  }

  // Record Atelier signal for verified attributes
  if (verification.verified !== null) {
    try {
      await recordAtelierSignal({
        ownerType: AtelierOwnerType.DESIGNER,
        designerId,
        sourceType: AtelierSignalSourceType.INTERVIEW,
        sourceId: answer.answerId,
        key: `interview_verified_${answer.attributeType}`,
        value: verification.correctedValue || answer.attributeValue,
        weight: verification.verified ? 1.5 : 0.5, // Higher weight for confirmed
      });
    } catch (error) {
      // Non-blocking - signal recording shouldn't fail the process
      console.error('[processInterviewAnswers] Failed to record Atelier signal:', error);
    }
  }
}

/**
 * Record Atelier signals from answer digestion.
 * Non-blocking — all errors are logged and swallowed.
 */
async function recordDigestionSignals(
  digest: AnswerDigest,
  answer: ProcessedAnswer,
  designerId: string,
  projectId: string
): Promise<void> {
  const base = {
    ownerType: AtelierOwnerType.DESIGNER as const,
    designerId,
    sourceType: AtelierSignalSourceType.INTERVIEW as const,
    sourceId: answer.answerId,
  };

  // Richness signal — every answer
  await recordAtelierSignal({
    ...base,
    key: 'interview.answer.richness',
    weight: digest.richnessScore,
    metadata: {
      questionType: answer.questionSource,
      questionText: answer.questionText,
      richnessScore: digest.richnessScore,
      isThin: digest.isThin,
    },
  });

  // Philosophy signals (1st priority)
  for (const statement of digest.philosophySignals) {
    await recordAtelierSignal({
      ...base,
      key: 'interview.answer.philosophy',
      weight: 1.0,
      metadata: { statement, projectId, questionText: answer.questionText },
    });
  }

  // Pairing signals (2nd priority)
  for (const pairing of digest.pairingSignals) {
    await recordAtelierSignal({
      ...base,
      key: 'interview.answer.pairing',
      weight: 0.8,
      metadata: { products: pairing.products, reasoning: pairing.reasoning, projectId },
    });
  }

  // Vendor sentiment signals (3rd priority)
  for (const sentiment of digest.vendorSentiments) {
    if (sentiment.sentiment === 'positive') {
      await recordAtelierSignal({
        ...base,
        key: 'interview.answer.vendor_sentiment',
        weight: 0.9,
        metadata: {
          vendorName: sentiment.vendorName,
          phrase: sentiment.phrase,
          boostEligible: sentiment.boostEligible,
          projectId,
        },
      });
    }
  }

  // Client management signals (4th priority)
  for (const statement of digest.clientManagementSignals) {
    await recordAtelierSignal({
      ...base,
      key: 'interview.answer.client_management',
      weight: 0.6,
      metadata: { statement, projectId },
    });
  }

  // Question effectiveness signal
  await recordAtelierSignal({
    ...base,
    key: 'interview.question.effectiveness',
    weight: digest.richnessScore,
    metadata: {
      questionType: answer.questionSource,
      questionText: answer.questionText,
      richnessScore: digest.richnessScore,
    },
  });
}

/**
 * Process all interview answers for a completed interview
 */
export async function processInterviewAnswers(
  interviewId: string
): Promise<{ decisionsCreated: number; verificationsCreated: number }> {
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
          selections: {
            select: {
              productName: true,
              vendorName: true,
              room: { select: { name: true } },
            },
          },
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

  // Build question context for digestion from project selections
  const projectVendors = [...new Set(
    interview.project.selections
      .map((s) => s.vendorName)
      .filter((v): v is string => !!v)
  )];
  const projectProducts = [...new Set(
    interview.project.selections
      .map((s) => s.productName)
      .filter((p): p is string => !!p)
  )];
  const projectRooms = [...new Set(
    interview.project.selections
      .map((s) => s.room?.name)
      .filter((r): r is string => !!r)
  )];

  const questionContext: QuestionContext = {
    vendorNames: projectVendors,
    productNames: projectProducts,
    roomNames: projectRooms,
  };

  let decisionsCreated = 0;
  let verificationsCreated = 0;
  const digests: AnswerDigest[] = [];

  for (const answer of interview.answers) {
    const answerText = answer.answerText || '';
    if (!answerText.trim()) continue;

    const processedAnswer: ProcessedAnswer = {
      answerId: answer.id,
      questionId: answer.questionId,
      questionText: (answer as any).questionText || undefined,
      answerText,
      questionSource: answer.questionSource as any,
      linkedImageId: answer.linkedImageId || undefined,
      linkedProductId: answer.linkedProductId || undefined,
      attributeType: answer.aiClassificationAttribute?.split(':')[0],
      attributeValue: answer.aiClassificationAttribute?.split(':')[1],
    };

    // Run digestion on ALL answers (not just ai_classification)
    const digest = digestInterviewAnswer(answerText, questionContext);
    digests.push(digest);

    // Record digestion signals (non-blocking)
    try {
      await recordDigestionSignals(digest, processedAnswer, designerId, interview.project.id);
    } catch (error) {
      console.error('[processInterviewAnswers] Failed to record digestion signals:', error);
    }

    // Create DesignerDecision for all rich answers (richnessScore > 0.5)
    if (digest.richnessScore > 0.5 && answerText.length > 50) {
      try {
        await prisma.designerDecision.create({
          data: {
            designerId,
            projectId: interview.project.id,
            decisionType: processedAnswer.attributeType
              ? getDecisionType(processedAnswer.attributeType)
              : 'style_direction',
            choice: processedAnswer.attributeValue || 'interview_response',
            choiceType: processedAnswer.attributeType || 'interview',
            imageId: processedAnswer.linkedImageId,
            reasoning: answerText,
            convictionLevel: digest.richnessScore,
            captureSource: 'interview',
          },
        });
        decisionsCreated++;
      } catch (error) {
        console.error('[processInterviewAnswers] Failed to create DesignerDecision:', error);
      }
    }

    // Process contextual answers (ai_classification) for verification
    if (answer.questionSource === 'ai_classification') {
      if (processedAnswer.attributeType && processedAnswer.attributeValue) {
        await processContextualAnswer(
          processedAnswer,
          designerId,
          interview.project.id
        );
        verificationsCreated++;
      }
    }
  }

  // Record interview completion summary signal
  if (digests.length > 0) {
    const avgRichness = digests.reduce((sum, d) => sum + d.richnessScore, 0) / digests.length;
    const totalPhilosophy = digests.reduce((sum, d) => sum + d.philosophySignals.length, 0);
    const totalVendorSentiments = digests.reduce((sum, d) => sum + d.vendorSentiments.length, 0);
    const totalBoostEligible = digests.reduce(
      (sum, d) => sum + d.vendorSentiments.filter((v) => v.boostEligible).length,
      0
    );

    try {
      await recordAtelierSignal({
        ownerType: AtelierOwnerType.DESIGNER,
        designerId,
        sourceType: AtelierSignalSourceType.INTERVIEW,
        sourceId: interviewId,
        key: 'interview.completion',
        weight: avgRichness,
        metadata: {
          projectId: interview.project.id,
          totalQuestions: digests.length,
          avgRichnessScore: avgRichness,
          thinAnswerCount: digests.filter((d) => d.isThin).length,
          richAnswerCount: digests.filter((d) => d.richnessScore > 0.6).length,
          philosophySignalCount: totalPhilosophy,
          vendorSentimentCount: totalVendorSentiments,
          boostEligibleCount: totalBoostEligible,
        },
      });
    } catch (error) {
      console.error('[processInterviewAnswers] Failed to record completion signal:', error);
    }
  }

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

  return { decisionsCreated, verificationsCreated };
}

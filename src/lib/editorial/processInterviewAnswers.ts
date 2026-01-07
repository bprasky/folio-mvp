import { prisma } from '@/lib/prisma';
import { recordAtelierSignal } from '@/lib/atelier/signals';
import { AtelierOwnerType, AtelierSignalSourceType } from '@prisma/client';

interface ProcessedAnswer {
  answerId: string;
  questionId: string;
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
  // Note: Using PROJECT as sourceType since INTERVIEW may not exist in enum
  // The sourceId links to the answer, and we can identify it via the key pattern
  if (verification.verified !== null) {
    try {
      await recordAtelierSignal({
        ownerType: AtelierOwnerType.DESIGNER,
        designerId,
        sourceType: AtelierSignalSourceType.PROJECT, // Using PROJECT as fallback
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
  
  for (const answer of interview.answers) {
    // Skip if not a contextual question
    if (answer.questionSource !== 'ai_classification') {
      continue;
    }
    
    const processedAnswer: ProcessedAnswer = {
      answerId: answer.id,
      questionId: answer.questionId,
      answerText: answer.answerText || '',
      questionSource: answer.questionSource as any,
      linkedImageId: answer.linkedImageId || undefined,
      linkedProductId: answer.linkedProductId || undefined,
      attributeType: answer.aiClassificationAttribute?.split(':')[0],
      attributeValue: answer.aiClassificationAttribute?.split(':')[1],
    };
    
    if (processedAnswer.attributeType && processedAnswer.attributeValue) {
      await processContextualAnswer(
        processedAnswer,
        designerId,
        interview.project.id
      );
      
      verificationsCreated++;
      if (processedAnswer.answerText.length > 50) {
        decisionsCreated++;
      }
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


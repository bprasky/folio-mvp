import { prisma } from '@/lib/prisma';
import { ContextualQuestion } from './generateInterviewQuestions';

export interface InterviewResponseWithContext {
  questionId: string;
  question: string;
  answer: string;
  contextual?: ContextualQuestion;
}

export async function logAttributeVerifications(
  projectId: string,
  responses: InterviewResponseWithContext[]
) {
  // Filter to only contextual questions (verification opportunities)
  const contextualResponses = responses.filter(r => r.contextual);
  
  for (const response of contextualResponses) {
    const ctx = response.contextual!;
    
    // Analyze if the response confirms or corrects the attribute
    const { verified, correctedValue } = analyzeResponse(response.answer, ctx.attribute);
    
    // Log for training data
    await prisma.attributeVerification.create({
      data: {
        projectId,
        imageId: ctx.imageId || null,
        attributeType: ctx.attributeType,
        aiValue: ctx.attribute,
        verified,
        correctedValue,
        questionAsked: response.question,
        designerResponse: response.answer,
      },
    });
    
    // If verified with high confidence, could update MomentIndex
    // to mark this attribute as designer-verified
    if (verified === true && ctx.imageId) {
      await markAttributeVerified(ctx.imageId, ctx.attributeType, ctx.attribute);
    }
  }
}

function analyzeResponse(answer: string, attribute: string): {
  verified: boolean | null;
  correctedValue: string | null;
} {
  const answerLower = answer.toLowerCase();
  const attributeLower = attribute.toLowerCase();
  
  // Check for explicit corrections
  const correctionPatterns = [
    /actually (?:it's|it is|that's) (?:a |an |more )?(\w+)/i,
    /more of a (\w+)/i,
    /i'?d (?:call|describe) it (?:as )?(?:a |an )?(\w+)/i,
    /it's (?:really|technically) (?:a |an )?(\w+)/i,
    /not really (\w+)/i,
  ];
  
  for (const pattern of correctionPatterns) {
    const match = answer.match(pattern);
    if (match && match[1].toLowerCase() !== attributeLower) {
      return {
        verified: false,
        correctedValue: match[1].toLowerCase(),
      };
    }
  }
  
  // Check for confirmation signals
  const confirmationPatterns = [
    /yes/i,
    /exactly/i,
    /absolutely/i,
    /that's right/i,
    new RegExp(`love(?:d)? the \\w*${attributeLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
    new RegExp(`chose \\w*${attributeLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
    new RegExp(`wanted \\w*${attributeLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
    new RegExp(`the ${attributeLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
  ];
  
  // If they mention the attribute naturally in their answer, likely confirmed
  const mentionsAttribute = answerLower.includes(attributeLower);
  const hasConfirmationSignal = confirmationPatterns.some(p => p.test(answer));
  
  if (mentionsAttribute || hasConfirmationSignal) {
    return { verified: true, correctedValue: null };
  }
  
  // Can't determine - they answered but didn't clearly confirm or deny
  return { verified: null, correctedValue: null };
}

async function markAttributeVerified(
  imageId: string, 
  attributeType: string, 
  attribute: string
) {
  // Get current verified attributes
  const image = await prisma.projectImage.findUnique({
    where: { id: imageId },
    select: { verifiedAttributes: true },
  });
  
  const current = (image?.verifiedAttributes as Record<string, string[]>) || {};
  const typeArray = current[attributeType] || [];
  
  if (!typeArray.includes(attribute)) {
    typeArray.push(attribute);
  }
  
  await prisma.projectImage.update({
    where: { id: imageId },
    data: {
      verifiedAttributes: {
        ...current,
        [attributeType]: typeArray,
      },
      verifiedAt: new Date(),
    },
  });
}


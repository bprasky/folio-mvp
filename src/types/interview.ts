export interface InterviewQuestion {
  id: string;
  questionText: string;
  questionType: 'base' | 'contextual' | 'follow_up';
  source: 'base_question' | 'ai_classification' | 'follow_up';
  category?: string;
  // Contextual question metadata
  linkedImageId?: string;
  linkedProductId?: string;
  attributeType?: 'color' | 'material' | 'style' | 'mood' | 'element';
  attributeValue?: string;
  roomContext?: string;
  // Room pacing (Phase B)
  roomId?: string;
  isCrossRoom?: boolean;
}

export interface InterviewAnswer {
  questionId: string;
  answerText: string;
  // NEW FIELDS
  linkedImageId?: string;
  linkedProductId?: string;
  questionSource: 'base_question' | 'ai_classification' | 'follow_up';
  aiClassificationAttribute?: string; // e.g., "color:sage green"
}

export interface InterviewState {
  questions: InterviewQuestion[];
  answers: Record<string, InterviewAnswer>; // keyed by questionId
  currentQuestionIndex: number;
  status: 'idle' | 'loading' | 'in_progress' | 'completed';
}


export interface Suggestion {
  id: string;
  title: string;
  reason: string;
  impact: 'High' | 'Medium' | 'Test';
  actionLabel: string;
  actionType: 'upload' | 'promo' | 'message' | 'invite' | 'editorial';
  payload?: any;
}

export interface FocusContext {
  type: 'room' | 'city' | 'phase' | 'time' | 'designer' | 'product' | 'node';
  key: string;
  data?: any;
}










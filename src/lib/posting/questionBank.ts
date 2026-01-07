export type InterviewQuestion = {
  id: string;
  role: "DESIGNER" | "VENDOR" | "ANY";
  section: "why" | "who" | "what" | "where" | "when" | "how";
  prompt: string;
  helper?: string;
  maxLen?: number;
};

export const DEFAULT_QUESTION_BANK: InterviewQuestion[] = [
  // WHY – Intent & Emotion
  { id: "why-1", role: "DESIGNER", section: "why", prompt: "Why did this project matter to you personally or professionally?" },
  { id: "why-2", role: "DESIGNER", section: "why", prompt: "Why was this design direction the right one for the client or site?" },
  { id: "why-3", role: "DESIGNER", section: "why", prompt: "Why did you strip away or emphasize certain elements?" },
  { id: "why-4", role: "DESIGNER", section: "why", prompt: "Why should someone experience this space in person?" },

  // WHO – People & Collaboration
  { id: "who-1", role: "ANY", section: "who", prompt: "Who pushed the design further — a client, collaborator, or constraint?" },
  { id: "who-2", role: "ANY", section: "who", prompt: "Who surprised you during the process, and how?" },
  { id: "who-3", role: "DESIGNER", section: "who", prompt: "Who do you design for when no one's watching?" },
  { id: "who-4", role: "ANY", section: "who", prompt: "Who from your team deserves special recognition for this project?" },

  // WHAT – Form & Material (note: material facts come from tags; these prompts seek the why/how around them)
  { id: "what-1", role: "ANY", section: "what", prompt: "What decision or detail defines the project for you — and why?" },
  { id: "what-2", role: "ANY", section: "what", prompt: "What was the boldest risk you took, and how did it pay off?" },
  { id: "what-3", role: "ANY", section: "what", prompt: "What would you replicate in future work — or never repeat?" },

  // WHERE – Context & Setting
  { id: "where-1", role: "DESIGNER", section: "where", prompt: "Where does this project draw its sense of place from?" },
  { id: "where-2", role: "DESIGNER", section: "where", prompt: "Where inside the home or building do you feel the story peaks?" },
  { id: "where-3", role: "DESIGNER", section: "where", prompt: "Where did the local environment influence your material or color palette?" },

  // WHEN – Timing & Change
  { id: "when-1", role: "ANY", section: "when", prompt: "When did you know the design was finally resolved?" },
  { id: "when-2", role: "ANY", section: "when", prompt: "When did the biggest pivot occur — and why?" },
  { id: "when-3", role: "ANY", section: "when", prompt: "When you revisit this work years from now, what should still feel timeless?" },

  // HOW – Craft & Method
  { id: "how-1", role: "ANY", section: "how", prompt: "How did you balance concept and practicality in this build?" },
  { id: "how-2", role: "ANY", section: "how", prompt: "How did collaboration with vendors shape the final result?" },
  { id: "how-3", role: "ANY", section: "how", prompt: "How did you handle the project's toughest constraint or failure point?" },
];

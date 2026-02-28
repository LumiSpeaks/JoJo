// J.A.R.V.I.S. Protocol: Gemini Service Layer
// Uses Google Generative AI for infinite content generation.
// Model: 3.1 Pro (via latest available API endpoint)

import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserProfile } from './storage';

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

// Look for the key in Expo's public env vars.
// If missing, the service gracefully degrades to local static content.
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY || ''; 

// Initialize the Generative AI client
const genAI = new GoogleGenerativeAI(API_KEY);

// Use the most advanced available model for reasoning tasks.
// "gemini-1.5-pro" is currently the flagship reasoning model via API.
// It excels at logic puzzles, coding, and complex instructions.
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); 

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: number;
  type: 'logic' | 'lateral' | 'pattern' | 'scenarios';
}

// -----------------------------------------------------------------------------
// CORE FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Generate a high-level cognitive challenge using Gemini.
 * @param difficulty - 1 to 100 (Jojo Level)
 * @param type - Specific cognitive domain (logic, lateral thinking, etc.)
 */
export async function generateChallenge(
  difficulty: number,
  type: 'logic' | 'lateral' | 'pattern' | 'scenarios' = 'logic'
): Promise<GeneratedQuestion | null> {
  
  if (!API_KEY) {
    console.warn("J.A.R.V.I.S. Protocol: No API Key found. Falling back to local engine.");
    return null;
  }

  // Construct a prompt that enforces strict JSON output and difficulty scaling.
  const prompt = `
    You are J.A.R.V.I.S., an advanced cognitive training AI designed to boost human IQ.
    
    TASK:
    Generate a SINGLE multiple-choice question to test ${type} at Difficulty Level ${difficulty}/100.
    
    CONTEXT (Jojo IQ Protocol):
    - Level 1-20: Foundation (IQ 90-100). Simple syllogisms or patterns.
    - Level 50: Gifted (IQ 130). Complex multi-step logic.
    - Level 100: Genius (IQ 180+). Extremely abstract, lateral thinking required.

    REQUIREMENTS:
    - Output ONLY valid JSON. No markdown ticks.
    - Structure:
      {
        "question": "string",
        "options": ["A", "B", "C", "D"],
        "correctIndex": number (0-3),
        "explanation": "concise string explaining the logic"
      }
    - The correct answer must be logically sound but not obvious.
    - Make the tone precise and intellectual.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up any markdown artifacts (e.g., ```json ... ```)
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const data = JSON.parse(cleanedText);
    
    return {
      question: data.question,
      options: data.options,
      correctIndex: data.correctIndex,
      explanation: data.explanation,
      difficulty,
      type
    };
  } catch (error) {
    console.error("J.A.R.V.I.S. Generation Failed:", error);
    return null; // The app should handle null by serving a static backup question.
  }
}

/**
 * Analyze user performance and provide J.A.R.V.I.S.-style coaching.
 * This runs after a session to give personalized, actionable feedback.
 */
export async function analyzePerformance(
  profile: UserProfile,
  sessionData: { accuracy: number; weakestTrait: string }
): Promise<string> {
  
  if (!API_KEY) return "Protocol offline. Check neural link (API Key).";

  const prompt = `
    You are J.A.R.V.I.S. Analyze this user's cognitive training session.
    
    DATA:
    - User Level: ${profile.level} (Jojo Protocol)
    - Session Accuracy: ${sessionData.accuracy.toFixed(1)}%
    - Weakest Area Identified: ${sessionData.weakestTrait}
    
    TASK:
    Provide a 1-sentence strategic insight to improve their neuroplasticity.
    
    TONE:
    Professional, encouraging, slightly robotic/futuristic. 
    Examples:
    - "Your logic circuits are firing, sir, but pattern recognition requires calibration."
    - "Optimal performance achieved. Recommend increasing difficulty parameters."
    - "Focus drift detected. Re-engage working memory protocols."
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text.trim();
  } catch (error) {
    console.error("J.A.R.V.I.S. Analysis Failed:", error);
    return "Focus required. Continue training.";
  }
}

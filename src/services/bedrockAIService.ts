/**
 * AWS Bedrock AI Service for YourVibe
 * Menggunakan Claude untuk smart music recommendations
 */

// Types
export interface VibeContext {
  location: string;
  weather: string;
  timeOfDay: string;
  userInput?: string;
  listeningHistory?: string[];
  currentMood?: string;
}

export interface AIVibeAnalysis {
  mood: string;
  energy: 'low' | 'medium' | 'high';
  genres: string[];
  vibeDescription: string;
  playlistName: string;
  reasoning: string;
}

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// AWS Bedrock Configuration
const BEDROCK_CONFIG = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  // Untuk frontend, kita gunakan API Gateway sebagai proxy ke Bedrock
  apiEndpoint: import.meta.env.VITE_BEDROCK_API_ENDPOINT || '',
  apiKey: import.meta.env.VITE_BEDROCK_API_KEY || '',
  model: 'anthropic.claude-3-haiku-20240307-v1:0' // Fast & cost-effective
};

/**
 * Analyze user context and generate vibe recommendations using AI
 */
export const analyzeVibeWithAI = async (context: VibeContext): Promise<AIVibeAnalysis> => {
  const prompt = buildVibeAnalysisPrompt(context);
  
  try {
    // Jika API endpoint tersedia, gunakan Bedrock
    if (BEDROCK_CONFIG.apiEndpoint && BEDROCK_CONFIG.apiKey) {
      return await callBedrockAPI(prompt);
    }
    
    // Fallback ke rule-based analysis jika Bedrock tidak tersedia
    console.log('🤖 [BedrockAI] API not configured, using smart fallback');
    return generateSmartFallbackAnalysis(context);
  } catch (error) {
    console.error('❌ [BedrockAI] Error:', error);
    return generateSmartFallbackAnalysis(context);
  }
};

/**
 * Chat dengan AI untuk music discovery
 */
export const chatWithVibeAI = async (
  messages: AIChatMessage[],
  context: VibeContext
): Promise<string> => {
  const systemPrompt = buildChatSystemPrompt(context);
  
  try {
    if (BEDROCK_CONFIG.apiEndpoint && BEDROCK_CONFIG.apiKey) {
      return await callBedrockChatAPI(systemPrompt, messages);
    }
    
    // Fallback response
    return generateSmartChatResponse(messages[messages.length - 1]?.content || '', context);
  } catch (error) {
    console.error('❌ [BedrockAI] Chat error:', error);
    return generateSmartChatResponse(messages[messages.length - 1]?.content || '', context);
  }
};

/**
 * Build prompt for vibe analysis
 */
const buildVibeAnalysisPrompt = (context: VibeContext): string => {
  return `You are a music recommendation AI for YourVibe, a Web3 music platform.

Analyze the user's context and recommend the perfect music vibe.

USER CONTEXT:
- Location: ${context.location || 'Unknown'}
- Weather: ${context.weather || 'Unknown'}
- Time of Day: ${context.timeOfDay || 'Unknown'}
- User's Input: ${context.userInput || 'None'}
- Current Mood: ${context.currentMood || 'Not specified'}
- Recent Listening: ${context.listeningHistory?.join(', ') || 'None'}

Based on this context, provide a JSON response with:
{
  "mood": "detected mood (e.g., Relaxed, Energetic, Focused, Melancholic, Happy)",
  "energy": "low/medium/high",
  "genres": ["array of 3-5 recommended genres"],
  "vibeDescription": "A short, poetic description of the vibe (max 20 words)",
  "playlistName": "A creative playlist name",
  "reasoning": "Brief explanation of why these recommendations fit"
}

Respond ONLY with valid JSON, no additional text.`;
};

/**
 * Build system prompt for chat
 */
const buildChatSystemPrompt = (context: VibeContext): string => {
  return `You are VibeAI, a friendly music discovery assistant for YourVibe - a Web3 music platform on Somnia blockchain.

Your personality:
- Casual and friendly, like talking to a music-loving friend
- Knowledgeable about all music genres
- Enthusiastic but not over the top
- Use emojis sparingly (1-2 per message max)

Current user context:
- Location: ${context.location || 'Unknown'}
- Weather: ${context.weather || 'Unknown'}  
- Time: ${context.timeOfDay || 'Unknown'}

Your job:
1. Help users discover music based on their mood, activities, or preferences
2. Suggest genres, vibes, and music styles
3. Be conversational and ask follow-up questions
4. Keep responses concise (2-3 sentences max)

Remember: You're recommending vibes and genres, not specific songs (the app will match songs to your recommendations).`;
};

/**
 * Call Bedrock API via API Gateway
 */
const callBedrockAPI = async (prompt: string): Promise<AIVibeAnalysis> => {
  const response = await fetch(`${BEDROCK_CONFIG.apiEndpoint}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': BEDROCK_CONFIG.apiKey
    },
    body: JSON.stringify({
      model: BEDROCK_CONFIG.model,
      prompt,
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`Bedrock API error: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.completion || data.content);
};

/**
 * Call Bedrock Chat API
 */
const callBedrockChatAPI = async (
  systemPrompt: string,
  messages: AIChatMessage[]
): Promise<string> => {
  const response = await fetch(`${BEDROCK_CONFIG.apiEndpoint}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': BEDROCK_CONFIG.apiKey
    },
    body: JSON.stringify({
      model: BEDROCK_CONFIG.model,
      system: systemPrompt,
      messages,
      max_tokens: 300,
      temperature: 0.8
    })
  });

  if (!response.ok) {
    throw new Error(`Bedrock Chat API error: ${response.status}`);
  }

  const data = await response.json();
  return data.completion || data.content;
};

/**
 * Smart fallback analysis when Bedrock is not available
 * Uses enhanced rule-based logic
 */
const generateSmartFallbackAnalysis = (context: VibeContext): AIVibeAnalysis => {
  const hour = new Date().getHours();
  const weather = (context.weather || '').toLowerCase();
  const userInput = (context.userInput || '').toLowerCase();
  
  // Analyze user input for mood keywords
  const moodKeywords = {
    happy: ['happy', 'excited', 'great', 'amazing', 'party', 'celebrate'],
    sad: ['sad', 'down', 'lonely', 'heartbreak', 'miss', 'cry'],
    relaxed: ['relax', 'chill', 'calm', 'peace', 'rest', 'sleep'],
    focused: ['work', 'study', 'focus', 'concentrate', 'productive'],
    energetic: ['workout', 'gym', 'run', 'exercise', 'pump', 'energy']
  };

  let detectedMood = 'Chill';
  let energy: 'low' | 'medium' | 'high' = 'medium';
  let genres: string[] = [];

  // Check user input for mood
  for (const [mood, keywords] of Object.entries(moodKeywords)) {
    if (keywords.some(kw => userInput.includes(kw))) {
      detectedMood = mood.charAt(0).toUpperCase() + mood.slice(1);
      break;
    }
  }

  // Time-based adjustments
  if (hour >= 5 && hour < 9) {
    if (detectedMood === 'Chill') detectedMood = 'Energizing';
    energy = 'medium';
    genres = ['indie', 'pop', 'acoustic', 'lo-fi'];
  } else if (hour >= 9 && hour < 12) {
    if (detectedMood === 'Chill') detectedMood = 'Productive';
    energy = 'medium';
    genres = ['lo-fi', 'ambient', 'electronic', 'instrumental'];
  } else if (hour >= 12 && hour < 17) {
    if (detectedMood === 'Chill') detectedMood = 'Focused';
    energy = 'medium';
    genres = ['jazz', 'classical', 'ambient', 'lo-fi'];
  } else if (hour >= 17 && hour < 21) {
    if (detectedMood === 'Chill') detectedMood = 'Relaxing';
    energy = 'low';
    genres = ['chill', 'ambient', 'jazz', 'soul'];
  } else {
    detectedMood = 'Night Owl';
    energy = 'low';
    genres = ['ambient', 'electronic', 'lo-fi', 'downtempo'];
  }

  // Weather adjustments
  if (weather.includes('rain') || weather.includes('storm')) {
    genres = ['ambient', 'jazz', 'classical', 'piano'];
    if (detectedMood === 'Chill') detectedMood = 'Cozy';
  } else if (weather.includes('sun') || weather.includes('clear')) {
    if (energy === 'low') energy = 'medium';
    genres.push('pop', 'indie');
  }

  // Mood-specific overrides
  if (detectedMood === 'Happy' || detectedMood === 'Energetic') {
    energy = 'high';
    genres = ['pop', 'dance', 'edm', 'hip-hop', 'rock'];
  } else if (detectedMood === 'Sad') {
    energy = 'low';
    genres = ['acoustic', 'indie', 'piano', 'ambient'];
  } else if (detectedMood === 'Focused') {
    energy = 'medium';
    genres = ['lo-fi', 'ambient', 'classical', 'instrumental'];
  }

  // Generate vibe description
  const vibeDescriptions: Record<string, string[]> = {
    Happy: ['Sunshine in your ears', 'Good vibes only', 'Dancing through life'],
    Sad: ['Rainy day feelings', 'Melancholic melodies', 'Healing through music'],
    Relaxed: ['Floating on clouds', 'Peaceful moments', 'Zen state of mind'],
    Focused: ['In the zone', 'Deep work mode', 'Laser focus activated'],
    Energetic: ['Full throttle energy', 'Unstoppable momentum', 'Peak performance'],
    'Night Owl': ['Midnight vibes', 'After hours chill', 'Nocturnal sounds'],
    Cozy: ['Warm and fuzzy', 'Comfort sounds', 'Wrapped in melody'],
    Energizing: ['Rise and shine', 'Morning motivation', 'Fresh start energy'],
    Productive: ['Getting things done', 'Flow state', 'Momentum building'],
    Relaxing: ['Unwinding time', 'Evening serenity', 'Peaceful transition']
  };

  const descriptions = vibeDescriptions[detectedMood] || vibeDescriptions['Relaxed'];
  const vibeDescription = descriptions[Math.floor(Math.random() * descriptions.length)];

  // Generate playlist name
  const playlistNames: Record<string, string[]> = {
    Happy: ['Serotonin Boost', 'Happy Hour', 'Joy Ride'],
    Sad: ['Rainy Day Feels', 'Midnight Thoughts', 'Healing Hearts'],
    Relaxed: ['Chill Zone', 'Easy Listening', 'Peaceful Mind'],
    Focused: ['Deep Focus', 'Study Session', 'Work Mode'],
    Energetic: ['Power Hour', 'Beast Mode', 'Energy Surge'],
    'Night Owl': ['After Midnight', 'Night Drive', 'Insomnia Cure'],
    Cozy: ['Rainy Day Comfort', 'Cozy Corner', 'Warm Blanket Vibes'],
    Energizing: ['Morning Boost', 'Wake Up Call', 'Rise & Grind'],
    Productive: ['Flow State', 'Productivity Playlist', 'Get It Done'],
    Relaxing: ['Evening Wind Down', 'Sunset Chill', 'Decompress']
  };

  const names = playlistNames[detectedMood] || playlistNames['Relaxed'];
  const playlistName = names[Math.floor(Math.random() * names.length)];

  return {
    mood: detectedMood,
    energy,
    genres: [...new Set(genres)].slice(0, 5),
    vibeDescription,
    playlistName,
    reasoning: `Based on ${context.timeOfDay || 'current time'}${context.weather ? ` and ${context.weather} weather` : ''}${userInput ? `, plus your input about "${userInput}"` : ''}.`
  };
};

/**
 * Generate smart chat response without AI
 */
const generateSmartChatResponse = (userMessage: string, context: VibeContext): string => {
  const message = userMessage.toLowerCase();
  
  // Keyword-based responses
  if (message.includes('sad') || message.includes('down') || message.includes('heartbreak')) {
    return "I feel you 💙 Let me find some soothing tracks that'll help you process those feelings. How about some acoustic or ambient vibes?";
  }
  
  if (message.includes('party') || message.includes('dance') || message.includes('hype')) {
    return "Time to turn up! 🎉 I'll queue up some high-energy tracks. EDM, hip-hop, or pop - what's your flavor?";
  }
  
  if (message.includes('work') || message.includes('study') || message.includes('focus')) {
    return "Focus mode activated! I'll set you up with some lo-fi beats or ambient sounds. No lyrics to distract you 🎧";
  }
  
  if (message.includes('sleep') || message.includes('relax') || message.includes('chill')) {
    return "Winding down? Perfect. Let me find some ambient and chill tracks to help you relax ✨";
  }
  
  if (message.includes('workout') || message.includes('gym') || message.includes('run')) {
    return "Let's get that energy up! 💪 High BPM tracks coming your way. EDM or hip-hop?";
  }
  
  if (message.includes('morning') || message.includes('wake')) {
    return "Good morning! ☀️ Starting your day right with some uplifting indie and feel-good tracks.";
  }
  
  if (message.includes('night') || message.includes('late')) {
    return "Night owl vibes 🌙 I've got some perfect late-night ambient and electronic tracks for you.";
  }

  // Default contextual response
  const timeGreeting = context.timeOfDay?.toLowerCase().includes('morning') 
    ? "this morning" 
    : context.timeOfDay?.toLowerCase().includes('evening')
    ? "this evening"
    : "right now";
    
  return `What kind of vibe are you feeling ${timeGreeting}? Tell me about your mood or what you're doing, and I'll find the perfect soundtrack 🎵`;
};

export default {
  analyzeVibeWithAI,
  chatWithVibeAI
};

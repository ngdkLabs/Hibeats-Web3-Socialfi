/**
 * Cover Debug Logger
 * Utility untuk debugging cover generation dan stem separation
 */

export const coverDebugLogger = {
  logStatusResponse: (response: any) => {
    console.group("🔍 [COVER DEBUG] Status Response");
    console.log("Full Response:", response);
    console.log("Status:", response?.data?.status);
    console.log("Response Data:", response?.data?.response);
    console.log("Suno Data:", response?.data?.response?.sunoData);
    
    if (response?.data?.response?.sunoData) {
      const tracks = response.data.response.sunoData;
      console.log(`Found ${tracks.length} track(s)`);
      
      tracks.forEach((track: any, index: number) => {
        console.group(`Track ${index + 1}`);
        console.log("ID:", track.id);
        console.log("Title:", track.title);
        console.log("Audio URL:", track.audioUrl);
        console.log("Image URL:", track.imageUrl);
        console.log("Tags:", track.tags);
        console.log("Duration:", track.duration);
        console.log("Model:", track.modelName);
        console.groupEnd();
      });
    }
    console.groupEnd();
  },

  logCoveredMusic: (music: any) => {
    console.group("💾 [COVER DEBUG] Covered Music Data");
    console.log("Task ID:", music.taskId);
    console.log("Audio ID:", music.audioId);
    console.log("Title:", music.title);
    console.log("Audio URL:", music.audioUrl);
    console.log("Image URL:", music.imageUrl);
    console.log("Tags:", music.tags);
    console.log("Duration:", music.duration);
    console.log("Model:", music.modelName);
    console.groupEnd();
  },

  logStemSeparation: (request: any, response: any) => {
    console.group("🎵 [STEMS DEBUG] Separation Request/Response");
    console.log("Request:", request);
    console.log("Response:", response);
    console.log("Task ID:", response?.data?.taskId);
    console.groupEnd();
  },

  logStemStatus: (response: any) => {
    console.group("🔍 [STEMS DEBUG] Status Response");
    console.log("Full Response:", response);
    console.log("Success Flag:", response?.data?.successFlag);
    console.log("Response Data:", response?.data?.response);
    
    if (response?.data?.response) {
      const stems = response.data.response;
      const stemKeys = Object.keys(stems).filter(key => key.endsWith('Url') && stems[key]);
      
      console.log(`Found ${stemKeys.length} stem(s)`);
      stemKeys.forEach(key => {
        const name = key.replace('Url', '');
        console.log(`- ${name}:`, stems[key]);
      });
    }
    console.groupEnd();
  },

  logError: (context: string, error: any) => {
    console.group(`❌ [COVER DEBUG] Error in ${context}`);
    console.error("Error:", error);
    console.error("Message:", error?.message);
    console.error("Stack:", error?.stack);
    console.groupEnd();
  }
};

// Export untuk digunakan di console browser
if (typeof window !== 'undefined') {
  (window as any).coverDebugLogger = coverDebugLogger;
}

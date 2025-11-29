import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Music, Loader2, Download, Play, Pause, Upload, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { sunoApiService } from "@/services/sunoApiService";
import { coverDebugLogger } from "@/utils/coverDebugLogger";
import { coverHistoryService } from "@/services/coverHistoryService";
import type { CoverHistoryItem } from "@/services/coverHistoryService";
import CoverHistory from "@/components/CoverHistory";
import Navbar from "@/components/Navbar";

interface StemTrack {
  name: string;
  url: string;
  playing: boolean;
}

interface CoveredMusic {
  taskId: string;
  audioUrl: string;
  title: string;
  audioId?: string;
  imageUrl?: string;
  tags?: string;
  duration?: number;
  prompt?: string;
  modelName?: string;
}

export default function Cover() {
  const navigate = useNavigate();
  
  // Upload states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  
  // Cover generation settings
  const [coverSettings, setCoverSettings] = useState({
    prompt: "",
    style: "",
    title: "",
    customMode: true,
    instrumental: false,
    model: "V3_5" as "V3_5" | "V4" | "V4_5" | "V4_5PLUS" | "V5",
    vocalGender: "m" as "m" | "f",
    personaId: "",
    negativeTags: "",
    styleWeight: 0.65,
    weirdnessConstraint: 0.5,
    audioWeight: 0.65,
  });
  
  // Cover generation states
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);
  const [coveredMusic, setCoveredMusic] = useState<CoveredMusic | null>(null);
  
  // Separation states
  const [isSeparating, setIsSeparating] = useState(false);
  const [separationProgress, setSeparationProgress] = useState(0);
  const [separationType, setSeparationType] = useState<"separate_vocal" | "split_stem">("split_stem");
  const [stems, setStems] = useState<StemTrack[]>([]);
  
  // Audio playback
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  // Load covered music from localStorage on mount
  useEffect(() => {
    const savedMusic = localStorage.getItem('coveredMusic');
    if (savedMusic) {
      try {
        const parsed = JSON.parse(savedMusic);
        setCoveredMusic(parsed);
        console.log('Loaded covered music from localStorage:', parsed);
      } catch (error) {
        console.error('Failed to parse saved music:', error);
      }
    }
  }, []);

  // Save covered music to localStorage whenever it changes
  useEffect(() => {
    if (coveredMusic) {
      localStorage.setItem('coveredMusic', JSON.stringify(coveredMusic));
      console.log('Saved covered music to localStorage:', coveredMusic);
    }
  }, [coveredMusic]);

  // Load stems from localStorage on mount
  useEffect(() => {
    const savedStems = localStorage.getItem('coverStems');
    if (savedStems) {
      try {
        const parsed = JSON.parse(savedStems);
        setStems(parsed);
        console.log('Loaded stems from localStorage:', parsed);
      } catch (error) {
        console.error('Failed to parse saved stems:', error);
      }
    }
  }, []);

  // Save stems to localStorage whenever they change
  useEffect(() => {
    if (stems.length > 0) {
      localStorage.setItem('coverStems', JSON.stringify(stems));
      console.log('Saved stems to localStorage:', stems);
    }
  }, [stems]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        toast.error("Please select an audio file");
        return;
      }
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast.error("File size must be less than 50MB");
        return;
      }
      setUploadedFile(file);
      setUploadedUrl("");
      setCoveredMusic(null);
      localStorage.removeItem('coveredMusic');
      setStems([]);
      localStorage.removeItem('coverStems');
    }
  };

  const handleUpload = async () => {
    if (!uploadedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await sunoApiService.uploadFile(uploadedFile, "music/covers");
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.success && response.data) {
        setUploadedUrl(response.data.downloadUrl);
        toast.success("File uploaded successfully!");
      } else {
        throw new Error(response.msg || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateCover = async () => {
    if (!uploadedUrl) {
      toast.error("Please upload a file first");
      return;
    }

    // Validation
    if (coverSettings.customMode) {
      if (!coverSettings.style || !coverSettings.title) {
        toast.error("Style and Title are required in Custom Mode");
        return;
      }
      if (!coverSettings.instrumental && !coverSettings.prompt) {
        toast.error("Prompt is required when not instrumental");
        return;
      }
    } else {
      if (!coverSettings.prompt) {
        toast.error("Prompt is required");
        return;
      }
    }

    setIsGeneratingCover(true);
    setCoverProgress(0);

    try {
      const callbackUrl = `${window.location.origin}/api/callback/upload-cover`;
      const response = await sunoApiService.uploadAndCover({
        uploadUrl: uploadedUrl,
        prompt: coverSettings.prompt || undefined,
        style: coverSettings.style || undefined,
        title: coverSettings.title || undefined,
        customMode: coverSettings.customMode,
        instrumental: coverSettings.instrumental,
        model: coverSettings.model,
        vocalGender: coverSettings.vocalGender,
        personaId: coverSettings.personaId || undefined,
        negativeTags: coverSettings.negativeTags || undefined,
        styleWeight: coverSettings.styleWeight,
        weirdnessConstraint: coverSettings.weirdnessConstraint,
        audioWeight: coverSettings.audioWeight,
        callBackUrl: callbackUrl,
      });

      if (response.code === 200) {
        const genTaskId = response.data.taskId;
        console.log("[COVER] 🎵 Generation started, taskId:", genTaskId);
        localStorage.setItem('coverTaskId', genTaskId);
        toast.info("Cover generation started... This may take 5-15 minutes");
        
        let pollCount = 0;
        const maxPolls = 240; // 20 minutes
        
        const pollInterval = setInterval(async () => {
          pollCount++;
          
          if (pollCount % 12 === 0) {
            const minutes = Math.floor(pollCount * 5 / 60);
            console.log(`[COVER] ⏱️ ${minutes} minute(s) elapsed...`);
          }
          
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setIsGeneratingCover(false);
            console.error("[COVER] ⏰ Timeout after 20 minutes");
            toast.error("Generation timeout. Check Suno dashboard or try again.");
            return;
          }
          
          try {
            // Use direct Suno API check from the start
            const { sunoService } = await import("@/services/sunoService");
            const statusResponse = await sunoService.getTaskStatus(genTaskId);
            
            // Debug log full response
            coverDebugLogger.logStatusResponse(statusResponse);
            
            // Handle SUCCESS or FIRST_SUCCESS (first track completed)
            if (statusResponse.data.status === 'SUCCESS' || statusResponse.data.status === 'FIRST_SUCCESS') {
              const tracks = statusResponse.data.response?.sunoData;
              
              if (tracks && tracks.length > 0) {
                // Find first track with audio URL
                const track = tracks.find(t => t.audioUrl) || tracks[0];
                
                if (track && track.audioUrl) {
                  console.log("[COVER] ✅ Complete! Track:", track);
                  clearInterval(pollInterval);
                  setCoverProgress(100);
                  
                  const coveredMusicData: CoveredMusic = {
                    taskId: genTaskId,
                    audioUrl: track.audioUrl,
                    title: track.title || coverSettings.title || "Covered Audio",
                    audioId: track.id,
                    imageUrl: track.imageUrl,
                    tags: track.tags,
                    duration: track.duration,
                    prompt: track.prompt,
                    modelName: track.modelName,
                  };
                  
                  coverDebugLogger.logCoveredMusic(coveredMusicData);
                  setCoveredMusic(coveredMusicData);
                  
                  // Save to history
                  coverHistoryService.addToHistory({
                    taskId: coveredMusicData.taskId,
                    audioUrl: coveredMusicData.audioUrl,
                    title: coveredMusicData.title,
                    audioId: coveredMusicData.audioId,
                    imageUrl: coveredMusicData.imageUrl,
                    tags: coveredMusicData.tags,
                    duration: coveredMusicData.duration,
                    prompt: coveredMusicData.prompt,
                    modelName: coveredMusicData.modelName,
                    settings: coverSettings,
                  });
                  
                  setIsGeneratingCover(false);
                  clearCoverTaskId();
                  toast.success("Cover audio generated successfully!");
                } else {
                  // Track exists but no audio URL yet, continue polling
                  console.log("[COVER] ⏳ Track found but no audio URL yet, continuing...");
                  const progress = Math.min(10 + (pollCount * 0.5), 95);
                  setCoverProgress(progress);
                }
              } else {
                // No tracks yet, continue polling
                console.log("[COVER] ⏳ No tracks yet, continuing...");
                const progress = Math.min(10 + (pollCount * 0.5), 95);
                setCoverProgress(progress);
              }
            } else if (statusResponse.data.status === 'PENDING' || statusResponse.data.status === 'PROCESSING') {
              const progress = Math.min(10 + (pollCount * 0.5), 95);
              setCoverProgress(progress);
              if (pollCount % 12 === 0) {
                console.log("[COVER] ⏳ Still processing...");
              }
            } else if (statusResponse.data.status === 'FAILED') {
              console.error("[COVER] ❌ Generation failed");
              clearInterval(pollInterval);
              setIsGeneratingCover(false);
              clearCoverTaskId();
              toast.error("Cover generation failed");
            } else {
              // Unknown status, log and continue
              console.log("[COVER] ❓ Unknown status:", statusResponse.data.status);
              const progress = Math.min(10 + (pollCount * 0.5), 95);
              setCoverProgress(progress);
            }
          } catch (error) {
            coverDebugLogger.logError("Status Check", error);
            // Continue polling on temporary errors
          }
        }, 5000);
      } else {
        throw new Error(response.msg || "Cover generation failed");
      }
    } catch (error) {
      console.error("Cover generation error:", error);
      toast.error(`Failed to generate cover: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsGeneratingCover(false);
    }
  };

  const clearCoverTaskId = () => {
    localStorage.removeItem('coverTaskId');
  };

  const handleManualCheckCover = async (taskId: string) => {
    try {
      console.log("[COVER] 🔍 Manual check for taskId:", taskId);
      toast.loading("Checking Suno dashboard...", { id: 'manual-check' });
      
      const { sunoService } = await import("@/services/sunoService");
      const statusResponse = await sunoService.getTaskStatus(taskId);
      
      console.log("[COVER] 📊 Status response:", statusResponse);
      
      // Handle SUCCESS or FIRST_SUCCESS
      if (statusResponse.data.status === 'SUCCESS' || statusResponse.data.status === 'FIRST_SUCCESS') {
        const tracks = statusResponse.data.response?.sunoData;
        if (tracks && tracks.length > 0) {
          // Find first track with audio URL
          const track = tracks.find(t => t.audioUrl) || tracks[0];
          
          if (track && track.audioUrl) {
            const coveredMusicData: CoveredMusic = {
              taskId: taskId,
              audioUrl: track.audioUrl,
              title: track.title || coverSettings.title || "Covered Audio",
              audioId: track.id,
              imageUrl: track.imageUrl,
              tags: track.tags,
              duration: track.duration,
              prompt: track.prompt,
              modelName: track.modelName,
            };
            
            console.log("[COVER] ✅ Found completed cover:", coveredMusicData);
            setCoveredMusic(coveredMusicData);
            
            // Save to history
            coverHistoryService.addToHistory({
              taskId: coveredMusicData.taskId,
              audioUrl: coveredMusicData.audioUrl,
              title: coveredMusicData.title,
              audioId: coveredMusicData.audioId,
              imageUrl: coveredMusicData.imageUrl,
              tags: coveredMusicData.tags,
              duration: coveredMusicData.duration,
              prompt: coveredMusicData.prompt,
              modelName: coveredMusicData.modelName,
              settings: coverSettings,
            });
            
            setIsGeneratingCover(false);
            setCoverProgress(100);
            clearCoverTaskId();
            toast.success("Cover found and loaded!", { id: 'manual-check' });
          } else {
            toast.warning("Track found but no audio URL yet. Please wait...", { id: 'manual-check' });
          }
        } else {
          toast.error("No tracks found in response", { id: 'manual-check' });
        }
      } else if (statusResponse.data.status === 'PENDING' || statusResponse.data.status === 'PROCESSING') {
        toast.info(`Still processing... Status: ${statusResponse.data.status}`, { id: 'manual-check' });
      } else if (statusResponse.data.status === 'FAILED') {
        toast.error("Generation failed on Suno", { id: 'manual-check' });
        setIsGeneratingCover(false);
      } else {
        toast.warning(`Unknown status: ${statusResponse.data.status}`, { id: 'manual-check' });
      }
    } catch (error) {
      console.error("[COVER] ❌ Manual check failed:", error);
      toast.error(`Check failed: ${error.message}`, { id: 'manual-check' });
    }
  };

  const handleSeparate = async () => {
    if (!coveredMusic) {
      toast.error("Please generate cover first");
      return;
    }

    if (!coveredMusic.audioId) {
      toast.error("Audio ID not found. Please regenerate the cover.");
      console.error("Missing audioId in coveredMusic:", coveredMusic);
      return;
    }

    console.log("[STEMS] 🎵 Starting separation:", {
      taskId: coveredMusic.taskId,
      audioId: coveredMusic.audioId,
      type: separationType,
    });

    setIsSeparating(true);
    setSeparationProgress(0);

    try {
      const callbackUrl = `${window.location.origin}/api/callback/vocal-separation`;
      const response = await sunoApiService.separateVocals({
        taskId: coveredMusic.taskId,
        audioId: coveredMusic.audioId,
        type: separationType,
        callBackUrl: callbackUrl,
      });

      console.log("[STEMS] ✅ Started, taskId:", response.data.taskId);

      if (response.code === 200) {
        const separationTaskId = response.data.taskId;
        toast.info("Stem separation started... This may take 2-5 minutes");
        
        let pollCount = 0;
        const maxPolls = 240; // 20 minutes (240 × 5 seconds)
        
        const pollInterval = setInterval(async () => {
          pollCount++;
          
          // Show progress every 12 polls (1 minute)
          if (pollCount % 12 === 0) {
            const minutes = Math.floor(pollCount * 5 / 60);
            console.log(`[STEMS] ⏱️ ${minutes} minute(s) elapsed...`);
          }
          
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setIsSeparating(false);
            console.error("[STEMS] ⏰ Timeout after 20 minutes");
            toast.error("Separation timeout. Check Suno dashboard or try again.");
            return;
          }
          
          try {
            const status = await sunoApiService.getSeparationStatus(separationTaskId);
            
            if (status.data.successFlag === "SUCCESS") {
              console.log("[STEMS] ✅ Complete! Response:", status);
              clearInterval(pollInterval);
              setSeparationProgress(100);
              
              const stemTracks: StemTrack[] = [];
              const resp = status.data.response;
              
              const stemMapping = [
                { key: 'vocalUrl', name: 'Vocals' },
                { key: 'instrumentalUrl', name: 'Instrumental' },
                { key: 'backingVocalsUrl', name: 'Backing Vocals' },
                { key: 'drumsUrl', name: 'Drums' },
                { key: 'bassUrl', name: 'Bass' },
                { key: 'guitarUrl', name: 'Guitar' },
                { key: 'keyboardUrl', name: 'Keyboard' },
                { key: 'percussionUrl', name: 'Percussion' },
                { key: 'stringsUrl', name: 'Strings' },
                { key: 'synthUrl', name: 'Synth' },
                { key: 'fxUrl', name: 'FX' },
                { key: 'brassUrl', name: 'Brass' },
                { key: 'woodwindsUrl', name: 'Woodwinds' },
              ];
              
              stemMapping.forEach(({ key, name }) => {
                const url = resp[key as keyof typeof resp];
                if (url && typeof url === 'string') {
                  stemTracks.push({ name, url, playing: false });
                }
              });
              
              console.log("[STEMS] 💾 Extracted", stemTracks.length, "stems");
              setStems(stemTracks);
              setIsSeparating(false);
              toast.success(`Separation complete! ${stemTracks.length} stems ready`);
            } else if (status.data.successFlag === "PENDING") {
              setSeparationProgress((prev) => Math.min(prev + 5, 95));
            } else if (
              status.data.successFlag === "CREATE_TASK_FAILED" || 
              status.data.successFlag === "GENERATE_AUDIO_FAILED" || 
              status.data.successFlag === "CALLBACK_EXCEPTION"
            ) {
              console.error("[STEMS] ❌ Failed:", status.data.errorMessage);
              clearInterval(pollInterval);
              setIsSeparating(false);
              toast.error(status.data.errorMessage || "Separation failed");
            } else if (pollCount > 60) {
              // After 5 minutes, try checking again with fresh request
              console.log("[STEMS] 🔍 Re-checking separation status...");
              setSeparationProgress((prev) => Math.min(prev + 2, 95));
            }
          } catch (error) {
            console.error("[STEMS] ❌ Error:", error);
            // Don't stop on temporary errors, continue polling
            if (pollCount < maxPolls - 10) {
              console.log("[STEMS] ⚠️ Temporary error, continuing to poll...");
            } else {
              clearInterval(pollInterval);
              setIsSeparating(false);
              toast.error("Failed to check separation status");
            }
          }
        }, 5000);
      } else {
        throw new Error(response.msg || "Separation failed");
      }
    } catch (error) {
      console.error("Separation error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes("Record does not exist") || errorMessage.includes("does not exist")) {
        toast.error("This music cannot be processed. It may not be from Suno's system or the taskId is invalid.");
      } else {
        toast.error(`Failed to separate audio: ${errorMessage}`);
      }
      
      setIsSeparating(false);
    }
  };

  const toggleStemPlayback = (index: number) => {
    const stem = stems[index];
    
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }

    if (stem.playing) {
      setStems(stems.map((s, i) => i === index ? { ...s, playing: false } : s));
    } else {
      const audio = new Audio(stem.url);
      audio.play();
      setCurrentAudio(audio);
      
      audio.onended = () => {
        setStems(stems.map((s, i) => i === index ? { ...s, playing: false } : s));
        setCurrentAudio(null);
      };
      
      setStems(stems.map((s, i) => i === index ? { ...s, playing: true } : { ...s, playing: false }));
    }
  };

  const downloadStem = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.mp3`;
    a.click();
  };

  // History handlers
  const handleLoadCoverFromHistory = (item: CoverHistoryItem) => {
    const coveredMusicData: CoveredMusic = {
      taskId: item.taskId,
      audioUrl: item.audioUrl,
      title: item.title,
      audioId: item.audioId,
      imageUrl: item.imageUrl,
      tags: item.tags,
      duration: item.duration,
      prompt: item.prompt,
      modelName: item.modelName,
    };
    
    setCoveredMusic(coveredMusicData);
    setCoverSettings({
      prompt: item.prompt || "",
      style: item.settings.style || "",
      title: item.title,
      customMode: item.settings.customMode,
      instrumental: item.settings.instrumental,
      model: item.settings.model as "V3_5" | "V4" | "V4_5" | "V4_5PLUS" | "V5",
      vocalGender: item.settings.vocalGender as "m" | "f",
      personaId: item.settings.personaId || "",
      negativeTags: item.settings.negativeTags || "",
      styleWeight: item.settings.styleWeight,
      weirdnessConstraint: item.settings.weirdnessConstraint,
      audioWeight: item.settings.audioWeight,
    });
    toast.success(`Loaded: ${item.title}`);
    
    // Scroll to covered music section
    setTimeout(() => {
      document.querySelector('[data-section="covered-music"]')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSeparateStemsFromHistory = async (item: CoverHistoryItem) => {
    if (!item.audioId) {
      toast.error("Cannot separate stems: Audio ID not available for this cover");
      return;
    }

    // Load cover first
    const coveredMusicData: CoveredMusic = {
      taskId: item.taskId,
      audioUrl: item.audioUrl,
      title: item.title,
      audioId: item.audioId,
      imageUrl: item.imageUrl,
      tags: item.tags,
      duration: item.duration,
      prompt: item.prompt,
      modelName: item.modelName,
    };
    
    setCoveredMusic(coveredMusicData);
    toast.info(`Loading: ${item.title}`);

    // Start separation immediately
    setIsSeparating(true);
    setSeparationProgress(0);

    try {
      const callbackUrl = `${window.location.origin}/api/callback/vocal-separation`;
      const response = await sunoApiService.separateVocals({
        taskId: item.taskId,
        audioId: item.audioId,
        type: separationType,
        callBackUrl: callbackUrl,
      });

      console.log("[STEMS] ✅ Started from history, taskId:", response.data.taskId);

      if (response.code === 200) {
        const separationTaskId = response.data.taskId;
        toast.info("Stem separation started... This may take 2-5 minutes");
        
        let pollCount = 0;
        const maxPolls = 240;
        
        const pollInterval = setInterval(async () => {
          pollCount++;
          
          if (pollCount % 12 === 0) {
            const minutes = Math.floor(pollCount * 5 / 60);
            console.log(`[STEMS] ⏱️ ${minutes} minute(s) elapsed...`);
          }
          
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setIsSeparating(false);
            console.error("[STEMS] ⏰ Timeout after 20 minutes");
            toast.error("Separation timeout. Check Suno dashboard or try again.");
            return;
          }
          
          try {
            const status = await sunoApiService.getSeparationStatus(separationTaskId);
            
            if (status.data.successFlag === "SUCCESS") {
              console.log("[STEMS] ✅ Complete! Response:", status);
              clearInterval(pollInterval);
              setSeparationProgress(100);
              
              const stemTracks: StemTrack[] = [];
              const resp = status.data.response;
              
              const stemMapping = [
                { key: 'vocalUrl', name: 'Vocals' },
                { key: 'instrumentalUrl', name: 'Instrumental' },
                { key: 'backingVocalsUrl', name: 'Backing Vocals' },
                { key: 'drumsUrl', name: 'Drums' },
                { key: 'bassUrl', name: 'Bass' },
                { key: 'guitarUrl', name: 'Guitar' },
                { key: 'keyboardUrl', name: 'Keyboard' },
                { key: 'percussionUrl', name: 'Percussion' },
                { key: 'stringsUrl', name: 'Strings' },
                { key: 'synthUrl', name: 'Synth' },
                { key: 'fxUrl', name: 'FX' },
                { key: 'brassUrl', name: 'Brass' },
                { key: 'woodwindsUrl', name: 'Woodwinds' },
              ];
              
              stemMapping.forEach(({ key, name }) => {
                const url = resp[key as keyof typeof resp];
                if (url && typeof url === 'string') {
                  stemTracks.push({ name, url, playing: false });
                }
              });
              
              console.log("[STEMS] 💾 Extracted", stemTracks.length, "stems");
              setStems(stemTracks);
              setIsSeparating(false);
              toast.success(`Separation complete! ${stemTracks.length} stems ready`);
              
              // Scroll to stems section
              setTimeout(() => {
                document.querySelector('[data-section="stems"]')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            } else if (status.data.successFlag === "PENDING") {
              setSeparationProgress((prev) => Math.min(prev + 5, 95));
            } else if (
              status.data.successFlag === "CREATE_TASK_FAILED" || 
              status.data.successFlag === "GENERATE_AUDIO_FAILED" || 
              status.data.successFlag === "CALLBACK_EXCEPTION"
            ) {
              console.error("[STEMS] ❌ Failed:", status.data.errorMessage);
              clearInterval(pollInterval);
              setIsSeparating(false);
              toast.error(status.data.errorMessage || "Separation failed");
            }
          } catch (error) {
            console.error("[STEMS] ❌ Error:", error);
            if (pollCount >= maxPolls - 10) {
              clearInterval(pollInterval);
              setIsSeparating(false);
              toast.error("Failed to check separation status");
            }
          }
        }, 5000);
      } else {
        throw new Error(response.msg || "Separation failed");
      }
    } catch (error) {
      console.error("Separation error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to separate audio: ${errorMessage}`);
      setIsSeparating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold">Cover Studio</h1>
            {coveredMusic && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.removeItem('coveredMusic');
                  localStorage.removeItem('coverStems');
                  setCoveredMusic(null);
                  setStems([]);
                  toast.info("Cleared saved data");
                }}
              >
                Clear Saved Data
              </Button>
            )}
          </div>
          <p className="text-muted-foreground mb-4">
            Upload your audio, generate a cover version, and separate it into individual stems
          </p>
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              ℹ️ Upload audio (max 2 minutes), generate a cover with new style, then separate into stems for remixing
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>1. Upload Audio</CardTitle>
              <CardDescription>Upload your audio file (max 2 minutes, 50MB)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="audio-upload"
                  disabled={isUploading}
                />
                <label htmlFor="audio-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">
                    {uploadedFile ? uploadedFile.name : "Click to upload audio"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    MP3, WAV, FLAC (max 2 min, 50MB)
                  </p>
                </label>
              </div>

              {uploadedFile && !uploadedUrl && (
                <Button 
                  onClick={handleUpload} 
                  disabled={isUploading}
                  className="w-full"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload File
                    </>
                  )}
                </Button>
              )}

              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-xs text-center text-muted-foreground">
                    {uploadProgress}% uploaded
                  </p>
                </div>
              )}

              {uploadedUrl && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-2">
                    ✓ File uploaded successfully
                  </p>
                  <audio controls className="w-full">
                    <source src={uploadedUrl} />
                  </audio>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cover Settings */}
          <Card>
            <CardHeader>
              <CardTitle>2. Cover Settings</CardTitle>
              <CardDescription>Configure how to cover your audio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="custom-mode">Custom Mode</Label>
                <Switch
                  id="custom-mode"
                  checked={coverSettings.customMode}
                  onCheckedChange={(checked) =>
                    setCoverSettings({ ...coverSettings, customMode: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="instrumental">Instrumental (No Lyrics)</Label>
                <Switch
                  id="instrumental"
                  checked={coverSettings.instrumental}
                  onCheckedChange={(checked) =>
                    setCoverSettings({ ...coverSettings, instrumental: checked })
                  }
                />
              </div>

              {coverSettings.customMode && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      placeholder="My Cover Song"
                      value={coverSettings.title}
                      onChange={(e) =>
                        setCoverSettings({ ...coverSettings, title: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="style">Style *</Label>
                    <Input
                      id="style"
                      placeholder="Jazz, Classical, Electronic..."
                      value={coverSettings.style}
                      onChange={(e) =>
                        setCoverSettings({ ...coverSettings, style: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {(!coverSettings.customMode || !coverSettings.instrumental) && (
                <div className="space-y-2">
                  <Label htmlFor="prompt">
                    {coverSettings.customMode ? "Lyrics *" : "Prompt *"}
                  </Label>
                  <Textarea
                    id="prompt"
                    placeholder={
                      coverSettings.customMode
                        ? "Enter exact lyrics..."
                        : "Describe the desired audio..."
                    }
                    value={coverSettings.prompt}
                    onChange={(e) =>
                      setCoverSettings({ ...coverSettings, prompt: e.target.value })
                    }
                    rows={4}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select
                    value={coverSettings.model}
                    onValueChange={(value: any) =>
                      setCoverSettings({ ...coverSettings, model: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="V3_5">V3.5</SelectItem>
                      <SelectItem value="V4">V4</SelectItem>
                      <SelectItem value="V4_5">V4.5</SelectItem>
                      <SelectItem value="V4_5PLUS">V4.5 Plus</SelectItem>
                      <SelectItem value="V5">V5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vocal-gender">Vocal Gender</Label>
                  <Select
                    value={coverSettings.vocalGender}
                    onValueChange={(value: any) =>
                      setCoverSettings({ ...coverSettings, vocalGender: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m">Male</SelectItem>
                      <SelectItem value="f">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Separator */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">Advanced Settings</h3>
                
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">Basic</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Basic settings are configured above. Switch to Advanced for more control.
                    </p>
                  </TabsContent>
                  
                  <TabsContent value="advanced" className="space-y-4 mt-4">
                    {coverSettings.customMode && (
                    <div className="space-y-2">
                      <Label htmlFor="persona-id">
                        Persona ID <span className="text-xs text-muted-foreground">(Optional)</span>
                      </Label>
                      <Input
                        id="persona-id"
                        placeholder="persona_123"
                        value={coverSettings.personaId}
                        onChange={(e) =>
                          setCoverSettings({ ...coverSettings, personaId: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Apply a specific persona style to your music generation
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="negative-tags">
                      Negative Tags <span className="text-xs text-muted-foreground">(Optional)</span>
                    </Label>
                    <Input
                      id="negative-tags"
                      placeholder="Heavy Metal, Upbeat Drums, Distortion..."
                      value={coverSettings.negativeTags}
                      onChange={(e) =>
                        setCoverSettings({ ...coverSettings, negativeTags: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Styles or traits to exclude from the generated audio
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="style-weight">Style Weight</Label>
                      <span className="text-sm font-medium">{coverSettings.styleWeight.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      id="style-weight"
                      min="0"
                      max="1"
                      step="0.01"
                      value={coverSettings.styleWeight}
                      onChange={(e) =>
                        setCoverSettings({ ...coverSettings, styleWeight: parseFloat(e.target.value) })
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <p className="text-xs text-muted-foreground">
                      Control the weight of style guidance (0 = minimal, 1 = maximum)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="weirdness">Weirdness / Creativity</Label>
                      <span className="text-sm font-medium">{coverSettings.weirdnessConstraint.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      id="weirdness"
                      min="0"
                      max="1"
                      step="0.01"
                      value={coverSettings.weirdnessConstraint}
                      onChange={(e) =>
                        setCoverSettings({ ...coverSettings, weirdnessConstraint: parseFloat(e.target.value) })
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <p className="text-xs text-muted-foreground">
                      Control creative deviation (0 = conservative, 1 = experimental)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="audio-weight">Audio Influence</Label>
                      <span className="text-sm font-medium">{coverSettings.audioWeight.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      id="audio-weight"
                      min="0"
                      max="1"
                      step="0.01"
                      value={coverSettings.audioWeight}
                      onChange={(e) =>
                        setCoverSettings({ ...coverSettings, audioWeight: parseFloat(e.target.value) })
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <p className="text-xs text-muted-foreground">
                      Control how much the input audio influences the output (0 = minimal, 1 = maximum)
                    </p>
                  </div>

                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      💡 <strong>Tip:</strong> Start with default values (0.5-0.65) and adjust based on results. 
                      Higher values = stronger influence, lower values = more freedom.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generate Cover Button */}
        {uploadedUrl && !coveredMusic && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Button
                onClick={handleGenerateCover}
                disabled={isGeneratingCover}
                className="w-full"
                size="lg"
              >
                {isGeneratingCover ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Cover... {coverProgress}%
                  </>
                ) : (
                  <>
                    <Music className="w-4 h-4 mr-2" />
                    Generate Cover Version
                  </>
                )}
              </Button>

              {isGeneratingCover && (
                <>
                  <Progress value={coverProgress} />
                  <p className="text-xs text-center text-muted-foreground">
                    Check browser console for detailed logs
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Get taskId from state or localStorage
                        const savedMusic = localStorage.getItem('coverTaskId');
                        if (savedMusic) {
                          handleManualCheckCover(savedMusic);
                        } else {
                          toast.error("Task ID not found. Please wait for generation to complete.");
                        }
                      }}
                      className="flex-1"
                    >
                      <RefreshCw className="w-3 h-3 mr-2" />
                      Check Status Now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open('https://suno.com/dashboard', '_blank')}
                      className="flex-1"
                    >
                      <ExternalLink className="w-3 h-3 mr-2" />
                      Open Suno Dashboard
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Covered Music Result */}
        {coveredMusic && (
          <Card data-section="covered-music">
            <CardHeader>
              <CardTitle>3. Covered Audio</CardTitle>
              <CardDescription>Your audio has been covered with new style</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Cover Image */}
                {coveredMusic.imageUrl && (
                  <div className="space-y-2">
                    <Label>Cover Image</Label>
                    <img
                      src={coveredMusic.imageUrl}
                      alt={coveredMusic.title}
                      className="w-full rounded-lg border"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = coveredMusic.imageUrl!;
                        a.download = `${coveredMusic.title}-cover.jpg`;
                        a.click();
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Cover
                    </Button>
                  </div>
                )}
                
                {/* Audio Player */}
                <div className="space-y-2">
                  <Label>Covered Audio</Label>
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-2">
                      ✓ {coveredMusic.title}
                    </p>
                    {coveredMusic.tags && (
                      <p className="text-xs text-muted-foreground mb-2">
                        🏷️ {coveredMusic.tags}
                      </p>
                    )}
                    {coveredMusic.duration && (
                      <p className="text-xs text-muted-foreground mb-2">
                        ⏱️ {Math.floor(coveredMusic.duration / 60)}:{Math.floor(coveredMusic.duration % 60).toString().padStart(2, '0')}
                      </p>
                    )}
                    {coveredMusic.modelName && (
                      <p className="text-xs text-muted-foreground mb-2">
                        🤖 Model: {coveredMusic.modelName}
                      </p>
                    )}
                    <audio controls className="w-full mt-2">
                      <source src={coveredMusic.audioUrl} />
                    </audio>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = coveredMusic.audioUrl;
                      a.download = `${coveredMusic.title}.mp3`;
                      a.click();
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Audio
                  </Button>
                </div>
              </div>

              {/* Debug Info */}
              <div className="p-3 bg-muted rounded-lg text-xs">
                <p className="font-medium mb-1">Debug Info:</p>
                <p>Task ID: {coveredMusic.taskId}</p>
                <p>Audio ID: {coveredMusic.audioId || "Not available"}</p>
                {!coveredMusic.audioId && (
                  <p className="text-red-500 mt-1">⚠️ Audio ID missing - separation may fail</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Separation Section */}
        {coveredMusic && (
          <Card>
            <CardHeader>
              <CardTitle>4. Separate Stems</CardTitle>
              <CardDescription>Split covered audio into individual tracks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={separationType} onValueChange={(v) => setSeparationType(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="split_stem">Full Stems</TabsTrigger>
                  <TabsTrigger value="separate_vocal">Vocal Only</TabsTrigger>
                </TabsList>
                <TabsContent value="split_stem" className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Separate into: Vocals, Backing Vocals, Drums, Bass, Guitar, Keyboard, 
                    Percussion, Strings, Synth, FX, Brass, Woodwinds
                  </p>
                </TabsContent>
                <TabsContent value="separate_vocal" className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Separate into: Vocals and Instrumental tracks only
                  </p>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2">
                <Button
                  onClick={handleSeparate}
                  disabled={isSeparating || stems.length > 0}
                  className="flex-1"
                >
                  {isSeparating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Separating...
                    </>
                  ) : stems.length > 0 ? (
                    <>
                      <Music className="w-4 h-4 mr-2" />
                      Stems Ready
                    </>
                  ) : (
                    <>
                      <Music className="w-4 h-4 mr-2" />
                      Separate Stems
                    </>
                  )}
                </Button>
                {stems.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => navigate('/stems', { state: { stems, coveredMusic } })}
                  >
                    View in Stems Page
                  </Button>
                )}
              </div>

              {isSeparating && (
                <div className="space-y-2">
                  <Progress value={separationProgress} />
                  <p className="text-xs text-center text-muted-foreground">
                    Processing audio... {separationProgress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stems Display */}
        {stems.length > 0 && (
          <Card data-section="stems">
            <CardHeader>
              <CardTitle>5. Your Stems</CardTitle>
              <CardDescription>
                Play, download, or use these stems for your cover
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stems.map((stem, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleStemPlayback(index)}
                      >
                        {stem.playing ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <span className="font-medium text-sm">{stem.name}</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => downloadStem(stem.url, stem.name)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cover History */}
        <div className="mt-8">
          <CoverHistory
            onLoadCover={handleLoadCoverFromHistory}
            onSeparateStems={handleSeparateStemsFromHistory}
          />
        </div>
      </div>
    </div>
  );
}

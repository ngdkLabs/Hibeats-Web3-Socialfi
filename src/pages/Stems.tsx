import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Music, Loader2, Download, Play, Pause, ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

interface StemTrack {
  name: string;
  url: string;
  playing: boolean;
  volume: number;
  audio?: HTMLAudioElement;
  muted: boolean;
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

export default function Stems() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [stems, setStems] = useState<StemTrack[]>([]);
  const [coveredMusic, setCoveredMusic] = useState<CoveredMusic | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(100);

  // Load stems from location state or localStorage
  useEffect(() => {
    if (location.state?.stems && location.state?.coveredMusic) {
      const loadedStems = location.state.stems.map((stem: any) => ({
        ...stem,
        volume: 100,
        muted: false,
      }));
      setStems(loadedStems);
      setCoveredMusic(location.state.coveredMusic);
    } else {
      // Try loading from localStorage
      const savedStems = localStorage.getItem('coverStems');
      const savedMusic = localStorage.getItem('coveredMusic');
      
      if (savedStems && savedMusic) {
        try {
          const parsedStems = JSON.parse(savedStems).map((stem: any) => ({
            ...stem,
            volume: 100,
            muted: false,
          }));
          setStems(parsedStems);
          setCoveredMusic(JSON.parse(savedMusic));
        } catch (error) {
          console.error('Failed to parse saved data:', error);
          toast.error("No stems found. Please generate stems first.");
        }
      } else {
        toast.error("No stems found. Please generate stems first.");
      }
    }
  }, [location.state]);

  // Initialize audio elements for each stem
  useEffect(() => {
    if (stems.length > 0 && !stems[0].audio) {
      const updatedStems = stems.map(stem => {
        const audio = new Audio(stem.url);
        audio.volume = stem.volume / 100;
        audio.loop = true;
        return { ...stem, audio };
      });
      setStems(updatedStems);
    }
  }, [stems]);

  const togglePlayAll = () => {
    if (isPlaying) {
      // Pause all
      stems.forEach(stem => {
        if (stem.audio) {
          stem.audio.pause();
        }
      });
      setIsPlaying(false);
    } else {
      // Play all
      stems.forEach(stem => {
        if (stem.audio && !stem.muted) {
          stem.audio.currentTime = 0;
          stem.audio.play().catch(err => console.error('Play error:', err));
        }
      });
      setIsPlaying(true);
    }
  };

  const toggleStemMute = (index: number) => {
    const updatedStems = [...stems];
    updatedStems[index].muted = !updatedStems[index].muted;
    
    if (updatedStems[index].audio) {
      if (updatedStems[index].muted) {
        updatedStems[index].audio!.pause();
      } else if (isPlaying) {
        updatedStems[index].audio!.play().catch(err => console.error('Play error:', err));
      }
    }
    
    setStems(updatedStems);
  };

  const updateStemVolume = (index: number, volume: number) => {
    const updatedStems = [...stems];
    updatedStems[index].volume = volume;
    
    if (updatedStems[index].audio) {
      updatedStems[index].audio!.volume = (volume / 100) * (masterVolume / 100);
    }
    
    setStems(updatedStems);
  };

  const updateMasterVolume = (volume: number) => {
    setMasterVolume(volume);
    
    // Update all stem volumes
    stems.forEach(stem => {
      if (stem.audio) {
        stem.audio.volume = (stem.volume / 100) * (volume / 100);
      }
    });
  };

  const downloadStem = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.mp3`;
    a.click();
    toast.success(`Downloading ${name}...`);
  };

  const downloadAllStems = () => {
    stems.forEach(stem => {
      setTimeout(() => downloadStem(stem.url, stem.name), 100);
    });
    toast.success("Downloading all stems...");
  };

  const soloStem = (index: number) => {
    const updatedStems = stems.map((stem, i) => ({
      ...stem,
      muted: i !== index,
    }));
    
    updatedStems.forEach((stem, i) => {
      if (stem.audio) {
        if (i === index && isPlaying) {
          stem.audio.play().catch(err => console.error('Play error:', err));
        } else {
          stem.audio.pause();
        }
      }
    });
    
    setStems(updatedStems);
  };

  const unmuteAll = () => {
    const updatedStems = stems.map(stem => ({
      ...stem,
      muted: false,
    }));
    
    if (isPlaying) {
      updatedStems.forEach(stem => {
        if (stem.audio) {
          stem.audio.play().catch(err => console.error('Play error:', err));
        }
      });
    }
    
    setStems(updatedStems);
  };

  if (stems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <Card>
            <CardContent className="pt-6 text-center">
              <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-bold mb-2">No Stems Available</h2>
              <p className="text-muted-foreground mb-4">
                Generate stems from the Cover page first
              </p>
              <Button onClick={() => navigate('/cover')}>
                Go to Cover Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/cover')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Cover
          </Button>
          
          <h1 className="text-4xl font-bold mb-2">Stem Separation Studio</h1>
          <p className="text-muted-foreground">
            Mix, solo, and download individual stems from your covered audio
          </p>
        </div>

        {/* Cover Info */}
        {coveredMusic && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Track Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-start">
                {coveredMusic.imageUrl && (
                  <img
                    src={coveredMusic.imageUrl}
                    alt={coveredMusic.title}
                    className="w-24 h-24 rounded-lg border"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{coveredMusic.title}</h3>
                  {coveredMusic.tags && (
                    <p className="text-sm text-muted-foreground">🏷️ {coveredMusic.tags}</p>
                  )}
                  {coveredMusic.modelName && (
                    <p className="text-sm text-muted-foreground">🤖 {coveredMusic.modelName}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {stems.length} stems available
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Master Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Master Controls</CardTitle>
            <CardDescription>Control all stems at once</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-center">
              <Button
                size="lg"
                onClick={togglePlayAll}
                className="w-32"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Pause All
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Play All
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={unmuteAll}
              >
                Unmute All
              </Button>
              
              <Button
                variant="outline"
                onClick={downloadAllStems}
              >
                <Download className="w-4 h-4 mr-2" />
                Download All
              </Button>
            </div>

            <div className="flex gap-4 items-center">
              <Volume2 className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <Slider
                  value={[masterVolume]}
                  onValueChange={(value) => updateMasterVolume(value[0])}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
              <span className="text-sm font-medium w-12 text-right">
                {masterVolume}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Individual Stems */}
        <Card>
          <CardHeader>
            <CardTitle>Individual Stems</CardTitle>
            <CardDescription>
              Control each stem independently - adjust volume, mute, solo, or download
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stems.map((stem, index) => (
                <div
                  key={index}
                  className={`p-4 border rounded-lg transition-colors ${
                    stem.muted ? 'bg-muted/50' : 'bg-background'
                  }`}
                >
                  <div className="flex items-center gap-4 mb-3">
                    <Button
                      size="icon"
                      variant={stem.muted ? "outline" : "default"}
                      onClick={() => toggleStemMute(index)}
                    >
                      {stem.muted ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </Button>
                    
                    <span className="font-medium text-lg flex-1">{stem.name}</span>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => soloStem(index)}
                    >
                      Solo
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadStem(stem.url, stem.name)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex gap-4 items-center">
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Slider
                        value={[stem.volume]}
                        onValueChange={(value) => updateStemVolume(index, value[0])}
                        max={100}
                        step={1}
                        disabled={stem.muted}
                        className="w-full"
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {stem.volume}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

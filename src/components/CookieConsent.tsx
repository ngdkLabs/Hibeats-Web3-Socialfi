import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Cookie, Settings } from 'lucide-react';
import { cookieService, CookieConsent as CookieConsentType } from '@/services/cookieService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<Omit<CookieConsentType, 'timestamp'>>({
    essential: true,
    functional: true,
    analytics: true,
    performance: true,
  });

  useEffect(() => {
    // Check if user has already given consent
    const hasConsent = cookieService.hasConsent();
    setShowBanner(!hasConsent);
  }, []);

  const handleAcceptAll = () => {
    cookieService.acceptAll();
    setShowBanner(false);
  };

  const handleAcceptEssential = () => {
    cookieService.acceptEssentialOnly();
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    cookieService.saveConsent(preferences);
    setShowSettings(false);
    setShowBanner(false);
  };

  const handleOpenSettings = () => {
    const currentConsent = cookieService.getConsent();
    if (currentConsent) {
      setPreferences({
        essential: currentConsent.essential,
        functional: currentConsent.functional,
        analytics: currentConsent.analytics,
        performance: currentConsent.performance,
      });
    }
    setShowSettings(true);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Cookie Consent Banner - Compact Version */}
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-50 pointer-events-none">
        <Card className="max-w-md ml-auto p-4 shadow-xl border pointer-events-auto bg-background/98 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <Cookie className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-sm mb-1">Cookie Notice</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We use cookies to enhance your experience. 
                  <a href="/cookie-policy" className="underline hover:text-primary ml-1">Learn more</a>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleAcceptAll}
                  size="sm"
                  className="h-8 text-xs"
                >
                  Accept
                </Button>
                
                <Button
                  onClick={handleAcceptEssential}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                >
                  Reject
                </Button>
                
                <Button
                  onClick={handleOpenSettings}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1"
                >
                  <Settings className="w-3 h-3" />
                  Customize
                </Button>
              </div>
            </div>

            <Button
              onClick={() => setShowBanner(false)}
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Cookie Settings Dialog - Compact Version */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Cookie className="w-4 h-4" />
              Cookie Settings
            </DialogTitle>
            <DialogDescription className="text-xs">
              Essential cookies cannot be disabled as they are required for basic functionality.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Essential Cookies */}
            <div className="space-y-1.5 pb-3 border-b">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Label className="text-sm font-semibold">Essential Cookies</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Authentication, wallet, and security
                  </p>
                </div>
                <Switch
                  checked={true}
                  disabled
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>

            {/* Functional Cookies */}
            <div className="space-y-1.5 pb-3 border-b">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Label className="text-sm font-semibold">Functional Cookies</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Theme, volume, and UI preferences
                  </p>
                </div>
                <Switch
                  checked={preferences.functional}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, functional: checked })
                  }
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>

            {/* Analytics Cookies */}
            <div className="space-y-1.5 pb-3 border-b">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Label className="text-sm font-semibold">Analytics Cookies</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Usage analysis and statistics
                  </p>
                </div>
                <Switch
                  checked={preferences.analytics}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, analytics: checked })
                  }
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>

            {/* Performance Cookies */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Label className="text-sm font-semibold">Performance Cookies</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Caching and loading optimization
                  </p>
                </div>
                <Switch
                  checked={preferences.performance}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, performance: checked })
                  }
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t">
            <Button
              onClick={handleSavePreferences}
              size="sm"
              className="flex-1"
            >
              Save
            </Button>
            <Button
              onClick={() => {
                setPreferences({
                  essential: true,
                  functional: true,
                  analytics: true,
                  performance: true,
                });
                handleSavePreferences();
              }}
              variant="outline"
              size="sm"
            >
              Accept All
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

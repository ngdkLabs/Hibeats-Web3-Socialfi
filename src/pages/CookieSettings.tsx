import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Cookie, Shield, Zap, BarChart3, Trash2, Download, RefreshCw } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { cookieService, CookieConsent } from '@/services/cookieService';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const CookieSettings = () => {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<Omit<CookieConsent, 'timestamp'>>({
    essential: true,
    functional: true,
    analytics: true,
    performance: true,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    // Load current preferences
    const consent = cookieService.getConsent();
    if (consent) {
      setPreferences({
        essential: consent.essential,
        functional: consent.functional,
        analytics: consent.analytics,
        performance: consent.performance,
      });
      setLastUpdated(new Date(consent.timestamp));
    }
  }, []);

  const handleSave = () => {
    cookieService.saveConsent(preferences);
    setLastUpdated(new Date());
    toast({
      title: 'Preferences Saved',
      description: 'Your cookie settings have been updated.',
    });
  };

  const handleAcceptAll = () => {
    setPreferences({
      essential: true,
      functional: true,
      analytics: true,
      performance: true,
    });
    cookieService.acceptAll();
    setLastUpdated(new Date());
    toast({
      title: 'All Cookies Accepted',
      description: 'You have accepted all types of cookies.',
    });
  };

  const handleRejectAll = () => {
    setPreferences({
      essential: true,
      functional: false,
      analytics: false,
      performance: false,
    });
    cookieService.acceptEssentialOnly();
    setLastUpdated(new Date());
    toast({
      title: 'Non-Essential Cookies Rejected',
      description: 'Only essential cookies will be used.',
    });
  };

  const handleClearCookies = () => {
    cookieService.removeAllCookies();
    toast({
      title: 'Cookies Deleted',
      description: 'All HiBeats cookies have been removed from your browser.',
      variant: 'destructive',
    });
  };

  const handleResetConsent = () => {
    cookieService.resetConsent();
    setPreferences({
      essential: true,
      functional: true,
      analytics: true,
      performance: true,
    });
    setLastUpdated(null);
    toast({
      title: 'Consent Reset',
      description: 'Your cookie preferences have been reset. The cookie banner will appear again.',
    });
  };

  const handleExportData = () => {
    const consent = cookieService.getConsent();
    const data = {
      consent,
      exportDate: new Date().toISOString(),
      cookies: document.cookie.split(';').filter(c => c.trim().startsWith('hibeats_')),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hibeats-cookie-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Data Exported',
      description: 'Your cookie data has been downloaded.',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-16">
        <div className="container mx-auto px-6 py-8 max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Cookie className="w-8 h-8 text-primary" />
              <h1 className="font-clash font-semibold text-4xl">Cookie Settings</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Manage your cookie and privacy preferences on HiBeats
            </p>
            {lastUpdated && (
              <p className="text-sm text-muted-foreground mt-2">
                Last updated: {lastUpdated.toLocaleString('en-US')}
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Manage all cookies with one click
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={handleAcceptAll} className="gap-2">
                <Cookie className="w-4 h-4" />
                Accept All
              </Button>
              <Button onClick={handleRejectAll} variant="outline" className="gap-2">
                <Shield className="w-4 h-4" />
                Essential Only
              </Button>
              <Button onClick={handleExportData} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Export Data
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete Cookies
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Cookies?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all HiBeats cookies from your browser. You may need to log in again and reset your preferences.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearCookies} className="bg-destructive hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Reset Consent
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Cookie Consent?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will reset your cookie preferences and show the cookie banner again when you visit the platform.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetConsent}>
                      Reset
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Cookie Categories */}
          <div className="space-y-4">
            {/* Essential Cookies */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      <CardTitle>Essential Cookies</CardTitle>
                      <Badge variant="secondary">Required</Badge>
                    </div>
                    <CardDescription>
                      Required for basic platform functions such as authentication, wallet connection, and security.
                    </CardDescription>
                  </div>
                  <Switch checked={true} disabled className="data-[state=checked]:bg-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>✓ Authentication and session management</p>
                  <p>✓ Web3 wallet connection (Sequence, MetaMask)</p>
                  <p>✓ Security and CSRF protection</p>
                  <p>✓ Cookie consent preferences</p>
                </div>
              </CardContent>
            </Card>

            {/* Functional Cookies */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Cookie className="w-5 h-5 text-primary" />
                      <CardTitle>Functional Cookies</CardTitle>
                      <Badge variant="outline">Optional</Badge>
                    </div>
                    <CardDescription>
                      Remember your preferences such as theme, volume, and music player settings.
                    </CardDescription>
                  </div>
                  <Switch
                    checked={preferences.functional}
                    onCheckedChange={(checked) =>
                      setPreferences({ ...preferences, functional: checked })
                    }
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>✓ UI theme (dark/light mode)</p>
                  <p>✓ Volume and playback settings</p>
                  <p>✓ Language preferences</p>
                  <p>✓ Playlist view and layout</p>
                </div>
              </CardContent>
            </Card>

            {/* Analytics Cookies */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      <CardTitle>Analytics Cookies</CardTitle>
                      <Badge variant="outline">Optional</Badge>
                    </div>
                    <CardDescription>
                      Help us understand how you use the platform to improve your experience.
                    </CardDescription>
                  </div>
                  <Switch
                    checked={preferences.analytics}
                    onCheckedChange={(checked) =>
                      setPreferences({ ...preferences, analytics: checked })
                    }
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>✓ Anonymous platform usage analysis</p>
                  <p>✓ User interaction statistics</p>
                  <p>✓ Data-driven feature improvements</p>
                  <p>✓ Bug detection and fixes</p>
                </div>
              </CardContent>
            </Card>

            {/* Performance Cookies */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" />
                      <CardTitle>Performance Cookies</CardTitle>
                      <Badge variant="outline">Optional</Badge>
                    </div>
                    <CardDescription>
                      Improve platform speed and performance through data caching.
                    </CardDescription>
                  </div>
                  <Switch
                    checked={preferences.performance}
                    onCheckedChange={(checked) =>
                      setPreferences({ ...preferences, performance: checked })
                    }
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>✓ NFT and music metadata caching</p>
                  <p>✓ Page loading optimization</p>
                  <p>✓ Blockchain network performance</p>
                  <p>✓ Playlist and collection data caching</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Save Button */}
          <div className="mt-8 flex gap-3">
            <Button onClick={handleSave} size="lg" className="flex-1">
              Save Preferences
            </Button>
          </div>

          {/* Additional Info */}
          <Card className="mt-6 bg-muted/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Additional Information</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  • Cookies are stored locally in your browser and cannot be accessed by third parties.
                </p>
                <p>
                  • We never store private keys or sensitive wallet information in cookies.
                </p>
                <p>
                  • Blockchain data (transactions, NFTs) is stored on-chain and unaffected by cookie settings.
                </p>
                <p>
                  • You can change cookie preferences anytime without affecting your blockchain data.
                </p>
                <p>
                  • For more information, read our{' '}
                  <a href="/cookie-policy" className="text-primary hover:underline">
                    Cookie Policy
                  </a>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CookieSettings;

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cookie, ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useNavigate } from 'react-router-dom';

const CookiePolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-16">
        <div className="container mx-auto px-6 py-8 max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="mb-4 gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            
            <div className="flex items-center gap-3 mb-2">
              <Cookie className="w-8 h-8 text-primary" />
              <h1 className="font-clash font-semibold text-4xl">Cookie Policy</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Last updated: November 27, 2024
            </p>
          </div>

          {/* Content */}
          <Card>
            <CardContent className="prose prose-sm md:prose-base dark:prose-invert max-w-none pt-6">
              <h2>What are Cookies?</h2>
              <p>
                Cookies are small text files stored on your device when you visit a website. 
                Cookies help us provide, protect, and improve HiBeats services.
              </p>

              <h2>Cookies We Use</h2>

              <h3>1. Essential Cookies (Required)</h3>
              <p>These cookies are necessary for the platform to function properly and cannot be disabled.</p>
              <ul>
                <li><strong>hibeats_session</strong>: Stores session ID for authentication (Session)</li>
                <li><strong>hibeats_wallet</strong>: Stores connected wallet address (30 days)</li>
                <li><strong>hibeats_auth_token</strong>: Authentication token for API (7 days)</li>
                <li><strong>hibeats_csrf</strong>: CSRF protection for security (Session)</li>
              </ul>

              <h3>2. Functional Cookies (Optional)</h3>
              <p>These cookies enhance platform functionality and personalization.</p>
              <ul>
                <li><strong>hibeats_theme</strong>: Stores theme preference (light/dark) (1 year)</li>
                <li><strong>hibeats_language</strong>: Stores language preference (1 year)</li>
                <li><strong>hibeats_audio_settings</strong>: Stores audio player settings (1 year)</li>
                <li><strong>hibeats_volume</strong>: Stores last volume level (1 year)</li>
                <li><strong>hibeats_playlist_view</strong>: Stores playlist view preference (90 days)</li>
              </ul>

              <h3>3. Performance Cookies (Optional)</h3>
              <p>These cookies help us understand how users interact with the platform.</p>
              <ul>
                <li><strong>hibeats_analytics</strong>: Collects anonymous analytics data (2 years)</li>
                <li><strong>hibeats_page_views</strong>: Tracks visited pages (30 days)</li>
                <li><strong>hibeats_session_duration</strong>: Measures session duration (Session)</li>
              </ul>

              <h3>4. Web3 & Blockchain Cookies</h3>
              <p>Cookies specific to Web3 and blockchain functionality.</p>
              <ul>
                <li><strong>hibeats_wallet_provider</strong>: Stores wallet provider (Sequence, MetaMask) (30 days)</li>
                <li><strong>hibeats_network</strong>: Stores selected blockchain network (30 days)</li>
                <li><strong>hibeats_session_key</strong>: Session key for gasless transactions (24 hours)</li>
                <li><strong>hibeats_last_tx</strong>: Stores last transaction hash (7 days)</li>
              </ul>

              <h2>Local Storage & Session Storage</h2>
              <p>In addition to cookies, we also use browser storage to store data:</p>
              
              <h3>Local Storage</h3>
              <ul>
                <li>User Profile Data: User profile information (username, avatar, bio)</li>
                <li>Music Preferences: Music preferences and recommendations</li>
                <li>Playlist Cache: Cached playlists for faster loading</li>
                <li>NFT Collection: Cached NFT collection owned</li>
                <li>Audio Queue: Currently playing song queue</li>
                <li>Draft Posts: Unpublished draft posts</li>
              </ul>

              <h3>Session Storage</h3>
              <ul>
                <li>Temporary Auth Data: Temporary authentication data</li>
                <li>Form Data: Form data being filled</li>
                <li>Navigation State: Navigation state for back/forward</li>
                <li>Upload Progress: File upload progress</li>
              </ul>

              <h2>Third-Party Cookies</h2>
              <p>We use third-party services that may set their own cookies:</p>

              <h3>1. Sequence Wallet</h3>
              <ul>
                <li><strong>Purpose</strong>: Wallet management and authentication</li>
                <li><strong>Cookies</strong>: <code>sequence_*</code></li>
                <li><strong>Privacy Policy</strong>: <a href="https://sequence.xyz/privacy" target="_blank" rel="noopener noreferrer">Sequence Privacy Policy</a></li>
              </ul>

              <h3>2. IPFS/Pinata</h3>
              <ul>
                <li><strong>Purpose</strong>: Decentralized file storage</li>
                <li><strong>Cookies</strong>: <code>pinata_*</code></li>
                <li><strong>Privacy Policy</strong>: <a href="https://pinata.cloud/privacy" target="_blank" rel="noopener noreferrer">Pinata Privacy Policy</a></li>
              </ul>

              <h3>3. The Graph</h3>
              <ul>
                <li><strong>Purpose</strong>: Blockchain data indexing</li>
                <li><strong>Cookies</strong>: Does not use cookies</li>
                <li><strong>Privacy Policy</strong>: <a href="https://thegraph.com/privacy" target="_blank" rel="noopener noreferrer">The Graph Privacy Policy</a></li>
              </ul>

              <h3>4. Suno AI (Optional)</h3>
              <ul>
                <li><strong>Purpose</strong>: AI music generation</li>
                <li><strong>Cookies</strong>: <code>suno_*</code></li>
                <li><strong>Privacy Policy</strong>: <a href="https://suno.ai/privacy" target="_blank" rel="noopener noreferrer">Suno Privacy Policy</a></li>
              </ul>

              <h2>Managing Cookies</h2>
              <p>You can manage cookie preferences through:</p>
              <ol>
                <li><strong>Cookie Banner</strong>: When first visiting the platform</li>
                <li><strong>Settings Page</strong>: Settings &gt; Privacy & Security &gt; Cookie Preferences</li>
                <li><strong>Browser Settings</strong>: Your browser settings</li>
              </ol>

              <h3>Disabling Cookies</h3>
              <p className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <strong>⚠️ Warning:</strong> Disabling essential cookies will prevent some platform features from working properly.
              </p>

              <p><strong>How to disable cookies in browsers:</strong></p>
              <ul>
                <li><strong>Chrome</strong>: Settings &gt; Privacy and security &gt; Cookies and other site data</li>
                <li><strong>Firefox</strong>: Settings &gt; Privacy & Security &gt; Cookies and Site Data</li>
                <li><strong>Safari</strong>: Preferences &gt; Privacy &gt; Cookies and website data</li>
                <li><strong>Edge</strong>: Settings &gt; Cookies and site permissions &gt; Cookies and site data</li>
              </ul>

              <h2>Cookies and Web3</h2>
              <p>Since HiBeats is a Web3 platform, some data is stored on the blockchain and cannot be deleted:</p>
              <ul>
                <li><strong>On-Chain Data</strong>: Transactions, NFT ownership, smart contract interactions</li>
                <li><strong>Off-Chain Data</strong>: Profile data, posts, comments (can be deleted)</li>
                <li><strong>Wallet Data</strong>: Stored in your wallet, not on our servers</li>
              </ul>

              <h2>Cookie Security</h2>
              <p>We protect your cookies with:</p>
              <ul>
                <li>✅ <strong>HTTPS</strong>: All cookies sent over encrypted connections</li>
                <li>✅ <strong>HttpOnly</strong>: Sensitive cookies cannot be accessed by JavaScript</li>
                <li>✅ <strong>Secure Flag</strong>: Cookies only sent over HTTPS</li>
                <li>✅ <strong>SameSite</strong>: Protection against CSRF attacks</li>
                <li>✅ <strong>Encryption</strong>: Sensitive cookies are encrypted</li>
              </ul>

              <h2>Your Rights</h2>
              <p>In accordance with privacy regulations (GDPR, CCPA), you have the right to:</p>
              <ul>
                <li>✅ Know what cookies we use</li>
                <li>✅ Accept or reject non-essential cookies</li>
                <li>✅ Change cookie preferences at any time</li>
                <li>✅ Delete stored cookies</li>
                <li>✅ Access data we collect</li>
                <li>✅ Delete your account and data</li>
              </ul>

              <h2>Policy Changes</h2>
              <p>We may update this Cookie Policy from time to time. Changes will be notified through:</p>
              <ul>
                <li>Notification banner on the platform</li>
                <li>Email to registered address</li>
                <li>Update on this page with revision date</li>
              </ul>

              <h2>Contact</h2>
              <p>If you have questions about our Cookie Policy:</p>
              <ul>
                <li><strong>Email</strong>: privacy@hibeats.io</li>
                <li><strong>GitHub</strong>: <a href="https://github.com/ngdkLabs/Hibeats-Web3-Socialfi/issues" target="_blank" rel="noopener noreferrer">HiBeats Issues</a></li>
                <li><strong>Discord</strong>: HiBeats Community</li>
              </ul>

              <div className="bg-muted/50 p-6 rounded-lg mt-8">
                <h3 className="mt-0">Cookie Consent</h3>
                <p className="mb-4">
                  By using HiBeats, you consent to the use of cookies in accordance with this policy. 
                  You can change your cookie preferences at any time on the Settings page.
                </p>
                <div className="flex gap-3">
                  <Button onClick={() => navigate('/cookie-settings')}>
                    Cookie Settings
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/settings')}>
                    Go to Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CookiePolicy;

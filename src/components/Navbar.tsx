import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  Search,
  Headphones,
  Plus,
  User,
  Settings,
  LogOut,
  HelpCircle,
  MessageSquare,
  Music,
  ListMusic,
  Sparkles,
  Package,
  Wallet,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import NotificationDropdown from "@/components/NotificationDropdown";
import CreateSongModal from "@/components/CreateSongModal";
import CreatePlaylistModal from "@/components/CreatePlaylistModal";
import ArtistUpgradeModal from "@/components/ArtistUpgradeModal";
import WalletSidebar from "@/components/WalletSidebar";
import SearchModal from "@/components/SearchModal";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentUserProfile } from "@/hooks/useRealTimeProfile";
import { useSequence } from "@/contexts/SequenceContext";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAccount } from "wagmi";
import { useBalanceRefresh } from "@/hooks/useBalanceRefresh";
import { useOpenConnectModal } from '@0xsequence/connect';
import { somniaTestnet } from '@/lib/web3-config';
import { bxpService } from "@/services/bxpService";
import hibeatsLogo from "@/assets/hibeats.png";
import beatsIcon from "@/assets/beats.png";

interface NavbarProps {
  showCreateSongButton?: boolean;
}

const Navbar = ({ showCreateSongButton = true }: NavbarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCreateSongModalOpen, setIsCreateSongModalOpen] = useState(false);
  const [isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isWalletSidebarOpen, setIsWalletSidebarOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const { isAuthenticated, userProfile, logout } = useAuth();
  const { profileData, avatarUrl } = useCurrentUserProfile(); // Get real-time profile data with avatar
  const { smartAccountAddress } = useSequence();
  const { address, connector } = useAccount(); // Use wagmi's useAccount for SDK initialization
  const { setOpenConnectModal } = useOpenConnectModal(); // Sequence Connect modal
  
  // Get wallet balance with auto-refresh
  const { balance } = useBalanceRefresh(
    smartAccountAddress,
    { refreshInterval: 5000, enabled: !!smartAccountAddress }
  );


  // Real BXP balance from BXP service
  const [bxpBalance, setBxpBalance] = useState(0);
  
  // Load BXP balance when user is authenticated
  useEffect(() => {
    const loadBxpBalance = async () => {
      if (address) {
        try {
          const profile = await bxpService.getUserProfile(address);
          setBxpBalance(profile.totalXP);
        } catch (error) {
          console.error('Failed to load BXP balance:', error);
          setBxpBalance(0);
        }
      }
    };
    
    loadBxpBalance();
    
    // Refresh BXP balance every 30 seconds
    const interval = setInterval(loadBxpBalance, 30000);
    return () => clearInterval(interval);
  }, [address]);
  
  // Check if user is artist from real-time profile data
  const isArtist = profileData?.isArtist || false;

  // Keyboard shortcut for search (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreatePlaylist = () => {
    navigate('/myplaylist?create=playlist');
  };

  // Direct Sequence login - no intermediate modal
  const handleLogin = () => {
    setOpenConnectModal(true);
  };

  const navItems = [
    { path: "/feed", label: "Feed", icon: Home },
    { path: "/explore", label: "Explore", icon: Search },
    { path: "/beats", label: "Beats", icon: Headphones },
    { path: "/yourvibe", label: "Your Vibe", icon: Sparkles },
    { path: "/myplaylist", label: "My Playlist", icon: ListMusic },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/20 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6">
          <div className="flex items-center h-16">
            {/* Logo and Navigation */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center">
                <img
                  src={hibeatsLogo}
                  alt="HiBeats"
                  className="h-8 w-auto"
                />
              </Link>

              {/* Navigation Menu */}
              <nav className="hidden md:flex items-center gap-6">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`transition-colors ${
                        isActive
                          ? 'text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Center Section - Search */}
            <div className="flex-1 flex items-center justify-center mx-8">
              {/* Search Bar - Click to open modal */}
              <div className="hidden md:flex max-w-md flex-1">
                <button
                  onClick={() => setIsSearchModalOpen(true)}
                  className="relative w-full group"
                >
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 group-hover:text-primary transition-colors" />
                  <div className="pl-10 pr-4 py-2 w-full rounded-full border border-border/50 hover:border-primary/50 bg-background/50 hover:bg-background/80 transition-all text-left text-muted-foreground text-sm">
                    Search tracks, artists, or albums...
                  </div>
                  <kbd className="absolute right-3 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs bg-muted rounded border border-border/30 text-muted-foreground hidden lg:block">
                    Ctrl K
                  </kbd>
                </button>
              </div>
            </div>

            {/* Profile & Post Button */}
            <div className="flex items-center gap-3">
              {/* Wallet Button */}
              {isAuthenticated && (
                <Button
                  variant="outline"
                  className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full border-primary/20 hover:bg-primary/10"
                  onClick={() => setIsWalletSidebarOpen(true)}
                >
                  <Wallet className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {balance ? parseFloat(balance.formatted).toFixed(2) : "0.00"} {balance?.symbol || "STT"}
                  </span>
                </Button>
              )}

              {showCreateSongButton && isAuthenticated && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="hidden md:flex bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                      <Plus className="w-4 h-4" />
                      Create
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsCreateSongModalOpen(true)} className="cursor-pointer">
                      <Music className="w-4 h-4 mr-2" />
                      Create Song
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCreatePlaylist} className="cursor-pointer">
                      <ListMusic className="w-4 h-4 mr-2" />
                      Create Playlist
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {isAuthenticated ? (
                <>
                  <NotificationDropdown />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Avatar className="w-8 h-8 cursor-pointer">
                        <AvatarImage src={avatarUrl || userProfile?.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {profileData?.displayName?.charAt(0)?.toUpperCase() || userProfile?.name?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <div className="flex items-center gap-2 p-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={avatarUrl || userProfile?.avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                            {profileData?.displayName?.charAt(0)?.toUpperCase() || userProfile?.name?.charAt(0)?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium">{profileData?.displayName || userProfile?.name || "Username"}</p>
                            {profileData?.isVerified && <VerifiedBadge size="sm" />}
                          </div>
                          <Link 
                            to={profileData?.username ? `/profile/${profileData.username}` : "/settings"} 
                            className="text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            View profile
                          </Link>
                        </div>
                      </div>
                      
                      {/* BXP Balance */}
                      <div className="px-2 py-3 bg-primary/5 border-y border-border/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img 
                              src={beatsIcon} 
                              alt="BXP" 
                              className="w-5 h-5"
                            />
                            <span className="text-sm font-medium">BXP</span>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            {bxpBalance.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      
                      <DropdownMenuSeparator />
                      
                      {/* Show "Become Artist" for non-artists */}
                      {!isArtist && (
                        <>
                          <DropdownMenuItem 
                            onClick={() => setIsUpgradeModalOpen(true)} 
                            className="cursor-pointer text-primary font-medium"
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Become an Artist
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link to="/dashboard">
                          <User className="w-4 h-4 mr-2" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link to="/my-collection">
                          <Package className="w-4 h-4 mr-2" />
                          My Collection
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link to="/settings">
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="cursor-pointer">
                        <HelpCircle className="w-4 h-4 mr-2" />
                        Help
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Feedback
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={logout}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button
                  onClick={handleLogin}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border/20 lg:hidden z-40">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
          
          {/* Mobile Search Button */}
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="flex flex-col items-center gap-1 p-2 text-muted-foreground"
          >
            <Search className="w-5 h-5" />
            <span className="text-xs">Search</span>
          </button>
          
          {navItems.slice(2).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
          
          {showCreateSongButton && isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex flex-col items-center gap-1 p-2 text-muted-foreground">
                  <Plus className="w-5 h-5" />
                  <span className="text-xs">Create</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top">
                <DropdownMenuItem onClick={() => setIsCreateSongModalOpen(true)} className="cursor-pointer">
                  <Music className="w-4 h-4 mr-2" />
                  Create Song
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCreatePlaylist} className="cursor-pointer">
                  <ListMusic className="w-4 h-4 mr-2" />
                  Create Playlist
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Create Song Modal */}
      <CreateSongModal
        isOpen={isCreateSongModalOpen}
        onClose={() => setIsCreateSongModalOpen(false)}
      />

      {/* Create Playlist Modal - placeholder, actual usage in MyPlaylist page */}
      <CreatePlaylistModal
        isOpen={isCreatePlaylistModalOpen}
        onClose={() => setIsCreatePlaylistModalOpen(false)}
        onCreate={() => {}}
      />

      {/* Upgrade to Artist Modal */}
      <ArtistUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onSuccess={() => {
          // Refresh profile or navigate to artist dashboard
          window.location.reload();
        }}
      />

      {/* Wallet Sidebar */}
      <WalletSidebar
        isOpen={isWalletSidebarOpen}
        onClose={() => setIsWalletSidebarOpen(false)}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
    </>
  );
};

export default Navbar;
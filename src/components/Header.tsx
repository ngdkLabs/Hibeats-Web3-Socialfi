import { Button } from "@/components/ui/button";
import logo from "@/assets/hibeats.png";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 py-3 backdrop-blur-md bg-background/60 border-b border-border/30">
      <nav className="mx-auto flex items-center justify-between gap-4 max-w-screen-xl">
        <div className="flex items-center gap-2">
          <img src={logo} alt="hibeats" className="h-10 w-auto sm:h-12" />
          <span className="sr-only">HiBeats</span>
        </div>
        <Button
          size="sm"
          className="font-clash font-semibold px-4 sm:px-6 rounded-full shadow-glow text-sm sm:text-base"
        >
          Launch App
        </Button>
      </nav>
    </header>
  );
};

export default Header;

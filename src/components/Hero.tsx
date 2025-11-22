import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import heroBg from "@/assets/hero-bg.jpg";
import somniaLogo from "@/assets/somnia.png";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 sm:pt-28 pb-16">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-hero opacity-90"></div>
        <div className="absolute inset-0 bg-gradient-glow"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center space-y-6 sm:space-y-10">
          <h1 className="font-clash font-semibold text-4xl md:text-6xl lg:text-7xl leading-tight sm:leading-[1.05] text-balance">
            Create your own song with AI
            <br />
            <span className="inline-block mt-2">
              and <AnimatedRotatingWord /> your song
            </span>
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground tracking-wider flex items-center justify-center gap-2">
            Powered by
            <img src={somniaLogo} alt="Somnia" className="inline-block h-5 sm:h-6 object-contain" />
          </p>

          <div className="flex flex-col items-center gap-4 sm:gap-6 pt-4">
            <Link to="/feed">
              <Button
                variant="outline"
                size="lg"
                className="font-clash font-semibold text-base sm:text-lg px-8 sm:px-12 py-3 sm:py-4 h-auto rounded-full border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 w-full sm:w-auto"
              >
                Launch App
              </Button>
            </Link>

            <button
              className="text-foreground/60 hover:text-foreground transition-colors animate-bounce"
              aria-label="Scroll down"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="pointer-events-none absolute top-10 left-4 sm:left-10 w-48 sm:w-64 h-48 sm:h-64 bg-secondary/20 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="pointer-events-none absolute bottom-10 right-4 sm:right-10 w-72 sm:w-96 h-72 sm:h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow delay-1000"></div>
    </section>
  );
};

export default Hero;

// Small inline component to rotate a few words with a fade effect
function AnimatedRotatingWord() {
  const words = ["Create", "Trade", "Share", "Earn"];
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // fade out
      setVisible(false);
      // after fade out, switch word and fade in
      const t = setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setVisible(true);
      }, 300);

      return () => clearTimeout(t);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={
        "inline-block text-primary drop-shadow-[0_0_30px_rgba(179,255,94,0.5)] transition-opacity duration-300 " +
        (visible ? "opacity-100" : "opacity-0")
      }
      aria-live="polite"
    >
      {words[index]}
    </span>
  );
}

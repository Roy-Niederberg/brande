import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Globe, MessageSquare, Share2, Zap, Menu, X, Sun, Moon } from 'lucide-react'

export default function App() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans selection:bg-[var(--primary)]/40 transition-colors duration-300">
      <Navbar dark={dark} setDark={setDark} />
      <Hero />
      <Features />
      <HowItWorks />
      <Footer />
    </div>
  );
}

function Navbar({ dark, setDark }: { dark: boolean, setDark: (v: boolean) => void }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-[var(--bg)]/90 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className={`flex items-baseline ${isScrolled ? 'text-[var(--heading)]' : 'text-white'}`}>
          <svg width="33" height="33" viewBox="-603 -603 1206 1206" xmlns="http://www.w3.org/2000/svg" className="self-center">
            <path fill="currentColor" transform="rotate(135)" d="M -43.934 -600 L -43.934 0 C -102.948 -160.66 -102.944 -248.528 -175.736 -175.736 A 248.528 248.528 0 1 0 43.934 -244.614 L 43.934 -804.594 C 87.868 -512.132 248.528 -600 424.264 -424.264 A 600 600 0 1 1 -43.934 -600" />
          </svg>
          <span className="text-2xl font-bold tracking-tight ml-1">ab&ucirc;</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className={`text-sm font-medium hover:opacity-70 transition-opacity ${isScrolled ? 'text-[var(--text)]' : 'text-white/90'}`}>Features</a>
          <a href="#how-it-works" className={`text-sm font-medium hover:opacity-70 transition-opacity ${isScrolled ? 'text-[var(--text)]' : 'text-white/90'}`}>How It Works</a>
          <button
            onClick={() => setDark(!dark)}
            className={`p-2 rounded-full transition-all ${isScrolled ? 'text-[var(--text)] hover:bg-[var(--primary)]/10' : 'text-white/80 hover:text-white'}`}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${isScrolled ? 'bg-[var(--accent)] text-white hover:opacity-90' : 'bg-white text-[#1B4F72] hover:bg-white/90'}`}>
            Get Started
          </button>
        </div>

        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setDark(!dark)}
            className={`p-2 rounded-full ${isScrolled ? 'text-[var(--text)]' : 'text-white/80'}`}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className={isScrolled ? 'text-[var(--text)]' : 'text-white'} /> : <Menu className={isScrolled ? 'text-[var(--text)]' : 'text-white'} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[var(--bg)] shadow-lg border-t border-[var(--border)] p-6 flex flex-col gap-4">
          <a href="#features" className="text-[var(--text)] font-medium" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#how-it-works" className="text-[var(--text)] font-medium" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
          <button className="bg-[var(--accent)] text-white px-5 py-3 rounded-xl font-medium mt-2">
            Get Started
          </button>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  const videos = [
    "/2385281-hd_1280_720_24fps.mp4",
    "/4962635-hd_1280_720_25fps.mp4",
    "/5241180-hd_1280_720_25fps.mp4",
    "/7299503-hd_1280_720_30fps.mp4"
  ];
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    videos.forEach((_, index) => {
      const video = videoRefs.current[index];
      if (video) {
        if (index === currentVideoIndex) {
          video.currentTime = 0;
          video.play().catch(e => console.log("Autoplay prevented", e));
        } else {
          video.pause();
        }
      }
    });
  }, [currentVideoIndex]);

  const handleVideoEnd = () => {
    setCurrentVideoIndex((prev) => (prev + 1) % videos.length);
  };

  return (
    <section className="relative h-screen min-h-[600px] flex items-end pb-16 md:pb-24 overflow-hidden">
      {/* Background Videos */}
      <div className="absolute inset-0 w-full h-full bg-[#1C2127]">
        <div className="absolute inset-0 bg-[#1C2127]/40 z-10" />
        {videos.map((src, index) => (
          <video
            key={src}
            ref={(el) => (videoRefs.current[index] = el)}
            muted
            playsInline
            onEnded={index === currentVideoIndex ? handleVideoEnd : undefined}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
              index === currentVideoIndex ? 'opacity-80 z-0' : 'opacity-0 -z-10'
            }`}
          >
            <source src={src} type="video/mp4" />
          </video>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-20 w-full max-w-[1600px] mx-auto px-8 md:px-16 flex flex-col md:flex-row justify-between items-end gap-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full md:max-w-2xl"
        >
          <h1 className="text-5xl md:text-6xl lg:text-[5rem] font-light text-white tracking-tight leading-[1.05]">
            Your business, <br />
            one conversation away
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="w-full md:max-w-sm flex flex-col gap-6"
        >
          <p className="text-lg md:text-xl text-white/90 font-light leading-relaxed">
            An AI-first web presence that replaces your traditional website. Your customers ask, your Qab&ucirc; answers — instantly, accurately, 24/7.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button className="w-full sm:w-auto px-6 py-2.5 bg-[#85C1E9] hover:bg-[#85C1E9]/90 text-[#1B4F72] font-normal rounded-full transition-all text-sm">
              Get in touch
            </button>
            <button className="w-full sm:w-auto px-6 py-2.5 bg-transparent hover:bg-white/10 text-[#FAF4E8] font-normal rounded-full transition-all text-sm border border-[#85C1E9]/40">
              Learn more
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: <Globe className="w-6 h-6 text-white" />,
      title: "AI-First Website",
      description: "Your customers don't browse pages \u2014 they have a conversation. Ask anything, get an instant answer from your knowledge base.",
      image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=800&auto=format&fit=crop"
    },
    {
      icon: <Share2 className="w-6 h-6 text-white" />,
      title: "Every Channel, One Brain",
      description: "Your site, Facebook comments, Messenger DMs \u2014 all powered by the same knowledge base. Build it once, reach customers everywhere.",
      image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=800&auto=format&fit=crop"
    },
    {
      icon: <Zap className="w-6 h-6 text-white" />,
      title: "Live in Minutes",
      description: "No developers, no hosting, no design. Tell your Qab\u00fb about your business and it builds your web presence from the conversation.",
      image: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?q=80&w=800&auto=format&fit=crop"
    }
  ];

  return (
    <section id="features" className="py-24 md:py-32 bg-[var(--bg)] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-[var(--heading)] mb-6">
            The website, reinvented
          </h2>
          <p className="text-lg text-[var(--text)] leading-relaxed">
            Traditional websites are static pages that customers have to search through. Qab&ucirc; replaces all of that with a single, intelligent conversation.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative rounded-3xl overflow-hidden group min-h-[420px] flex flex-col justify-end p-8 shadow-sm hover:shadow-xl transition-shadow"
            >
              <img
                src={feature.image}
                alt={feature.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1C2127]/95 via-[#1C2127]/60 to-transparent" />

              <div className="relative z-10">
                <div className="w-12 h-12 bg-[#85C1E9]/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-[#85C1E9]/30">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-[#FAF4E8]/80 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-[#1C2127] text-[#FAF4E8] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2A4359] border border-[#85C1E9]/20 text-sm font-medium mb-6">
              <MessageSquare size={16} className="text-[#85C1E9]" />
              <span>As Easy as a Facebook Page</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
              Built for business owners, <br />
              <span className="text-[#85C1E9]/60">not developers.</span>
            </h2>
            <p className="text-lg text-[#FAF4E8]/70 mb-8 leading-relaxed max-w-lg">
              No domain, no hosting, no design, no code. Just tell your Qab&ucirc; about your business — it handles the rest. Your AI learns what you know and speaks to your customers the way you would.
            </p>

            <ul className="space-y-4 mb-10">
              {[
                "Set up in minutes \u2014 just have a conversation",
                "No coding or technical skills required",
                "Works on your site, Facebook, and Messenger",
                "Your knowledge base, always accurate and up to date"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[#FAF4E8]/80">
                  <div className="w-6 h-6 rounded-full bg-[#85C1E9]/20 flex items-center justify-center text-[#85C1E9]">
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  {item}
                </li>
              ))}
            </ul>

            <button className="px-8 py-4 bg-[#85C1E9] text-[#1B4F72] hover:bg-[#85C1E9]/90 font-semibold rounded-full transition-all">
              Get started
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="aspect-square md:aspect-[4/3] rounded-3xl overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1638202993928-7267aad84c31?q=80&w=1600&auto=format&fit=crop"
                alt="Business owner using Qabu"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1C2127]/80 via-transparent to-transparent" />

              {/* Floating UI Element */}
              <div className="absolute bottom-8 left-8 right-8 bg-[#2A4359]/80 backdrop-blur-md border border-[#85C1E9]/20 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#85C1E9] flex items-center justify-center text-[#1B4F72] font-bold">Q</div>
                  <div>
                    <div className="text-sm font-medium text-[#FAF4E8]">Your Qab&ucirc;</div>
                    <div className="text-xs text-[#85C1E9]">Active now</div>
                  </div>
                </div>
                <p className="text-sm text-[#FAF4E8]/80">
                  "We're open Sunday through Thursday, 8 AM to 6 PM. Would you like to book a consultation? I can show you available times."
                </p>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#85C1E9]/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#1B4F72]/30 rounded-full blur-2xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#1C2127] text-[#FAF4E8]/50 py-12 border-t border-[#2A4359]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#FAF4E8] tracking-tight">Qab&ucirc;</span>
          </div>
          <div className="flex gap-6 text-sm">
            <a href="/privacy" className="hover:text-[#FAF4E8] transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-[#FAF4E8] transition-colors">Terms</a>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs border-t border-[#2A4359]/50 pt-8">
          <p>&copy; {new Date().getFullYear()} Qab&ucirc;. All rights reserved.</p>
          <p className="text-[#FAF4E8]/30">
            Background video by <a href="https://mixkit.co" target="_blank" rel="noopener noreferrer" className="text-[#FAF4E8]/40 hover:text-[#85C1E9] underline decoration-[#2A4359] underline-offset-2">Mixkit</a>.
            Images from <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="text-[#FAF4E8]/40 hover:text-[#85C1E9] underline decoration-[#2A4359] underline-offset-2">Unsplash</a>.
          </p>
        </div>
      </div>
    </footer>
  );
}

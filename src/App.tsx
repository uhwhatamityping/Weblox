/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from "@google/genai";
import { 
  Rocket, 
  LogOut, 
  User, 
  Lock, 
  Play, 
  Plus, 
  RefreshCw, 
  ChevronLeft, 
  History,
  Gamepad2,
  Cpu,
  BrainCircuit,
  Wand2,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';

// --- FIREBASE INITIALIZATION ---
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, getDocFromServer, doc, setDoc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// INSTRUCTIONS: To use your own Firebase, replace the config in 'firebase-applet-config.json' 
// with your values from the Firebase Console (Settings > General > Your Apps).
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

// --- GEMINI INITIALIZATION ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Handle Firestore errors following standard guidelines
 */
const handleFirestoreError = (error: any, operation: string, path: string) => {
  console.error(`Firestore Error [${operation} on ${path}]:`, error);
  throw error;
};


export default function App() {
  const [user, setUser] = useState<{username: string, email: string} | null>(null);
  const [screen, setScreen] = useState<'auth' | 'lobby' | 'loading' | 'game'>('auth');
  const [idea, setIdea] = useState('');
  const [includeAi, setIncludeAi] = useState(false);
  const [generatedGame, setGeneratedGame] = useState<string | null>(null);
  const [gameTitle, setGameTitle] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Auth States
  const [emailInput, setEmailInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(true);

  // Monitor Auth State
    useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get user profile from the UID-keyed document
        try {
          const userSnap = await getDocFromServer(doc(db, "users", firebaseUser.uid));
          const userData = userSnap.data();
          const username = userData?.username || firebaseUser.displayName || 'Builder';
          setUser({ username, email: firebaseUser.email! });
          setScreen('lobby');
        } catch (err) {
          setUser({ username: firebaseUser.displayName || 'Builder', email: firebaseUser.email! });
          setScreen('lobby');
        }
      } else {
        setUser(null);
        setScreen('auth');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch history on user change
  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, "games"), 
        where("userId", "==", auth.currentUser.uid),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(q);
      const games = snapshot.docs.map(doc => doc.data());
      setHistory(games);
    } catch (err: any) {
      console.error("Failed to fetch history", err);
    }
  };

  const handleAuth = async () => {
    if (emailInput.length < 5) return setError("Valid email required");
    if (!isLogin && usernameInput.length < 1) return setError("Username required");
    if (passwordInput.length < 8) return setError("Password must be 8+ characters");
    
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      } else {
        // Signup
        const userCredential = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        
        // Save profile to Firestore using UID as Document ID
        await setDoc(doc(db, "users", userCredential.user.uid), {
          username: usernameInput,
          email: emailInput,
          uid: userCredential.user.uid,
          timestamp: new Date().toISOString()
        });

        await updateProfile(userCredential.user, {
          displayName: usernameInput
        });

        setUser({ username: usernameInput, email: emailInput });
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') msg = "Invalid email or access code.";
      if (err.code === 'auth/wrong-password') msg = "Incorrect access code.";
      if (err.code === 'auth/email-already-in-use') msg = "This email is already registered. Try logging in instead.";
      if (err.code === 'auth/operation-not-allowed') msg = "Email/Password sign-in is not enabled in your Firebase console.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setScreen('auth');
      setHistory([]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const generateGame = async () => {
    if (!idea) {
      setError("Describe your game idea!");
      return;
    }
    
    setScreen('loading');
    setError(null);

    try {
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        config: {
          systemInstruction: "You are an expert game developer specialized in single-file HTML5 Canvas games. Return ONLY valid, self-contained JavaScript code. NO markdown blocks, NO triple backticks, NO explanations. The code must target an existing canvas with id 'gameCanvas' sized 800x500. Use requestAnimationFrame for the loop. Handle keyboard input (WASD/Arrows). Make it neon/colorful.",
        },
        contents: `Create a game based on this description: ${idea}. ${includeAi ? 'The game must include an AI opponent or autonomous entities.' : ''} Ensure all assets are drawn directly to the canvas using code.`,
      });

      const code = result.text?.replace(/```javascript|```js|```/g, '').trim() || "";
      
      if (!code) {
        throw new Error("The AI failed to generate game code. Please try a different description or try again.");
      }
      
      setGeneratedGame(code);
      setGameTitle(idea.substring(0, 30) + (idea.length > 30 ? '...' : ''));
      
      const newGame = { 
        userId: auth.currentUser?.uid,
        username: user?.username, 
        description: idea, 
        code, 
        timestamp: new Date().toISOString() 
      };
      
      // Save to Firestore
      await addDoc(collection(db, "games"), newGame);
      
      setHistory(prev => [newGame, ...prev]);
      setScreen('game');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong during generation.");
      setScreen('lobby');
    }
  };

  return (
    <div className="min-h-screen bg-[#2A004E] text-white overflow-hidden relative selection:bg-[#00E5FF] selection:text-black">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-10 left-10 w-24 h-24 bg-[#FF4081] rounded-2xl rotate-12 opacity-40 shadow-xl blur-sm" />
        <div className="absolute top-40 right-20 w-16 h-16 bg-[#00E5FF] rounded-xl -rotate-12 opacity-30 shadow-xl blur-xs" />
        <div className="absolute bottom-20 left-1/4 w-32 h-32 bg-[#76FF03] rounded-[40px] rotate-45 opacity-20 shadow-xl blur-md" />
        <div className="absolute top-1/2 left-10 w-8 h-8 bg-yellow-400 rounded-full opacity-50 shadow-xl blur-xs" />

        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-8 h-8 bg-white opacity-5 rounded-lg"
            initial={{ 
              x: Math.random() * 100 + "%", 
              y: "110%", 
              rotate: 0,
            }}
            animate={{ 
              y: "-10%", 
              rotate: 360,
              transition: { 
                duration: Math.random() * 20 + 20, 
                repeat: Infinity, 
                ease: "linear" 
              } 
            }}
          />
        ))}
      </div>

      {/* Top Header / Logout */}
      <AnimatePresence>
        {user && (
          <motion.nav 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-8 py-6 backdrop-blur-sm bg-[#2A004E]/20"
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl fancy-heading">
                <span className="text-[#00E5FF]">WE</span><span className="text-[#76FF03]">BLOX</span>
              </div>
              <div className="nav-tag">BETA v1.0</div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[10px] opacity-60 uppercase font-black tracking-widest text-[#00E5FF]">Status</span>
                <span className="text-xs font-black uppercase text-[#76FF03]">Online</span>
              </div>
              <div className="h-10 w-px bg-white/20"></div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] opacity-60 uppercase font-black tracking-widest text-[#76FF03]">User</span>
                  <span className="font-black text-lg uppercase tracking-tight text-white">{user.username}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 px-6 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-[0_4px_0_rgb(185,28,28)] active:shadow-none active:translate-y-1"
                >
                  Logout
                </button>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="relative z-10 w-full min-h-screen flex items-center justify-center p-4 pt-24 pb-12">
        <AnimatePresence mode="wait">
          {screen === 'auth' && (
            <AuthScreen 
              onAuth={handleAuth} 
              isLogin={isLogin} 
              setIsLogin={setIsLogin}
              email={emailInput}
              setEmail={setEmailInput}
              username={usernameInput}
              setUsername={setUsernameInput}
              password={passwordInput}
              setPassword={setPasswordInput}
              error={error}
              loading={loading}
            />
          )}

          {screen === 'lobby' && (
            <LobbyScreen 
              idea={idea} 
              setIdea={setIdea} 
              includeAi={includeAi} 
              setIncludeAi={setIncludeAi}
              onGenerate={generateGame}
              history={history}
              onPlayAgain={(game: any) => {
                setGeneratedGame(game.code);
                setGameTitle(game.description);
                setScreen('game');
              }}
            />
          )}

          {screen === 'loading' && <LoadingScreen idea={idea} />}

          {screen === 'game' && (
            <GameScreen 
              code={generatedGame!} 
              title={gameTitle} 
              onBack={() => setScreen('lobby')}
              onRebuild={generateGame}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Bar Info */}
      <footer className="fixed bottom-0 left-0 w-full z-10 px-8 py-4 flex justify-between items-center text-[10px] opacity-40 font-black uppercase tracking-widest pointer-events-none">
        <div>&copy; 2026 WEBLOX INC. ALL RIGHTS RESERVED.</div>
        <div className="flex gap-6">
          <span>Terms</span>
          <span>Privacy</span>
          <span>Support</span>
        </div>
      </footer>

      {/* Global Error Popups */}
      <AnimatePresence>
        {error && screen !== 'auth' && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, scale: 0.9, x: "-50%" }}
            className="fixed bottom-10 left-1/2 bg-[#FF4081] text-white px-8 py-6 rounded-3xl shadow-[0_10px_30px_rgba(255,64,129,0.5)] z-[60] flex items-center gap-4 font-black border-4 border-white/20 w-max max-w-[90vw] uppercase"
          >
            <AlertTriangle size={32} />
            <div className="flex-1">
              <p className="text-xl tracking-tighter">System Error</p>
              <p className="text-sm opacity-90 font-bold lowercase tracking-normal">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-4 p-2 bg-black/20 rounded-full hover:bg-black/40 transition-colors">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuthScreen({ onAuth, isLogin, setIsLogin, email, setEmail, username, setUsername, password, setPassword, error, loading }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="w-full max-w-xl"
    >
      <div className="text-center mb-10">
        <motion.h1 
          className="text-8xl fancy-heading text-white drop-shadow-[0_8px_0_#2A004E]"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <span className="text-[#00E5FF]">WE</span><span className="text-[#76FF03]">BLOX</span>
        </motion.h1>
        <p className="text-[#76FF03] font-black uppercase tracking-[0.4em] text-xs mt-4 opacity-80">Generation Engine: Gemini 3.1 Pro</p>
      </div>

      <div className="bg-white rounded-[48px] p-1 flex flex-col shadow-[0_40px_80px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Tab Controls */}
        <div className="flex bg-slate-100 p-2 rounded-[44px] m-4">
          <button 
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-4 rounded-[36px] font-black uppercase text-xs tracking-widest transition-all ${isLogin ? 'bg-white text-[#2A004E] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Log In
          </button>
          <button 
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-4 rounded-[36px] font-black uppercase text-xs tracking-widest transition-all ${!isLogin ? 'bg-white text-[#2A004E] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Sign Up
          </button>
        </div>

        <div className="p-10 pt-4 flex flex-col gap-6">
          <div className="text-center mb-4">
            <h2 className="text-3xl font-black text-[#2A004E] uppercase tracking-tighter leading-none mb-2">
              {isLogin ? 'Welcome Back' : 'Join the Network'}
            </h2>
            <p className="text-slate-400 font-bold text-sm tracking-tight">
              {isLogin ? 'Enter your deployment credentials to resume building.' : 'Create a new builder identity to start generating worlds.'}
            </p>
          </div>

          <div className="space-y-5">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#2A004E]/50 ml-6">Network Email</label>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="roblox-input w-full"
                placeholder="builder@weblox.io"
              />
            </div>

            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-col gap-2 overflow-hidden"
                >
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#2A004E]/50 ml-6">Callsign (Username)</label>
                  <input 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="roblox-input w-full"
                    placeholder="User_01"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#2A004E]/50 ml-6">Access Code (Password)</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="roblox-input w-full"
                placeholder="Min 8 characters"
              />
            </div>

            {error && (
              <motion.p 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest bg-red-50 py-3 rounded-2xl border border-red-100 px-4"
              >
                {error}
              </motion.p>
            )}

            <button 
              disabled={loading}
              onClick={onAuth} 
              className="roblox-button w-full shadow-[0_12px_0_#4C9900] mt-4 flex items-center justify-center gap-3 py-6 text-xl"
            >
              {loading ? (
                <RefreshCw className="animate-spin" size={24} />
              ) : (
                <>
                  {isLogin ? 'Initialize Lobby' : 'Register Identity'}
                  <Rocket size={24} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LobbyScreen({ idea, setIdea, includeAi, setIncludeAi, onGenerate, history, onPlayAgain }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="w-full max-w-7xl flex flex-col gap-12"
    >
      {/* Main Request Card */}
      <div className="w-full max-w-4xl mx-auto bg-white rounded-[48px] p-12 shadow-[0_30px_70px_rgba(0,0,0,0.4)] flex flex-col gap-10">
        <div className="text-center">
          <h1 className="text-5xl fancy-heading text-[#2A004E] mb-2">What shall we build today?</h1>
          <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Describe your world and our AI will bring it to life in seconds.</p>
        </div>

        <div className="relative group">
          <textarea 
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="E.g. A neon lava obby with spinning platforms and a giant robot boss at the end..."
            className="roblox-input w-full h-40 resize-none text-2xl p-8"
          />
          <div className="absolute top-4 right-4 text-[#2A004E]/10 group-hover:text-[#00E5FF]/30 transition-colors pointer-events-none">
            <Wand2 size={40} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div 
              onClick={() => setIncludeAi(!includeAi)}
              className="flex items-center gap-4 bg-slate-50 px-8 py-4 rounded-3xl border-4 border-slate-100 cursor-pointer hover:border-[#76FF03] transition-all group"
            >
              <div className={`w-14 h-7 rounded-full p-1 transition-colors relative flex items-center ${includeAi ? 'bg-[#76FF03]' : 'bg-slate-300'}`}>
                <motion.div 
                  className="w-5 h-5 bg-white rounded-full shadow-md"
                  animate={{ x: includeAi ? 28 : 0 }}
                />
              </div>
              <span className="text-[#2A004E] font-black uppercase text-xs tracking-widest">Include AI Opponent</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#00E5FF]">Deployment Engine</span>
              <span className="text-xs font-bold text-[#76FF03] uppercase">Gemini 3.1 Pro</span>
            </div>
          </div>

          <button 
            onClick={onGenerate}
            className="roblox-button px-16 py-6 text-2xl shadow-[0_12px_0_#4C9900]"
          >
            Enter Game <span className="text-3xl ml-2">🚀</span>
          </button>
        </div>
      </div>

      {/* Gallery Section */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-8 px-4">
          <h2 className="text-3xl fancy-heading text-[#00E5FF]">Your Creations</h2>
          <div className="h-1 bg-[#00E5FF]/20 flex-1 mx-8 rounded-full"></div>
          <button className="text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-[#76FF03] transition-all">
            History: {history.length} Games
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {history.length === 0 ? (
            <div className="col-span-full border-4 border-dashed border-white/5 rounded-[40px] p-24 text-center">
              <div className="text-8xl mb-6 opacity-10">🎮</div>
              <p className="text-xl font-black uppercase tracking-widest opacity-20">Deployment history empty</p>
            </div>
          ) : (
            history.map((game, i) => (
              <motion.div 
                key={i} 
                whileHover={{ y: -8 }}
                onClick={() => onPlayAgain(game)}
                className={`roblox-card group border-b-[8px] ${
                  i % 4 === 0 ? 'hover:border-[#00E5FF] border-white/5' : 
                  i % 4 === 1 ? 'hover:border-[#FF4081] border-white/5' : 
                  i % 4 === 2 ? 'hover:border-[#76FF03] border-white/5' : 
                  'hover:border-yellow-400 border-white/5'
                }`}
              >
                <div className="aspect-video bg-black/40 rounded-2xl mb-4 flex items-center justify-center overflow-hidden relative">
                  <div className="text-5xl group-hover:scale-125 transition-transform duration-500">
                    {['🌋', '🧟', '🏎️', '🏰', '⚔️', '📦'][i % 6]}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4 font-black text-[#76FF03] uppercase tracking-widest text-xs">
                    Re-Initialize ▶
                  </div>
                </div>
                <h3 className="font-black text-sm uppercase mb-1 truncate text-white/90 group-hover:text-white transition-colors">{game.description}</h3>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">
                    {new Date(game.timestamp).toLocaleDateString()}
                  </span>
                  <span className="text-[#76FF03] text-[10px] font-black group-hover:translate-x-1 transition-transform">PLAY ▶</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LoadingScreen({ idea }: any) {
  const messages = [
    "Compiling Environment Geometry",
    "Injecting Physics Particles",
    "Initializing Logic Routines",
    "Generating Texture Shaders",
    "Awakening AI Opponents"
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex(p => (p + 1) % messages.length), 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center p-20 bg-white rounded-[60px] shadow-[0_0_100px_rgba(0,0,0,0.5)] border-b-[20px] border-slate-200 w-full max-w-2xl"
    >
      <div className="relative mb-12">
        <motion.div 
          className="w-40 h-40 bg-[#00E5FF] rounded-[40px] mx-auto shadow-[0_15px_0_#00AABB]"
          animate={{ rotate: 360, scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-6xl">🚀</div>
      </div>

      <div className="space-y-4">
        <h2 className="text-4xl font-black text-[#2A004E] uppercase tracking-tighter">Forging World</h2>
        <div className="w-full h-6 bg-slate-100 rounded-full overflow-hidden border-4 border-slate-200 shadow-inner">
          <motion.div 
            className="h-full bg-[#76FF03]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 15 }}
          />
        </div>
        <AnimatePresence mode="wait">
          <motion.p 
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-[#00E5FF] font-black uppercase text-xs tracking-[0.5em] h-4"
          >
            {messages[index]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-12 p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 shadow-sm">
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-2">Request Fragment</p>
        <p className="text-[#2A004E] font-bold text-lg italic truncate">"{idea}"</p>
      </div>
    </motion.div>
  );
}

function GameScreen({ code, title, onBack, onRebuild }: any) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current && code) {
      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { margin: 0; background: #000; overflow: hidden; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; }
            canvas { background: #111; max-width: 100%; max-height: 100%; border: 10px solid #2A004E; border-radius: 20px; box-shadow: 0 0 50px rgba(0,0,0,0.8); }
            #ui { position: absolute; top: 30px; left: 30px; color: white; pointer-events: none; text-shadow: 3px 3px 0 rgba(0,0,0,0.8); font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
          </style>
        </head>
        <body>
          <div id="ui">Controls: WASD / Arrows</div>
          <canvas id="gameCanvas" width="800" height="500"></canvas>
          <script>
            (function() {
              try {
                ${code}
              } catch (err) {
                document.body.innerHTML = '<div style="color:red; font-weight:bold; padding: 40px; text-transform:uppercase;">Protocol Failure: ' + err.message + '</div>';
              }
            })();
          </script>
        </body>
        </html>
      `;
      const blob = new Blob([fullHtml], { type: 'text/html' });
      iframeRef.current.src = URL.createObjectURL(blob);
    }
  }, [code]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full flex flex-col items-center gap-8"
    >
      <div className="w-full max-w-6xl flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack} 
            className="group bg-white/10 hover:bg-white/20 p-5 rounded-3xl transition-all border-2 border-white/10"
          >
            <ChevronLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#00E5FF]">Active World</span>
            <h2 className="text-4xl fancy-heading truncate max-w-lg">{title}</h2>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={onRebuild}
            className="bg-white text-[#2A004E] font-black px-10 py-5 rounded-3xl shadow-[0_8px_0_#CBD5E1] hover:translate-y-1 hover:shadow-[0_4px_0_#CBD5E1] transition-all uppercase text-sm flex items-center gap-3"
          >
            <RefreshCw size={20} /> Re-Compile
          </button>
          <button onClick={onBack} className="roblox-button px-12 py-5 shadow-[0_8px_0_#4C9900]">
            Finish Goal <Plus size={24} />
          </button>
        </div>
      </div>

      <div className="w-full max-w-6xl relative">
        <div className="absolute -inset-4 bg-gradient-to-br from-[#00E5FF] via-[#FF4081] to-[#76FF03] rounded-[3.5rem] opacity-20 blur-2xl group-hover:opacity-40 transition-opacity" />
        <div className="relative w-full aspect-[8/5] bg-black rounded-[3rem] border-[12px] border-white/5 shadow-2xl overflow-hidden active:border-[#00E5FF]/50 transition-colors">
          <iframe 
            ref={iframeRef}
            className="w-full h-full border-none"
            title="Generated World View"
            sandbox="allow-scripts"
          />
          
          <div className="absolute top-8 right-8 bg-[#2A004E]/80 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 text-[10px] font-black tracking-widest text-[#76FF03] uppercase">
            Live Rendering Active
          </div>
        </div>
      </div>
      
      <p className="text-white/20 font-black uppercase text-[10px] tracking-[1em]">Roblox Engine Emulation Module v1.0</p>
    </motion.div>
  );
}

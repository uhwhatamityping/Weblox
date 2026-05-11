import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OpenAI from "openai";
import ReactPlayer from 'react-player';
import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';
import Editor from '@monaco-editor/react';
import { 
  Search, 
  Sparkles, 
  Cpu,
  User, 
  AlertTriangle,
  ChevronDown,
  Maximize,
  Minimize,
  ArrowLeft,
  Music,
  Play,
  Pause,
  Square,
  MapPin,
  Fingerprint,
  Maximize2,
  Box,
  Volume2,
  Share2,
  CloudUpload,
  Compass,
  LayoutGrid,
  ArrowRight,
  Home
} from 'lucide-react';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, orderBy, limit, updateDoc } from 'firebase/firestore';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'dotlottie-wc': any;
    }
  }
}

const client = new OpenAI({
  apiKey: import.meta.env.VITE_GROQ_API_KEY || "YOUR_GROQ_API_KEY",
  baseURL: "https://api.groq.com/groq/v1",
  dangerouslyAllowBrowser: true,
});

const DotLottie = 'dotlottie-wc' as any;
const Player = ReactPlayer as any;

// Custom blocks for Three.js
Blockly.Blocks['three_move_player'] = {
  init: function() {
    this.appendValueInput("VX")
        .setCheck("Number")
        .appendField("Set Player Velocity X");
    this.appendValueInput("VY")
        .setCheck("Number")
        .appendField("Y");
    this.appendValueInput("VZ")
        .setCheck("Number")
        .appendField("Z");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(230);
  }
};

javascriptGenerator.forBlock['three_move_player'] = function(block: any, generator: any) {
  var value_vx = generator.valueToCode(block, 'VX', Order.ATOMIC) || '0';
  var value_vy = generator.valueToCode(block, 'VY', Order.ATOMIC) || '0';
  var value_vz = generator.valueToCode(block, 'VZ', Order.ATOMIC) || '0';
  var code = `if (window.playerBody) {
  window.playerBody.velocity[0] = ${value_vx};
  window.playerBody.velocity[1] = ${value_vy};
  window.playerBody.velocity[2] = ${value_vz};
}\n`;
  return code;
};

Blockly.Blocks['three_move_node'] = {
  init: function() {
    this.appendValueInput("VX")
        .setCheck("Number")
        .appendField("Move Node X");
    this.appendValueInput("VY")
        .setCheck("Number")
        .appendField("Y");
    this.appendValueInput("VZ")
        .setCheck("Number")
        .appendField("Z");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(230);
  }
};

javascriptGenerator.forBlock['three_move_node'] = function(block: any, generator: any) {
  var value_vx = generator.valueToCode(block, 'VX', Order.ATOMIC) || '0';
  var value_vy = generator.valueToCode(block, 'VY', Order.ATOMIC) || '0';
  var value_vz = generator.valueToCode(block, 'VZ', Order.ATOMIC) || '0';
  var code = `if (typeof node !== 'undefined' && node && node.position) {
  node.position.x += ${value_vx};
  node.position.y += ${value_vy};
  node.position.z += ${value_vz};
}\n`;
  return code;
};

Blockly.Blocks['three_rotate_node'] = {
  init: function() {
    this.appendValueInput("RX")
        .setCheck("Number")
        .appendField("Rotate Node X");
    this.appendValueInput("RY")
        .setCheck("Number")
        .appendField("Y");
    this.appendValueInput("RZ")
        .setCheck("Number")
        .appendField("Z");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(230);
  }
};

javascriptGenerator.forBlock['three_rotate_node'] = function(block: any, generator: any) {
  var value_vx = generator.valueToCode(block, 'RX', Order.ATOMIC) || '0';
  var value_vy = generator.valueToCode(block, 'RY', Order.ATOMIC) || '0';
  var value_vz = generator.valueToCode(block, 'RZ', Order.ATOMIC) || '0';
  var code = `if (typeof node !== 'undefined' && node && node.rotation) {
  node.rotation.x += ${value_vx};
  node.rotation.y += ${value_vy};
  node.rotation.z += ${value_vz};
}\n`;
  return code;
};

// blockly component
const BlocklyEditor = ({ nodeId, savedXml, onInject, onSaveXml }: { nodeId: string, savedXml: string, onInject:(code:string)=>void, onSaveXml:(xml:string)=>void }) => {
  const workspaceRef = useRef<any>(null);
  const skipNextChangeRef = useRef(false);

  useEffect(() => {
    if (!workspaceRef.current) {
        workspaceRef.current = Blockly.inject('blocklyDiv', {
           toolbox: document.getElementById('toolbox') as HTMLElement,
           renderer: 'zelos',
           theme: Blockly.Themes?.Dark || 'dark', // Fallback
           zoom: {
               controls: true,
               wheel: true,
               startScale: 1.0,
               maxScale: 3,
               minScale: 0.3,
               scaleSpeed: 1.2
           }
        });
        (window as any).blocklyWorkspace = workspaceRef.current;
        
        workspaceRef.current.addChangeListener((e: any) => {
            if (e.isUiEvent || skipNextChangeRef.current) return;
            const code = javascriptGenerator.workspaceToCode(workspaceRef.current as any);
            const dom = Blockly.Xml.workspaceToDom(workspaceRef.current);
            const xml = Blockly.Xml.domToText(dom);
            onInject(code);
            onSaveXml(xml);
        });
    }
  }, []); // Only init once
  
  useEffect(() => {
    if (workspaceRef.current) {
      skipNextChangeRef.current = true;
      workspaceRef.current.clear();
      if (savedXml) {
         try {
             const dom = Blockly.Xml.textToDom(savedXml);
             Blockly.Xml.domToWorkspace(dom, workspaceRef.current);
         } catch(e) {
             console.error('Failed to load blockly xml', e);
         }
      }
      setTimeout(() => { skipNextChangeRef.current = false; }, 50);
    }
  }, [nodeId]); // Run when node changes

  return (
    <div className="flex-1 flex flex-col font-sans w-full h-full relative">
      <div className="bg-[#2d2d2d] px-3 py-1.5 font-bold uppercase tracking-wider text-gray-400 border-b border-[#111]">
         Scripts: {nodeId === 'global_script' ? 'Global' : nodeId || 'None'}
      </div>
      <div id="blocklyDiv" className="absolute top-8 bottom-0 left-0 right-0 bg-[#1e1e1e]"></div>
      
      <xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style={{ display: 'none' }}>
        <category name="Events" colour="#FFBF00">
          <block type="logic_boolean"></block>
        </category>
        <category name="Control" colour="#FFAB19">
          <block type="controls_if"></block>
        </category>
        <category name="Operators" colour="#59C059">
          <block type="logic_compare"></block>
          <block type="logic_operation"></block>
          <block type="math_number"></block>
          <block type="math_arithmetic"></block>
        </category>
        <category name="Motion" colour="#4C97FF">
          <block type="three_move_player"></block>
          <block type="three_move_node"></block>
          <block type="three_rotate_node"></block>
        </category>
      </xml>
    </div>
  );
};

const LANGUAGES = [
  { name: 'English', code: 'en' },
  { name: 'Azerbaijani', code: 'az' },
  { name: 'Spanish', code: 'es' },
  { name: 'French', code: 'fr' },
  { name: 'German', code: 'de' },
  // ... cutting down just for space, keeping main requested ones
  { name: 'Italian', code: 'it' },
  { name: 'Portuguese', code: 'pt' },
  { name: 'Russian', code: 'ru' },
  { name: 'Chinese (Simplified)', code: 'zh-CN' },
  { name: 'Japanese', code: 'ja' },
  { name: 'Korean', code: 'ko' },
  { name: 'Arabic', code: 'ar' }
];

const DEFAULT_UI = {
  search: "Search logs...",
  placeholder: "Type your colorful, 3D prompt idea here...",
  build: "BUILD!",
  expanding: "Expanding...",
  translating: "Translating...",
  generating: "Generating 3D Game...",
  back: "Back to Builder",
  expandPrompt: "Expand Prompt",
  planMode: "Plan Mode",
  language: "Language",
  networkIdentity: "Network Identity",
  checkItOut: "Check it out!",
  scroll: "Scroll...",
  starting: "Starting Engine...",
  game1Title: "Cyber Punk Hover Race",
  game1Author: "by MetaGames",
  game2Title: "Neon Parkour Obby",
  game2Author: "by SynthWave"
};

type LogType = 'info' | 'success' | 'error' | 'process' | 'warning';
interface LogItem {
  id: string;
  timestamp: string;
  message: string;
  type: LogType;
}

const FUN_PHRASES = [
  "writing...",
  "fixing...",
  "spinning...",
  "Defining life...",
  "foolishly writing code...",
  "crunching voxels...",
  "summoning bugs...",
  "asking local shaman..."
];

function FunSpinner() {
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    const int = setInterval(() => {
      setIdx(i => (i + 1) % FUN_PHRASES.length);
    }, 1500);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="flex items-center justify-center gap-3 text-[#76FF03] font-mono text-[16px] tracking-widest uppercase">
      <div className="animate-spin w-5 h-5 border-2 border-[#76FF03] border-t-transparent rounded-full flex-shrink-0" />
      <span className="opacity-80">{FUN_PHRASES[idx]}</span>
    </div>
  );
}

export default function App() {
  const [viewState, setViewState] = useState<'auth' | 'home' | 'loading' | 'game' | 'explore' | 'profile'>(() => {
    const p = window.location.pathname;
    if (p !== '/' && p.split('/').filter(Boolean).length === 2) return 'loading';
    return 'auth';
  });
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Auth State
  const [authName, setAuthName] = useState('');
  const [userName, setUserName] = useState('DefaultName');
  const [userLocDisplay, setUserLocDisplay] = useState('Location Unknown');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // Customization State
  const [appTheme, setAppTheme] = useState('Theme: Midnight Purple (Default)');
  const [customBanner, setCustomBanner] = useState('Welcome to Weblox! Start building your dream 3D game.');

  // Builder State
  const [prompt, setPrompt] = useState('');
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState({ type: '', audience: '', mood: '', name: '' });
  const [isExpanding, setIsExpanding] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandToggle, setExpandToggle] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [aiModel, setAiModel] = useState('Gemini 2.5 Flash');
  const [error, setError] = useState<string | null>(null);
  
  // Advanced Game Features
  const [skinUsername, setSkinUsername] = useState('');
  const [includeShop, setIncludeShop] = useState(true);
  const [addPlatforms, setAddPlatforms] = useState(true);
  const [addCheckpoints, setAddCheckpoints] = useState(true);
  const [fogColor, setFogColor] = useState('#87CEEB');
  const [fogDensity, setFogDensity] = useState('0.02');
  const [skyboxTheme, setSkyboxTheme] = useState('Sky Blue');
  
  // Game Rendering State
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [editableCode, setEditableCode] = useState<string>("");
  const [showBlockly, setShowBlockly] = useState(false);
  const [hierarchy, setHierarchy] = useState<{uuid: string, type: string, name: string, pos: number[]}[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>('global_script');
  const [nodeXmls, setNodeXmls] = useState<Record<string, string>>({});
  const gameWrapperRef = useRef<HTMLDivElement>(null);
  const autoFixAttempts = useRef(0);
  const lastErrorTime = useRef(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasStartedSharedGame, setHasStartedSharedGame] = useState(false);

  // Music Player State
  const [ytUrl, setYtUrl] = useState('');
  const [playedUrl, setPlayedUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [volume, setVolume] = useState(1);

  // Custom UI translations state
  const [ui, setUi] = useState(DEFAULT_UI);

  // Detailed Logs State
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Firebase Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [currentSharedGameId, setCurrentSharedGameId] = useState<string | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [currentRating, setCurrentRating] = useState<number>(0);

  // Explore State
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [isLoadingExplore, setIsLoadingExplore] = useState(false);
  const [exploreFilterTag, setExploreFilterTag] = useState('');

  // Profile State
  const [myGames, setMyGames] = useState<any[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Avatar State
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarBodyShape, setAvatarBodyShape] = useState('blocky');
  const [avatarColor, setAvatarColor] = useState('#00E5FF');
  const [avatarAccessory, setAvatarAccessory] = useState('none');

  // Tagging State
  const [gameTags, setGameTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  const fetchMyGames = async () => {
    if (!user) return;
    setIsLoadingProfile(true);
    try {
       const q = query(collection(db, "games"), where("userId", "==", user.uid), orderBy("timestamp", "desc"), limit(20));
       const d = await getDocs(q);
       setMyGames(d.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    } catch(e: any) {
       console.error("Profile games error", e);
       addLog("Failed to load your games: " + e.message, "error");
    } finally {
       setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (viewState === 'profile') {
      fetchMyGames();
    }
  }, [viewState, user]);
  const fetchExploreGames = async (tagFilter?: string) => {
    setIsLoadingExplore(true);
    setViewState('explore');
    if (tagFilter !== undefined) {
      setExploreFilterTag(tagFilter);
    }
    
    try {
       const tagToFilter = tagFilter !== undefined ? tagFilter : exploreFilterTag;
       const filterActive = tagToFilter && tagToFilter.trim() !== '';
       
       let q;
       if (filterActive) {
         q = query(collection(db, "games"), where("tags", "array-contains", tagToFilter.trim().toLowerCase()), limit(18));
       } else {
         q = query(collection(db, "games"), orderBy("timestamp", "desc"), limit(18));
       }
       
       const d = await getDocs(q);
       setRecentGames(d.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    } catch(e: any) {
       console.error("Explore error", e);
       addLog("Failed to load explore feed: " + e.message, "error");
    } finally {
       setIsLoadingExplore(false);
    }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        let username = firebaseUser.displayName || "Player";
        let slug = username.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + firebaseUser.uid.slice(0, 4);
        const docRef = doc(db, 'profiles', username);
        const docSnap = await getDoc(docRef);
        
        let profileData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          username: username,
          slug: slug,
          timestamp: new Date().toISOString()
        };

        if (docSnap.exists()) {
           profileData = docSnap.data() as any;
        } else {
           try {
              await setDoc(docRef, profileData, { merge: true });
           } catch(e: any) {
              addLog("Init setDoc error: " + e.message, "error");
           }
        }
        setUserProfile(profileData);
      } else {
        setUserProfile(null);
      }
    });
  }, []);

  // Handle URL Routing / sharing logic
  useEffect(() => {
    const path = window.location.pathname;
    if (path !== '/' && path.length > 1) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length === 2) {
        const creatorSlug = parts[0];
        const gameSlug = parts[1];
        
        const fetchSharedGame = async () => {
          setIsGenerating(true);
          addLog(`Loading shared game: /${creatorSlug}/${gameSlug}`, "process");
          try {
             const q = query(collection(db, "games"), where("creatorSlug", "==", creatorSlug), where("gameSlug", "==", gameSlug));
             const docs = await getDocs(q);
             if (!docs.empty) {
               const gameDoc = docs.docs[0];
               setCurrentSharedGameId(gameDoc.id);
               setPrompt(gameDoc.data().description || "Shared Applet"); // set prompt text for context
               setGameCode(gameDoc.data().code);
               setViewState('game');
               addLog("Shared game loaded successfully!", "success");
             } else {
               addLog("Game not found. Check the URL.", "error");
               setError("Game not found. Redirecting to home...");
               setTimeout(() => window.location.href = '/', 3000);
             }
          } catch (e) {
             console.error(e);
             addLog("Error loading game.", "error");
          } finally {
             setIsGenerating(false);
          }
        };
        fetchSharedGame();
      }
    }
  }, []);

  // Listen for Save/Load messages from the IFrame Game Loop
  useEffect(() => {
    const handleMessage = async (e: MessageEvent) => {
      // Allow receiving messages from iframe
      if (e.data?.type === 'save-game') {
        if (!user) {
          addLog("You must be logged in to save your game to the cloud.", "error");
          return;
        }
        setSaveLoading(true);
        try {
           const stateData = e.data.state;
           const gameIdKey = currentSharedGameId || "local_session";
           // Ensure save schema passes isValidSave
           await setDoc(doc(db, 'saves', `${user.uid}_${gameIdKey}`), {
             userId: user.uid,
             gameId: gameIdKey,
             stateData: stateData,
             timestamp: new Date().toISOString()
           });
           addLog("Game state saved to Cloud Firestore!", "success");
        } catch(err: any) {
           addLog("Failed to save: " + err.message, "error");
        } finally {
           setSaveLoading(false);
        }
      }
      if (e.data?.type === 'request-load') {
         if (!user) {
           addLog("You must be logged in to load your game from the cloud.", "error");
           return;
         }
         setSaveLoading(true);
         try {
           const gameIdKey = currentSharedGameId || "local_session";
           const docSnap = await getDoc(doc(db, 'saves', `${user.uid}_${gameIdKey}`));
           if (docSnap.exists()) {
             const stateData = docSnap.data().stateData;
             const iframe = document.getElementById('game-frame') as HTMLIFrameElement;
             iframe.contentWindow?.postMessage({ type: 'load-game-data', state: stateData }, '*');
             addLog("Game state restored from Cloud Firestore!", "success");
           } else {
             addLog("No cloud save found for this game session.", "process");
           }
         } catch(err: any) {
           addLog("Failed to load: " + err.message, "error");
         } finally {
           setSaveLoading(false);
         }
      }
      
      if (e.data?.type === 'game-error' && e.data.error) {
         console.error("Game Error:", e.data.error);
         const now = Date.now();
         if (!isGenerating && autoFixAttempts.current < 0 && (now - lastErrorTime.current > 10000)) {
            // Disabled auto-fix based on user limits constraint
            lastErrorTime.current = now;
            autoFixAttempts.current += 1;
            modifyGame(e.data.error, true);
         } else if (now - lastErrorTime.current > 10000) {
            lastErrorTime.current = now;
            addLog(`Game crashed with: ${e.data.error}`, "error");
         }
      }
      
      if (e.data?.type === 'OPEN_BLOCKLY') {
         setShowBlockly(true);
      }

      if (e.data?.type === 'HIERARCHY_UPDATE') {
         setHierarchy(e.data.nodes);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user, currentSharedGameId, isGenerating, gameCode]);

  const addLog = (message: string, type: LogType = 'info') => {
    setLogs(prev => [
      { id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toLocaleTimeString(), message, type },
      ...prev
    ]);
  };

  // Loading State Arcade
  const [showArcade, setShowArcade] = useState(false);
  const [arcadeGameUrl, setArcadeGameUrl] = useState<string | null>(null);

  const ARCADE_GAMES = [
    { id: 1, name: "Asteroids", url: "https://xem.github.io/js13k-asteroids/" },
    { id: 2, name: "Underrun", url: "https://phoboslab.org/underrun/" },
    { id: 3, name: "Radius Raid", url: "https://jackrugile.com/radius-raid/" },
    { id: 4, name: "Hextris", url: "https://hextris.io/" },
    { id: 5, name: "2048", url: "https://play2048.co/" },
    { id: 6, name: "Flappy Bird", url: "https://nebezb.com/floppybird/" },
    { id: 7, name: "Pacman", url: "https://pacman.platzh1rsch.ch/" },
    { id: 8, name: "Core", url: "https://hakim.se/experiments/html5/core/01/" },
    { id: 9, name: "Coil", url: "https://hakim.se/experiments/html5/coil/" },
    { id: 10, name: "Sinuous", url: "https://hakim.se/experiments/html5/sinuous/01/" },
    { id: 11, name: "Tetris", url: "https://jakesgordon.com/javascript-tetris/" },
    { id: 12, name: "Pong", url: "https://jakesgordon.com/javascript-pong/" },
    { id: 13, name: "Snake", url: "https://jakesgordon.com/javascript-snake/" },
    { id: 14, name: "Racer", url: "https://jakesgordon.com/javascript-boulderdash/" },
    { id: 15, name: "HexGL", url: "https://hexgl.bkcore.com/play/" }
  ];

  // AI Coder Listener for Iframe
  useEffect(() => {
    const aiCodeTarget = async (e: MessageEvent) => {
      if (e.data?.type === 'WEBLOX_AI_CODE_REQUEST') {
        try {
          addLog("Weblox Editor: AI coding requested...", "process");
          const response = await (client as any).responses.create({
             model: "groq/compound",
             input: `SYSTEM INSTRUCTION: Output ONLY raw three.js code. The current scene is window.SCENE. Add the object to the scene. NO Markdown, NO explanation.\n\nUSER PROMPT: ${e.data.prompt}`
          });
          const rawCode = response.output_text?.replace(/```javascript|```js|```/g, '').trim() || "";
          gameWrapperRef.current?.querySelector('iframe')?.contentWindow?.postMessage({
             type: 'WEBLOX_AI_CODE_RESPONSE',
             id: e.data.id,
             code: rawCode
          }, '*');
          addLog("Weblox Editor: AI code injected successfully.", "success");
        } catch (err: any) {
          let errorMsg = err.message || "Unknown error";
          if (errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429")) {
            errorMsg = "You have exceeded your AI generation quota. Please wait a bit before generating again, or provide your own API key if you are running this locally.";
          }
          gameWrapperRef.current?.querySelector('iframe')?.contentWindow?.postMessage({
             type: 'WEBLOX_AI_CODE_ERROR',
             id: e.data.id,
             error: errorMsg
          }, '*');
          addLog("Weblox Editor: AI Code error: " + errorMsg, "error");
        }
      }
    };
    window.addEventListener('message', aiCodeTarget);
    return () => window.removeEventListener('message', aiCodeTarget);
  }, []);

  // Initial Boot
  useEffect(() => {
    addLog("System initialized. Auth gateway ready.", "info");
  }, []);

  // Fullscreen Listener
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      gameWrapperRef.current?.requestFullscreen().catch(err => {
        addLog(`Fullscreen error: ${err.message}`, 'error');
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Auth Logic
  const handleAuth = () => {
    if (!authName.trim()) {
      setError("Please enter your name to connect.");
      return;
    }
    
    setIsAuthenticating(true);
    addLog("Requesting geospatial coordinates...", "process");

    const storageKey = `weblox_user_${authName.trim().toLowerCase()}`;
    
    const proceedWithoutLocation = (reason: string) => {
      const name = authName.trim();
      const savedData = localStorage.getItem(storageKey);
      
      setUserName(name);
      setUserLocDisplay('Location Skipped');
      setViewState('home');
      addLog(`Proceeding without GPS: ${reason}`, "warning");
      
      if (!savedData) {
        localStorage.setItem(storageKey, JSON.stringify({ name, location: 'Location Skipped' }));
      }
      
      addLog(`Welcome, ${name}.`, "success");
      setIsAuthenticating(false);
    };

    if (!navigator.geolocation) {
      proceedWithoutLocation("Browser unsupported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(2);
        const lon = position.coords.longitude.toFixed(2);
        const locString = `${lat},${lon}`;
        
        const savedData = localStorage.getItem(storageKey);

        if (savedData) {
          const parsed = JSON.parse(savedData);
          if (parsed.location === locString || parsed.location === 'Location Skipped') {
            if (parsed.location === 'Location Skipped') {
               localStorage.setItem(storageKey, JSON.stringify({ name: authName.trim(), location: locString }));
            }
            setUserName(parsed.name);
            setUserLocDisplay(locString);
            setViewState('home');
            addLog(`Identity verified. Welcome back, ${parsed.name}.`, "success");
          } else {
            setError(`Security Alert: Location mismatch for user ${authName}. Expected ${parsed.location}, got ${locString}.`);
            addLog("Auth Blocked: GEO_MISMATCH", "error");
          }
        } else {
          // New User
          const newUser = { name: authName.trim(), location: locString };
          localStorage.setItem(storageKey, JSON.stringify(newUser));
          setUserName(newUser.name);
          setUserLocDisplay(locString);
          setViewState('home');
          addLog(`New identity registered: ${newUser.name} at ${locString}.`, "success");
        }
        setIsAuthenticating(false);
      },
      (geoErr) => proceedWithoutLocation(geoErr.message)
    );
  };

  const startBlankGame = () => {
      let rawCode = `import * as THREE from 'three';
import { Physics } from 'voxel-physics-engine';

window.SCENE = new THREE.Scene();
window.SCENE.background = new THREE.Color("#87CEEB");

window.CAMERA = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(100, 200, 50);
light.castShadow = true;
window.SCENE.add(light);
window.SCENE.add(new THREE.AmbientLight(0x404040, 0.6));

const clock = new THREE.Clock();
window.nodeScripts = window.nodeScripts || {};
function animate() {
  requestAnimationFrame(animate);
  let dt = clock.getDelta() * 1000;
  
  if (window.window.customGameTick) {
      window.window.customGameTick(dt);
  }
  
  for (const uuid in window.nodeScripts) {
      const node = window.SCENE.getObjectByProperty('uuid', uuid) || document.getElementById(uuid);
      if (node && window.nodeScripts[uuid]) {
          try {
             window.nodeScripts[uuid](THREE, window.SCENE, dt, node);
          } catch(e) {}
      } else if (uuid === 'global_script' && window.nodeScripts[uuid]) {
          try {
             window.nodeScripts[uuid](THREE, window.SCENE, dt, null);
          } catch(e) {}
      }
  }
  
  renderer.render(window.SCENE, window.CAMERA);
}
animate();`;
      setGameCode(rawCode);
      setEditableCode(rawCode);
      setViewState('game');
  };

  // UI Translation Hook
  useEffect(() => {
    if (viewState === 'auth') return;
    if (language.code === 'en') {
      setUi(DEFAULT_UI);
      return;
    }

    const translateUI = async () => {
      addLog(`Translating UI to ${language.name}...`, 'process');
      try {
        const keys = Object.keys(DEFAULT_UI) as (keyof typeof DEFAULT_UI)[];
        const textToTranslate = keys.map(k => DEFAULT_UI[k]).join('\n');
        
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${language.code}&dt=t&q=${encodeURIComponent(textToTranslate)}`);
        if (!res.ok) throw new Error("API failed");
        
        const data = await res.json();
        const translatedText = data[0].map((x: any) => x[0]).join('');
        const parts = translatedText.split('\n');
        
        const newUi = { ...DEFAULT_UI };
        keys.forEach((key, i) => {
          if (parts[i]) newUi[key] = parts[i].trim();
        });
        
        setUi(newUi);
        addLog(`UI translated.`, 'success');
      } catch(e) {
        addLog(`UI Translate Failed.`, 'error');
      }
    };
    translateUI();
  }, [language.code, viewState]);

  // Build Request
  const handleBuild = async () => {
    if (!prompt.trim() && !wizardData.name.trim()) {
      addLog("Build aborted: Setup required.", "error");
      return;
    }

    autoFixAttempts.current = 0;
    setViewState('loading');
    setLoadingMessage(ui.starting);
    setError(null);
    let currentText = `Game Name: ${wizardData.name || 'Untitled'}\nType: ${wizardData.type || '3D'}\nAudience: ${wizardData.audience || 'General'}\nMood: ${wizardData.mood || 'Fun'}\nDetails: ${prompt}`;

    try {
      setLoadingMessage(ui.generating);
      setIsGenerating(true);
      addLog("Initializing Weblox Editor Engine...", "process");

      let rawCode = `import * as THREE from 'three';
import { Physics } from 'voxel-physics-engine';

window.SCENE = new THREE.Scene();
window.SCENE.background = new THREE.Color("${skyboxTheme === 'Toxic Wasteland' ? '#556B2F' : '#87CEEB'}");
window.SCENE.fog = new THREE.FogExp2(window.SCENE.background, 0.02);

window.CAMERA = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(100, 200, 50);
light.castShadow = true;
window.SCENE.add(light);
window.SCENE.add(new THREE.AmbientLight(0x404040, 0.6));

const blockMap = {};
window.blockMap = blockMap;

const textureLoader = new THREE.TextureLoader();
window.textures = {
  grass: textureLoader.load('/textures/grass_top.png'),
  stone: textureLoader.load('/textures/stone.png'),
  dirt: textureLoader.load('/textures/dirt.png'),
  bricks: textureLoader.load('/textures/bricks.png'),
  wood: textureLoader.load('/textures/oak_planks.png')
};
Object.values(window.textures).forEach(t => t.magFilter = THREE.NearestFilter);

const physics = new Physics({ gravity: [0, -30, 0] }, (x, y, z) => !!blockMap[\`\${Math.floor(x)},\${Math.floor(y)},\${Math.floor(z)}\`], () => false);

const playerBody = physics.addBody({ base: [0, 5, 0], vec: [1, 2, 1] }, 1, 1, 0, 1, null);
window.playerBody = playerBody;

const playerGeo = new THREE.BoxGeometry(1, 2, 1);
const playerMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
window.PLAYER_MESH = new THREE.Mesh(playerGeo, playerMat);
window.SCENE.add(window.PLAYER_MESH);

// Generate flat floor
for (let x = -20; x < 20; x++) {
  for (let z = -20; z < 20; z++) {
    blockMap[\`\${x},-1,\${z}\`] = 'grass';
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ map: window.textures.grass });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + 0.5, -0.5, z + 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    window.SCENE.add(mesh);
  }
}

let keys = { };
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

window.placeBlock = (x, y, z, textureName) => {
    blockMap[\`\${x},\${y},\${z}\`] = textureName;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ map: window.textures[textureName] || window.textures.grass });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    window.SCENE.add(mesh);
};

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  let dt = clock.getDelta() * 1000;
  
  let speed = 10;
  playerBody.velocity[0] = 0;
  playerBody.velocity[2] = 0;
  if (keys['w']) playerBody.velocity[2] = -speed;
  if (keys['s']) playerBody.velocity[2] = speed;
  if (keys['a']) playerBody.velocity[0] = -speed;
  if (keys['d']) playerBody.velocity[0] = speed;
  if (keys[' '] && playerBody.atRestY() < 0) playerBody.velocity[1] = 12;

  physics.tick(dt);
  
  let pos = playerBody.getPosition();
  window.PLAYER_MESH.position.set(pos[0], pos[1] + 1, pos[2]);
  window.CAMERA.position.set(pos[0], pos[1] + 3, pos[2] + 7);
  window.CAMERA.lookAt(pos[0], pos[1] + 1, pos[2]);
  
  if (window.customGameTick) {
     try { window.customGameTick(dt); } catch(e) {}
  }
  
  renderer.render(window.SCENE, window.CAMERA);
}
animate();`;

      setGameCode(rawCode);
      setEditableCode(rawCode);
      setViewState('game');
      addLog(`Game compiled! Launching...`, "success");

    } catch (err: any) {
      console.error(err);
      let errorMsg = err.message || "Failed to process request.";
      if (errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429")) {
        errorMsg = "You have exceeded your AI generation quota. Please wait a bit before generating again, or provide your own API key if you are running this locally.";
      }
      setError(errorMsg);
      addLog(`Generation failed: ${errorMsg}`, "error");
      setViewState('builder');
    } finally {
      setIsExpanding(false);
      setIsTranslating(false);
      setIsGenerating(false);
    }
  };

  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'system', message: string}[]>([]);

  const getEngineInstructions = () => {
    const is2D = wizardData.type.includes('2D');
    
    let sysInstruction = `You are a strict Three.js expert. Output ONLY raw, vanilla JavaScript code. NO Markdown.
CRITICAL RULES FOR SPEED AND CORRECTNESS:
1. Include at top: import * as THREE from 'three';
2. Setup Scene, ${is2D ? 'OrthographicCamera or PerspectiveCamera set up for 2D view' : 'PerspectiveCamera'}, WebGLRenderer (append to document.body).
3. CRITICAL: Assign your scene to 'window.SCENE = scene;' and your main player group/mesh to 'window.PLAYER_MESH = player;' so Weblox can access them!
4. Handle window resize bounds and the requestAnimationFrame loop. Guard against unbounded variable accumulation.
5. ${is2D ? 'Keep camera positioned to view the 2D plane.' : 'Listen for "cameradrag" event on window to apply FIRST-PERSON camera rotation.'}
6. PHYSICS INTEGRATION (ABSOLUTELY MANDATORY): 
   - You MUST import the engine: \`import { Physics } from 'voxel-physics-engine';\` at the very top.
   - Maintain a \`blockMap\` object representing solid blocks. Set \`blockMap[\`\${Math.floor(x)},\${Math.floor(y)},\${Math.floor(z)}\`] = true\` for EVERY block you generate! Start by generating ${is2D ? '2D platforms and terrain along the XY plane' : 'hilly 3D terrain'} to prevent falling.
   - Initialize the engine: \`const physics = new Physics({ gravity: [0, -30, 0] }, (x, y, z) => { return !!blockMap[\`\${Math.floor(x)},\${Math.floor(y)},\${Math.floor(z)}\`]; }, (x, y, z) => false)\`
   - Define your player body: \`const playerBody = physics.addBody({ base: [0, 5, 0], vec: [1, 2, 1] }, 1, 1, 0, 1, null);\`
   - In your render loop, track time delta (\`let dt = clock.getDelta() * 1000;\`) and call \`physics.tick(dt)\`. Sync your \`camera\` and \`PLAYER_MESH\` position to \`playerBody.getPosition()\`.
7. Add basic movement/keyboard event listeners (WASD/Space/Arrows). 
   - Move by modifying \`playerBody.velocity[0]\` and \`${is2D ? 'playerBody.velocity[1]' : 'playerBody.velocity[2]'}\`. Do NOT manually set positions!
   - Read \`playerBody.atRestY()\` properly to restrict jump (\`if (playerBody.atRestY() < 0) playerBody.velocity[1] = 12;\`).
8. SCENE BLOCKS AND VOXELS (CRITICAL): Generate at least 50-100 textured voxel blocks (walls, platforms, structures) matching the user prompt. DO NOT just make a flat floor! Add every block's coordinates to \`blockMap\`. ${is2D ? 'Ensure blocks are placed primarily on the 2D plane (e.g. z=0).' : ''}
9. TEXTURES (MANDATORY): You MUST use THREE.TextureLoader().load('/textures/<filename>.png') to load textures for the blocks!. ${is2D ? "For 2D, you MUST load '/textures/custom_tileset.png' and use texture.repeat and texture.offset (e.g. texture.repeat.set(1/columns, 1/rows); texture.offset.set(col/columns, 1 - row/rows);) to cut a single block out of the tileset to use as material, matching the user's request." : "The available textures are: cobblestone, mossy_cobblestone, bricks, grass_side, oak_planks, dirt, grass_top, stone, sand, brick, glass. DO NOT use plain color materials for blocks. Apply textures!"}
10. Write dense, optimized code. Start the loop! DO NOT USE UNDEFINED VARIABLES.
!!! IMPORTANT PROMPT REQUIREMENT !!!
DO NOT JUST GENERATE A JOYSTICK OR A JUMP BUTTON! YOU MUST GENERATE A FULL WORKING ${is2D ? '2D' : '3D'} GAME WORLD WITH TERRAIN, GEOMETRY, COLLISION, A PLAYER, AND INTERACTIONS. 
`;

    if (skinUsername.trim()) {
       sysInstruction += `\n11. MUST build a detailed multipart player model (arms, legs, body, head using THREE.Group) and use 'https://starlightskins.lunareclipse.studio/skin/${skinUsername.trim()}' as the Material map.`;
    } else {
       sysInstruction += `\n11. Must build a detailed player model (not just a basic box).`;
    }

    if (includeShop) sysInstruction += `\n12. Force inject a DOM HTML overlay displaying a working Inventory and Shop system.`;
    if (addPlatforms) sysInstruction += `\n13. Scatter functional textured platforms for the user to jump on (add to blockMap).`;
    if (addCheckpoints) sysInstruction += `\n14. Implement physical checkpoint zones that respawn the player upon death.`;
    
    sysInstruction += `\n15. Terrain Generation: You MUST generate terrain (e.g. using Math.sin/Math.cos) with voxel blocks rather than a flat floor. Add all terrain blocks to blockMap!`;
    sysInstruction += `\n16. Death & Respawn: Include a death mechanic (falling below y=-20). Upon death, reset playerBody.position to [0, 5, 0] (or similar) and reset health.`;
    sysInstruction += `\n17. Health System: Manage a 10-heart health system. Call window.updateHealth(currentHealth) correctly.`;
    sysInstruction += `\n18. CRITICAL: DO NOT use require(). You are running in an ES Module browser environment. Use 'import'.`;
    sysInstruction += `\n19. CONTROLS: Implement Keyboard/Mouse controls. ${is2D ? 'Follow standard 2D game control schemes.' : 'Combine WASD movement with mouse look smoothly.'}`;
    sysInstruction += `\n20. PLAYER ACTIONS: Implement standard voxel game actions using THREE.Raycaster from the camera or mouse:
   - Break blocks on Left Click (remove mesh from scene, delete from blockMap).
   - Place blocks on Right Click (add new mesh to scene, add to blockMap) adjacent to the intersection face.
   - Combat: Raycast for enemies/entities on click, apply damage or knockback (e.g. modify enemy body velocity).
   - Items: Spawn mini floating items when breaking blocks. Detect distance to player to "pick up". Press 'Q' to drop items as physical entities in the world.`;

    if (is2D) {
       sysInstruction += `\n24. MUSIC GENERATION: You MUST include this exact code at the top to generate 16-bit game music. Do not block the game loop if it fails:
async function __genMusic() {
  try {
    const response = await fetch('https://api.sonauto.ai/v1/generations/v3', {
      method: 'POST',
      headers: { 
         'Authorization': 'Bearer your_api_key_here',
         'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ prompt: '16-bit upbeat background music' }),
    });
    const { task_id: taskId } = await response.json();
    console.log('Task ID:', taskId);
  } catch (e) {
    console.warn('Failed to generate music', e);
  }
}
__genMusic();`;
    }
    
    return sysInstruction;
  };

  const modifyGame = async (modificationPrompt: string, isErrorFix: boolean = false) => {
    console.log("modifyGame disabled since AI is removed. Error was:", modificationPrompt);
  };

  // Music Player Handlers
  const handleMusicLoad = () => {
    if (!ytUrl) {
      setError("Please paste a valid Audio or SoundCloud URL first.");
      return;
    }
    setIsPlayerReady(false);
    setIsPlaying(true);
    setPlayedUrl(ytUrl);
    addLog(`Loading audio track: ${ytUrl}`, "process");
  };

  const stopMusic = () => {
    setIsPlaying(false);
    setTimeout(() => {
      setIsPlayerReady(false);
      setPlayedUrl('');
      setYtUrl('');
      addLog("Music stopped.", "info");
    }, 100);
  };

  const getIframeContent = (scriptCode: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        body { margin: 0; background: #0F001A; overflow: hidden; color: white; touch-action: none; user-select: none; -webkit-user-select: none; }
        canvas { display: block; width: 100vw; height: 100vh; object-fit: cover; }
        #error-overlay { display: none; position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.8); color: #FF4081; padding: 40px; font-family: monospace; font-size: 16px; font-weight: bold; overflow-y: auto; }
        
        /* Mobile Overlay Controls */
        #mobile-controls {
          position: fixed;
          bottom: 30px;
          left: 0;
          width: 100%;
          pointer-events: none;
          z-index: 1000;
          display: flex;
          justify-content: space-between;
          padding: 0 40px;
          box-sizing: border-box;
          opacity: 0.8;
        }

        .ctrl-btn {
          pointer-events: auto;
          background: rgba(0, 229, 255, 0.1);
          border: 2px solid rgba(0, 229, 255, 0.5);
          color: white;
          font-weight: 900;
          font-family: sans-serif;
          display: flex; 
          justify-content: center; 
          align-items: center;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 0 0 20px rgba(0, 229, 255, 0.2);
          transition: all 0.1s ease;
        }
        .ctrl-btn:active { 
          background: rgba(0, 229, 255, 0.4); 
          transform: scale(0.95);
          box-shadow: 0 0 30px rgba(0, 229, 255, 0.6);
        }
        
        #d-pad {
          position: relative;
          width: 150px; 
          height: 150px;
        }
        .d-btn {
           position: absolute; 
           width: 50px; 
           height: 50px;
           border-radius: 12px;
        }
        #btn-w { top: 0; left: 50px; }
        #btn-s { bottom: 0; left: 50px; }
        #btn-a { top: 50px; left: 0; }
        #btn-d { top: 50px; right: 0; }
        
        #jump-wrapper {
           display: flex;
           align-items: flex-end;
           padding-bottom: 25px;
        }
        
        #jump-btn {
           width: 80px; 
           height: 80px; 
           border-radius: 50%;
           background: rgba(118, 255, 3, 0.1);
           border-color: rgba(118, 255, 3, 0.5);
           box-shadow: 0 0 20px rgba(118, 255, 3, 0.2);
        }
        #jump-btn:active { 
           background: rgba(118, 255, 3, 0.4); 
           box-shadow: 0 0 30px rgba(118, 255, 3, 0.6);
        }
        
        @media (min-width: 1024px) {
          /* Optionally hide if on large screens to clean up UI */
          /* #mobile-controls { opacity: 0.3; } */
        }
      </style>
      <script type="importmap">
        {
          "imports": {
            "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
            "voxel-physics-engine": "/physics/index.js"
          }
        }
      </script>
      <script>
        let lastErrorTime = 0;
        let errorCount = 0;
        window.addEventListener('error', function(event) {
          const now = Date.now();
          if (now - lastErrorTime > 1000) {
             lastErrorTime = now;
             errorCount++;
             const overlay = document.getElementById('error-overlay');
             if (overlay) {
                overlay.style.display = 'block';
                overlay.innerHTML = 'Game Execution Error:<br><br>' + event.message + '<br><br>At line: ' + event.lineno;
             }
             if (errorCount < 10) {
                window.parent.postMessage({ type: 'game-error', error: event.message + ' at line ' + event.lineno }, '*');
             }
          }
        });
        window.addEventListener('unhandledrejection', function(event) {
          const now = Date.now();
          if (now - lastErrorTime > 1000) {
             lastErrorTime = now;
             errorCount++;
             if (errorCount < 10) {
                window.parent.postMessage({ type: 'game-error', error: event.reason ? event.reason.toString() : 'Unhandled Rejection' }, '*');
             }
          }
        });
        
        // Simulates a Keyboard Event dispatched directly to the Window scope
        function pushKey(keyVal, isDown) {
           const type = isDown ? 'keydown' : 'keyup';
           const config = { 
               key: keyVal, 
               code: keyVal === ' ' ? 'Space' : 'Key' + keyVal.toUpperCase(), 
               bubbles: true 
           };
           window.dispatchEvent(new KeyboardEvent(type, config));
        }

        window.addEventListener('DOMContentLoaded', () => {
           document.querySelectorAll('.ctrl-btn').forEach(btn => {
              const k = btn.getAttribute('data-key');
              if(!k) return;
              
              // Touch Events (Mobile)
              btn.addEventListener('touchstart', (e) => { e.preventDefault(); pushKey(k, true); }, {passive: false});
              btn.addEventListener('touchend', (e) => { e.preventDefault(); pushKey(k, false); }, {passive: false});
              btn.addEventListener('touchcancel', (e) => { e.preventDefault(); pushKey(k, false); }, {passive: false});
              
              // Mouse Events (Desktop testing)
              btn.addEventListener('mousedown', (e) => { e.preventDefault(); pushKey(k, true); });
              btn.addEventListener('mouseup', (e) => { e.preventDefault(); pushKey(k, false); });
              btn.addEventListener('mouseleave', (e) => { pushKey(k, false); });
           });
        });
      </script>
    </head>
    <body>
      <div id="error-overlay"></div>
      
      <!-- Safe fallback global injection incase they missed the import -->
      <script type="module">
        import * as THREE from 'three';
        window.THREE = THREE;
      </script>

      <!-- Overlay Gamepad -->
      <div id="touch-look-area" style="position:fixed; top:0; right:0; width:50%; height:100%; z-index:900;"></div>
      
      <!-- HEALTH HUD -->
      <div id="health-hud" style="position:fixed; top:20px; left:20px; z-index:950; display:flex; gap:5px; align-items:center;">
         <span style="color:white; font-family:sans-serif; font-weight:bold; text-shadow: 1px 1px 2px black;">HP</span>
         <div id="hearts-container" style="display:flex; gap:2px;"></div>
      </div>
      <script>
         window.currentHealth = 10;
         window.updateHealth = function(hp) {
             window.currentHealth = Math.max(0, Math.min(10, hp));
             const container = document.getElementById('hearts-container');
             let html = '';
             for(let i=0; i<10; i++) {
                 if (i < window.currentHealth) {
                     html += '<span style="color:#FF4081; font-size:24px; filter: drop-shadow(0 0 5px rgba(255,64,129,0.5));">❤️</span>';
                 } else {
                     html += '<span style="color:rgba(255,64,129,0.2); font-size:24px;">🖤</span>';
                 }
             }
             container.innerHTML = html;
         };
         // Init
         window.updateHealth(10);
      </script>

      <style>
         /* Empty to avoid missing style tag */
      </style>
      <script type="module">
         import * as THREE from 'three';

         // Action: AI Live Coder (Removed)
         window.addEventListener('message', (e) => {
            if(e.data?.type === 'INJECT_CUSTOM_TICK_SCRIPT') {
                try {
                   // Evaluate the raw code generated by Blockly directly into the engine's scope
                   const func = new Function('THREE', 'scene', 'dt', e.data.code);
                   window.window.customGameTick = (dt) => {
                       func(THREE, window.window.SCENE, dt);
                   };
                   console.log('Successfully injected custom tick script from Blockly!');
                } catch(err) {
                   console.error('Injection Error: ', err.message);
                }
            } else if (e.data?.type === 'INJECT_NODE_SCRIPT') {
                if (!window.window.nodeScripts) window.window.nodeScripts = {};
                try {
                    const func = new Function('THREE', 'scene', 'dt', 'node', e.data.code);
                    window.window.nodeScripts[e.data.uuid] = func;
                } catch(err) {
                    console.error('Injection Error: ', err.message);
                }
            } else if (e.data?.type === 'ADD_BLOCK') {
                const { x, y, z, tex } = e.data;
                if (window.window.placeBlock) {
                    window.window.placeBlock(x, y, z, tex);
                }
            } else if (e.data?.type === 'APPLY_SKIN') {
                if(!window.window.PLAYER_MESH) return;
                const username = e.data.username;
                if(!username) return;
                const loader = new THREE.TextureLoader();
                loader.load('https://starlightskins.lunareclipse.studio/skin/'+username, (tex) => {
                    tex.magFilter = THREE.NearestFilter;
                    window.window.PLAYER_MESH.traverse(child => {
                       if (child.isMesh && child.material) child.material.map = tex;
                    });
                });
            } else if (e.data?.type === 'UPDATE_TRANSFORM') {
                const c = window.window.SCENE.getObjectByProperty('uuid', e.data.uuid);
                if (c) c.position.set(...e.data.pos);
            } else if (e.data?.type === 'ADD_UI_BUTTON') {
                const btn = document.createElement('button');
                btn.innerText = e.data.label;
                btn.style.position = 'absolute';
                btn.style.top = '50%';
                btn.style.left = '50%';
                btn.style.transform = 'translate(-50%, -50%)';
                btn.style.padding = '10px 20px';
                btn.style.fontSize = '16px';
                btn.style.zIndex = '1000';
                btn.style.background = '#FF4081';
                btn.style.color = 'white';
                btn.style.border = 'none';
                btn.style.borderRadius = '5px';
                btn.style.cursor = 'pointer';
                btn.id = 'ui-btn-' + Date.now();
                document.body.appendChild(btn);
                btn.onclick = () => {
                    const evt = new CustomEvent('UI_CLICK', { detail: { id: btn.id } });
                    window.dispatchEvent(evt);
                };
            } else if (e.data?.type === 'ADD_UI_TEXT') {
                const txt = document.createElement('div');
                txt.innerText = e.data.text;
                txt.style.position = 'absolute';
                txt.style.top = '10%';
                txt.style.left = '50%';
                txt.style.transform = 'translateX(-50%)';
                txt.style.fontSize = '24px';
                txt.style.color = 'white';
                txt.style.fontWeight = 'bold';
                txt.style.zIndex = '1000';
                txt.style.textShadow = '2px 2px 0 #000';
                txt.id = 'ui-txt-' + Date.now();
                document.body.appendChild(txt);
            }
         });

         setInterval(() => {
             if (window.window?.SCENE && window.window?.SCENE.children) {
                 const nodes = [];
                 window.window.SCENE.children.forEach((c, idx) => {
                     if (c.type === 'HemisphereLight') return; 
                     nodes.push({
                         uuid: c.uuid || idx.toString(),
                         type: c.type,
                         name: c.name || c.type,
                         pos: c.position ? [c.position.x, c.position.y, c.position.z] : [0,0,0]
                     });
                 });
                 // Also add UI elements to hierarchy
                 document.querySelectorAll('[id^="ui-"]').forEach((el) => {
                     nodes.push({
                         uuid: el.id,
                         type: 'UIElement',
                         name: el.tagName === 'BUTTON' ? 'UI Button' : 'UI Text',
                         pos: [0, 0, 0]
                     });
                 });
                 window.parent.postMessage({ type: 'HIERARCHY_UPDATE', nodes }, '*');
             }
         }, 1000);
      </script>
      <script>
         const lookArea = document.getElementById('touch-look-area');
         let isDragging = false;
         let lastX = 0, lastY = 0;
         lookArea.addEventListener('pointerdown', e => {
             isDragging = true;
             lastX = e.clientX;
             lastY = e.clientY;
             lookArea.setPointerCapture(e.pointerId);
         });
         lookArea.addEventListener('pointermove', e => {
             if (!isDragging) return;
             // Dampen sensitivity to feel better on mobile
             const movementX = (e.clientX - lastX) * 0.5;
             const movementY = (e.clientY - lastY) * 0.5;
             lastX = e.clientX;
             lastY = e.clientY;
             window.dispatchEvent(new CustomEvent('cameradrag', { detail: { movementX, movementY }}));
         });
         lookArea.addEventListener('pointerup', e => {
             isDragging = false;
             lookArea.releasePointerCapture(e.pointerId);
         });
      </script>

      <div id="mobile-controls">
         <div id="d-pad">
            <div class="ctrl-btn d-btn" id="btn-w" data-key="w">W</div>
            <div class="ctrl-btn d-btn" id="btn-a" data-key="a">A</div>
            <div class="ctrl-btn d-btn" id="btn-s" data-key="s">S</div>
            <div class="ctrl-btn d-btn" id="btn-d" data-key="d">D</div>
         </div>
         <div id="jump-wrapper">
            <div class="ctrl-btn" id="jump-btn" data-key=" ">JUMP</div>
         </div>
      </div>

      <!-- The actual generated code payload -->
      <script type="module">
        ${scriptCode}
      </script>
    </body>
    </html>
  `;

  const filteredLogs = logs.filter(l => l.message.toLowerCase().includes(searchQuery.toLowerCase()));

  // AUTH SCREEN
  if (viewState === 'auth') {
    return (
      <div className="min-h-screen bg-[#2A004E] text-white flex flex-col items-center justify-center font-sans relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#76FF03] rounded-full blur-[150px] opacity-20 animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#00E5FF] rounded-full blur-[150px] opacity-20 animate-pulse delay-700" />
        </div>
        
        <div className="z-10 bg-white/10 backdrop-blur-xl border border-white/20 p-10 rounded-3xl max-w-md w-full shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col items-center">
          <div className="mb-4">
            <DotLottie src="/anim2.lottie" style={{ width: '300px', height: '300px' }} autoplay loop></DotLottie>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#00E5FF] via-[#76FF03] to-[#FF4081] text-center mb-2">
            WEBLOX
          </h1>
          <p className="text-center text-sm font-bold text-white/50 mb-8 uppercase tracking-widest">Secure Identity Login</p>
          
          <div className="space-y-4 w-full">
            <div>
              <label className="text-xs font-black uppercase text-[#00E5FF] tracking-widest mb-1 block">Network Credentials</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={20} />
                <input 
                  type="text" 
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Enter your Name"
                  className="w-full bg-black/30 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:border-[#00E5FF] outline-none font-bold placeholder:text-white/30"
                  onKeyDown={e => e.key === 'Enter' && handleAuth()}
                />
              </div>
            </div>

            <button 
              onClick={handleAuth}
              disabled={isAuthenticating}
              className="w-full bg-[#76FF03] hover:bg-[#66DD00] text-[#2A004E] font-black py-4 rounded-xl shadow-[0_4px_0_#4C9900] active:shadow-none active:translate-y-1 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <>Establishing GPS Lock...</>
              ) : (
                <>
                  Connect <Fingerprint size={20} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Error Popups */}
        <AnimatePresence>
          {error && (
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

  const handleShare = async () => {
    if (!user || !userProfile) {
      addLog("Please login to share your game.", "warning");
      return;
    }
    if (!gameCode) return;
    
    try {
      addLog("Publishing game to Weblox Network...", "process");
      const baseName = (prompt || "untitled").trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 20);
      const generatedGameSlug = baseName + "-" + Math.random().toString(36).substr(2, 4);
      await addDoc(collection(db, "games"), {
         userId: user.uid,
         creatorSlug: userProfile.slug,
         gameSlug: generatedGameSlug,
         description: prompt ? prompt.substring(0, 500) : "A custom built weblox game.",
         code: gameCode,
         tags: gameTags,
         timestamp: new Date().toISOString()
      });
      const shareUrl = `${window.location.origin}/${userProfile.slug}/${generatedGameSlug}`;
      navigator.clipboard.writeText(shareUrl);
      addLog(`Game Published! URL copied: ${shareUrl}`, "success");
      setShowPublishDialog(false);
    } catch(err: any) {
      addLog(`Publish failed: ${err.message}`, "error");
    }
  };

  const themeColors: Record<string, string> = {
    'Theme: Midnight Purple (Default)': '#2A004E',
    'Theme: Dracula (Dark)': '#282a36',
    'Theme: Cyberpunk (Neon)': '#0b001a',
    'Theme: Abyss (Black)': '#111111',
    'Theme: Ocean (Teal)': '#002b36'
  };
  const activeBgColor = themeColors[appTheme] || '#2A004E';

  return (
    <div className="min-h-screen text-white flex flex-col font-sans overflow-hidden selection:bg-[#00E5FF] selection:text-black" style={{ backgroundColor: activeBgColor }}>
      {/* Top Navigation - matching hand-drawn UI */}
      <header className="w-full flex items-center justify-between border-b border-white/20 p-2 z-20 relative" style={{ backgroundColor: activeBgColor }}>
         {/* Left: Languages & Themes */}
         <div className="flex-1 flex gap-4 px-2">
            <div className="flex flex-col items-start">
               <span className="text-[10px] font-bold text-gray-400 uppercase">Language:</span>
               <select className="bg-transparent border border-gray-500 text-white rounded px-2 py-0.5 text-xs outline-none w-28 cursor-pointer mt-1">
                  <option>English(US)</option>
                  <option>Spanish</option>
                  <option>French</option>
               </select>
            </div>
            <div className="flex flex-col items-start hidden sm:flex">
               <span className="text-[10px] font-bold text-gray-400 uppercase">Theme:</span>
               <select 
                  value={appTheme}
                  onChange={(e) => setAppTheme(e.target.value)}
                  className="bg-transparent border border-gray-500 text-white rounded px-2 py-0.5 text-xs outline-none w-36 cursor-pointer mt-1"
               >
                  {Object.keys(themeColors).map(t => (
                     <option key={t} value={t} className="text-black">{t.replace('Theme: ', '')}</option>
                  ))}
               </select>
            </div>
         </div>

         {/* Center: Title */}
         <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="flex items-baseline gap-2 cursor-pointer" onClick={() => setViewState('home')}>
                <h1 className="text-3xl font-black italic tracking-tighter text-white drop-shadow-md">WeBlox</h1>
                <span className="text-sm font-medium text-gray-300 hidden md:block">- A 3D Maker...</span>
            </div>
            <span className="text-[10px] text-gray-400">max magnitude city</span>
         </div>

         {/* Right: User / Auth */}
         <div className="flex-1 flex justify-end items-center mr-4">
             {user ? (
                 <div className="flex items-center gap-4">
                     <button onClick={() => setViewState('explore')} title="Explore Community" className="text-white hover:text-[#76FF03] transition-colors">
                        <Compass size={24} />
                     </button>
                     <div 
                         onClick={() => setViewState('profile')}
                         className="flex items-center gap-2 cursor-pointer hover:bg-white/10 p-2 rounded-lg transition-colors border border-dashed border-gray-500"
                     >
                         <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center overflow-hidden border-2 border-white">
                            {userProfile?.avatarConfig?.color ? (
                                <div className="w-full h-full" style={{ backgroundColor: userProfile.avatarConfig.color }} />
                            ) : (
                                <User size={16} className="text-white" />
                            )}
                         </div>
                         <span className="font-bold text-sm">{userName}</span>
                     </div>
                 </div>
             ) : (
                 <button onClick={signInWithGoogle} className="bg-[#FF4081] hover:bg-[#FF4081]/80 text-white rounded-lg px-4 py-2 font-black text-xs uppercase tracking-widest transition-colors">
                    Login
                 </button>
             )}
         </div>
      </header>

      {/* Main Dynamically Rendered Layout */}
      {viewState === 'home' && (
      <main className="flex-1 overflow-hidden relative flex bg-black/20">
        
        {/* 3-COLUMN HAND DRAWN LAYOUT */}
        <div className="w-full h-full max-w-7xl mx-auto flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/20 p-2 md:p-4 gap-4 md:gap-0">
           
           {/* LEFT COLUMN: AI & Recent */}
           <div className="flex-1 flex flex-col p-2 min-h-0 w-full md:w-1/3">
               
               {/* AI Section */}
               <div className="mb-6">
                   <div className="border border-white/30 rounded p-1 inline-block mb-3 bg-white/5">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-300">AI</h2>
                   </div>
                   
                   <div className="space-y-3">
                      <div className="flex items-center gap-2">
                         <input placeholder="Prompt..." className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm" />
                         <button className="bg-[#8BC34A] text-black font-bold px-3 py-1.5 rounded text-sm hover:bg-[#7CB342]">Gen</button>
                      </div>
                      <div className="flex items-center gap-2">
                         <input placeholder="Texture..." className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm" />
                         <button className="bg-[#8BC34A] text-black font-bold px-3 py-1.5 rounded text-sm hover:bg-[#7CB342]">Gen</button>
                      </div>
                   </div>
               </div>

               {/* Recent Section */}
               <div className="flex-1 flex flex-col min-h-0">
                   <h2 className="text-sm font-bold uppercase tracking-widest text-[#00E5FF] mb-3">Recent:</h2>
                   <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      {[1, 2, 3].map(i => (
                         <div key={i} className="group relative rounded-lg border-2 border-transparent hover:border-[#00E5FF] transition-all cursor-pointer overflow-hidden bg-white/5" onClick={() => setViewState('profile')}>
                            {/* Hand drawn blue/red stripes representation */}
                            <div className="h-4 w-full bg-blue-400/40"></div>
                            <div className="h-2 w-full bg-red-400/40"></div>
                            <div className="h-6 w-full bg-blue-400/40 flex items-center px-4">
                               <span className="font-bold text-white text-sm">Recent Game {i}</span>
                            </div>
                            <div className="h-2 w-full bg-red-400/40"></div>
                            <div className="h-4 w-full bg-blue-400/40"></div>
                         </div>
                      ))}
                   </div>
               </div>
           </div>

           {/* CENTER COLUMN: Create */}
           <div className="flex-1 flex flex-col items-center p-2 min-h-0 w-full md:w-1/3 overflow-y-auto">
               
               {/* Create Options */}
               {gameCode && (
                  <button 
                     onClick={() => setViewState('game')} 
                     className="mb-6 flex items-center gap-2 bg-[#00E5FF] text-black font-black uppercase tracking-widest px-6 py-2 rounded-full hover:bg-[#00cbe6] transition-colors"
                  >
                     <LayoutGrid size={18} /> Resume Editor
                  </button>
               )}
               
               {/* Start from Scratch */}
               <button 
                  onClick={() => {
                     if (gameCode) {
                         if(window.confirm("Starting from scratch will overwrite your current game. Continue?")) {
                             startBlankGame();
                         }
                     } else {
                         startBlankGame();
                     }
                  }} 
                  className="flex flex-col items-center group mt-4 hover:scale-105 transition-transform"
               >
                  <div className="w-32 h-24 border-4 border border-t-red-500 border-r-yellow-500 border-b-green-500 border-l-blue-500 bg-white/10 flex items-center justify-center relative overflow-hidden p-2">
                     <div className="w-full h-full bg-blue-500/20 flex items-center justify-center">
                        <div className="w-8 h-12 bg-blue-500/40 flex items-center justify-center flex-col gap-1">
                            <div className="w-4 h-1 bg-white/50"></div>
                            <div className="w-4 h-1 bg-white/50"></div>
                        </div>
                     </div>
                  </div>
                  <span className="mt-2 text-sm font-bold text-white uppercase tracking-widest text-center">Start from Scratch</span>
               </button>

               {/* Start with Template */}
               <div className="mt-10 flex flex-col items-center w-full max-w-xs">
                  <div className="w-24 h-16 border-2 border-white/30 bg-white/5 flex items-center justify-center gap-2 mb-2 rounded cursor-pointer hover:bg-white/10 transition-colors">
                      <ArrowRight size={16} className="-rotate-90 text-yellow-400" />
                      <ArrowRight size={16} className="rotate-90 text-green-400" />
                  </div>
                  <span className="text-sm font-bold text-white uppercase tracking-widest mb-6">Start with Template</span>
                  
                  {/* Template Preview (Sun, stairs, 1v1) */}
                  <div className="w-full h-32 border-2 border-white/20 bg-gradient-to-b from-sky-400/20 to-white/5 relative overflow-hidden rounded">
                      {/* Sun */}
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.8)]"></div>
                      {/* Grass */}
                      <div className="absolute bottom-0 left-0 right-0 h-4 bg-green-500/50" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)' }}></div>
                      {/* Stairs */}
                      <div className="absolute bottom-4 left-1/4 flex flex-col items-start">
                         <div className="w-4 h-4 border border-white/30 bg-white/10"></div>
                         <div className="flex"><div className="w-4 h-4 border border-white/30 bg-white/10"/><div className="w-4 h-4 border border-white/30 bg-white/10"/></div>
                         <div className="flex"><div className="w-4 h-4 border border-white/30 bg-white/10"/><div className="w-4 h-4 border border-white/30 bg-white/10"/><div className="w-4 h-4 border border-white/30 bg-white/10"/></div>
                      </div>
                      {/* Stick figure 1 */}
                      <div className="absolute bottom-4 left-2/4">
                         <div className="text-[10px] text-white absolute bottom-4 -left-2 text-nowrap">1 v 1</div>
                         <div className="w-1 h-1 bg-white rounded-full mx-auto"></div>
                         <div className="w-[1px] h-3 bg-white mx-auto"></div>
                         <div className="flex justify-center gap-1 -mt-2"><div className="w-[1px] h-2 bg-white transform rotate-45"/><div className="w-[1px] h-2 bg-white transform -rotate-45"/></div>
                         <div className="flex justify-center gap-1"><div className="w-[1px] h-2 bg-white transform rotate-45"/><div className="w-[1px] h-2 bg-white transform -rotate-45"/></div>
                      </div>
                      {/* Stick figure 2 */}
                      <div className="absolute bottom-4 right-4">
                         <div className="w-1 h-1 bg-white rounded-full mx-auto"></div>
                         <div className="w-[1px] h-3 bg-white mx-auto"></div>
                         <div className="flex justify-center gap-1 -mt-2"><div className="w-[1px] h-2 bg-white transform rotate-45"/><div className="w-[1px] h-2 bg-white transform -rotate-45"/></div>
                         <div className="flex justify-center gap-1"><div className="w-[1px] h-2 bg-white transform rotate-45"/><div className="w-[1px] h-2 bg-white transform -rotate-45"/></div>
                      </div>
                  </div>
               </div>

           </div>

           {/* RIGHT COLUMN: Community */}
           <div className="flex-1 flex flex-col p-2 min-h-0 w-full md:w-1/3">
               <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-green-400 flex items-center gap-2">
                     <Compass size={16} /> Community:
                  </h2>
                  <button onClick={() => setViewState('explore')} className="bg-white/10 hover:bg-white/20 p-1 rounded">
                     <LayoutGrid size={14} />
                  </button>
               </div>
               
               <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {[1, 2, 3, 4, 5].map(i => (
                     <div key={i} className="h-16 w-full bg-white/5 border border-white/10 hover:border-white/30 rounded flex overflow-hidden cursor-pointer group" onClick={() => setViewState('explore')}>
                        {/* Hand drawn colored strips on cards */}
                        <div className="w-2 flex flex-col">
                           <div className="flex-1 bg-blue-500"></div>
                           <div className="flex-1 bg-red-500"></div>
                           <div className="flex-1 bg-yellow-500"></div>
                           <div className="flex-1 bg-green-500"></div>
                        </div>
                        <div className="flex-1 p-2 flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gray-500"></div>
                              <span className="text-sm font-bold text-gray-300 group-hover:text-white">Community Proj {i}</span>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
           </div>

        </div>
      </main>
      )}

      {/* Profile View */}
      {viewState === 'profile' && (
        <main className="flex-1 overflow-y-auto p-8 relative">
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#FF4081] rounded-full blur-[150px] opacity-10" />
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#00E5FF] rounded-full blur-[150px] opacity-10" />
          </div>
          
          <div className="max-w-7xl mx-auto z-10 relative">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full border-4 border-[#FF4081] flex items-center justify-center overflow-hidden bg-black/40" style={{ backgroundColor: (userProfile?.avatarConfig?.color || '#00E5FF') + '20' }}>
                   {userProfile?.avatarConfig?.bodyShape === 'blocky' && <Box size={48} color={userProfile.avatarConfig.color || '#00E5FF'} />}
                   {(userProfile?.avatarConfig?.bodyShape === 'round' || !userProfile?.avatarConfig?.bodyShape) && <User size={48} color={userProfile?.avatarConfig?.color || '#00E5FF'} />}
                   {userProfile?.avatarConfig?.bodyShape === 'humanoid' && <User size={48} color={userProfile.avatarConfig.color || '#00E5FF'} className="scale-125" />}
                   {userProfile?.avatarConfig?.accessory === 'hat' && <div className="absolute top-2 w-16 h-8 bg-purple-500 rounded-t-lg border-b-4 border-yellow-400"></div>}
                   {userProfile?.avatarConfig?.accessory === 'crown' && <div className="absolute top-2 text-yellow-400 font-bold text-xl">♔</div>}
                   {userProfile?.avatarConfig?.accessory === 'glasses' && <div className="absolute top-12 flex gap-1"><div className="w-4 h-4 rounded-full border-2 border-white"></div><div className="w-4 h-4 rounded-full border-2 border-white"></div></div>}
                </div>
                <button 
                  onClick={() => setShowAvatarModal(true)} 
                  className="absolute bottom-0 right-0 bg-[#00E5FF] hover:bg-[#00B8D4] text-black w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg transition-transform hover:scale-110"
                  title="Customize Avatar"
                >
                  ✎
                </button>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-4xl font-black uppercase tracking-widest text-[#00E5FF]">{userProfile?.username || user?.displayName || 'Player'}</h2>
                <p className="text-white/50 font-bold tracking-widest uppercase text-sm mt-1">@{userProfile?.slug || 'unknown'}</p>
                <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-4">
                  <div className="bg-black/30 rounded-xl px-4 py-2 border border-white/5 flex flex-col items-center md:items-start">
                    <span className="text-[10px] uppercase font-black text-white/40 tracking-widest">Games Created</span>
                    <span className="text-xl font-black text-[#76FF03]">{myGames.length}</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="text-2xl font-black uppercase tracking-widest text-white mb-6">Your Games History</h3>
            
            {isLoadingProfile ? (
              <div className="flex items-center justify-center p-20">
                 <div className="w-16 h-16 border-4 border-[#FF4081] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : myGames.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
                 <Box size={48} className="mx-auto text-white/30 mb-4" />
                 <h3 className="text-2xl font-bold text-white/50">No Games Yet</h3>
                 <p className="text-white/30 mt-2">Go back to the builder to create your first game!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {myGames.map(game => (
                    <div 
                      key={game.id} 
                      className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#FF4081] transition-all rounded-3xl overflow-hidden cursor-pointer flex flex-col"
                      onClick={() => {
                         let url = `/${game.creatorSlug}/${game.gameSlug}`;
                         window.open(url, '_blank');
                      }}
                    >
                       {/* Abstract placeholder thumbnail */}
                       <div className="h-40 bg-black/40 relative overflow-hidden flex items-center justify-center">
                          <div className="absolute inset-0 bg-gradient-to-br from-[#FF4081]/20 to-transparent"></div>
                          <Box size={48} className="text-white/20 group-hover:scale-110 transition-transform duration-500" />
                          <div className="absolute bottom-2 right-2 bg-black/60 rounded px-2 py-1 text-[10px] font-bold text-white/50 backdrop-blur-md">
                            {new Date(game.timestamp).toLocaleDateString()}
                          </div>
                          
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <div className="bg-[#FF4081] text-white font-black uppercase tracking-widest text-xs px-4 py-2 rounded-full flex items-center gap-2">
                                <Share2 size={14} /> Open Shared Link
                             </div>
                          </div>
                       </div>
                       
                       <div className="p-5 flex flex-col flex-1">
                          <h4 className="text-xl font-bold text-white mb-2 line-clamp-1">{game.gameSlug.replace(/-/g, ' ')}</h4>
                          {game.tags && game.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-auto">
                              {game.tags.slice(0, 3).map((t: string) => (
                                <span key={t} className="bg-white/10 text-white/70 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">{t}</span>
                              ))}
                            </div>
                          )}
                       </div>
                    </div>
                 ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* Explore View */}
      {viewState === 'explore' && (
        <main className="flex-1 overflow-y-auto p-8 relative">
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#76FF03] rounded-full blur-[150px] opacity-10" />
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#00E5FF] rounded-full blur-[150px] opacity-10" />
          </div>
          
          <div className="max-w-7xl mx-auto z-10 relative">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
               <h2 className="text-4xl font-black uppercase tracking-widest text-white">Community Games</h2>
               <div className="flex items-center gap-2">
                 <Search size={20} className="text-white/50" />
                 <input
                   type="text"
                   placeholder="Filter by tag (e.g. obby)"
                   value={exploreFilterTag}
                   onChange={(e) => setExploreFilterTag(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && fetchExploreGames(exploreFilterTag)}
                   className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white outline-none focus:border-[#00E5FF]"
                 />
                 <button onClick={() => fetchExploreGames(exploreFilterTag)} className="bg-[#00E5FF] text-black px-4 py-2 rounded-xl font-bold uppercase text-xs tracking-widest">
                   Search
                 </button>
               </div>
            </div>
            
            {isLoadingExplore ? (
              <div className="flex items-center justify-center p-20">
                 <div className="w-16 h-16 border-4 border-[#76FF03] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : recentGames.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
                 <Box size={48} className="mx-auto text-white/30 mb-4" />
                 <h3 className="text-2xl font-bold text-white/50">No Games Published Yet</h3>
                 <p className="text-white/30 mt-2">Be the first to create and publish a Weblox game!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {recentGames.map(game => (
                    <div 
                      key={game.id} 
                      className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#76FF03] transition-all rounded-3xl overflow-hidden cursor-pointer flex flex-col"
                      onClick={() => {
                         addLog(`Loading selected game: ${game.gameSlug}`, "process");
                         setCurrentSharedGameId(game.id);
                         setPrompt(game.description || "Shared Applet");
                         setGameCode(game.code);
                         setViewState('game');
                      }}
                    >
                      <div className="bg-[#1A0033] h-48 w-full relative flex items-center justify-center overflow-hidden border-b border-white/10">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1A0033] to-transparent z-10" />
                        <Box size={64} className="text-[#00E5FF]/20 group-hover:text-[#76FF03]/40 group-hover:scale-110 transition-all duration-500" />
                        <div className="absolute top-4 right-4 z-20 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Play</span>
                        </div>
                      </div>
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mt-2">
                           <h3 className="text-lg font-bold text-white group-hover:text-[#76FF03] transition-colors line-clamp-1">{game.gameSlug}</h3>
                           {game.ratings && Object.keys(game.ratings).length > 0 && (
                             <div className="flex items-center gap-1 text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded text-xs font-bold border border-yellow-400/20">
                               ★ {((Object.values(game.ratings) as number[]).reduce((a, b) => a + b, 0) / Object.keys(game.ratings).length).toFixed(1)}
                             </div>
                           )}
                        </div>
                        <p className="text-sm text-white/50 font-medium mb-4 mt-2 line-clamp-2 flex-1">{game.description}</p>
                        
                        {game.tags && game.tags.length > 0 && (
                           <div className="flex flex-wrap gap-2 mb-4">
                              {game.tags.map((tag: string) => (
                                <span key={tag} className="text-[9px] uppercase font-bold text-[#76FF03] bg-[#76FF03]/10 px-2 py-1 rounded-md border border-[#76FF03]/20">{tag}</span>
                              ))}
                           </div>
                        )}

                        <div className="flex items-center justify-between text-xs mt-auto pt-4 border-t border-white/10">
                           <span className="font-bold text-[#00E5FF]">@{game.creatorSlug}</span>
                           <span className="text-white/30">{new Date(game.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                 ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* Loading View Page Transition */}
      {viewState === 'loading' && (
        <main className="flex-1 flex flex-col items-center justify-center w-full h-[calc(100vh-80px)] relative overflow-hidden">
           <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
             <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-[#FF4081] rounded-full blur-[80px] opacity-20 animate-pulse" />
             <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-[#00E5FF] rounded-full blur-[100px] opacity-20 animate-pulse delay-1000" />
          </div>

          {!showArcade ? (
             <div className="z-10 flex flex-col items-center">
               <DotLottie 
                 src="/anim1.lottie" 
                 style={{ width: '300px', height: '300px' }} 
                 autoplay 
                 loop
               ></DotLottie>
               
               <h2 className="text-3xl font-black text-[#00E5FF] mt-4 tracking-widest uppercase text-center max-w-xl px-4 flex flex-col md:flex-row items-center gap-4">
                 <span className="animate-pulse">{loadingMessage}</span>
                 <FunSpinner />
               </h2>
               
               <button 
                  onClick={() => setShowArcade(true)}
                  className="mt-12 bg-white/10 hover:bg-white/20 border border-white/20 px-8 py-4 rounded-3xl font-black uppercase tracking-widest text-[#76FF03] flex items-center gap-3 transition-colors backdrop-blur-md"
               >
                  <Sparkles /> Play While You Wait
               </button>
             </div>
          ) : (
            <div className="z-10 w-full h-full p-8 flex flex-col pt-12">
               <div className="flex items-center justify-between mb-8 px-4">
                  <div>
                    <h2 className="text-3xl font-black text-[#00E5FF] tracking-widest uppercase">Weblox Arcade</h2>
                    <p className="text-sm font-bold text-white/50 uppercase tracking-wider">{loadingMessage}</p>
                  </div>
                  <button onClick={() => setShowArcade(false)} className="text-white/50 hover:text-white uppercase font-black tracking-widest text-sm">Close Arcade</button>
               </div>
               
               {!arcadeGameUrl ? (
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-y-auto w-full max-w-6xl mx-auto items-center justify-center p-4">
                    {ARCADE_GAMES.map(game => (
                         <button 
                            key={game.id} 
                            onClick={() => setArcadeGameUrl(game.url)}
                            className="bg-black/40 border border-white/10 hover:border-[#00E5FF] hover:bg-white/5 p-6 rounded-3xl flex flex-col items-center justify-center gap-4 transition-all group"
                         >
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00E5FF] to-[#76FF03] p-1">
                               <div className="w-full h-full bg-[#1A0033] rounded-[14px] flex items-center justify-center group-hover:bg-transparent transition-colors">
                                  <Square size={24} className="text-white" />
                               </div>
                            </div>
                            <span className="font-black tracking-widest uppercase text-xs text-center">{game.name}</span>
                         </button>
                    ))}
                 </div>
               ) : (
                 <div className="flex-1 w-full flex flex-col items-center bg-black/50 rounded-3xl overflow-hidden border border-white/10 relative">
                    <div className="w-full bg-[#1A0033] p-4 flex justify-between items-center z-20">
                       <button onClick={() => setArcadeGameUrl(null)} className="text-white/50 hover:text-white font-black text-xs uppercase tracking-widest">Back to Hub</button>
                       <button onClick={() => {
                          const ifr = document.getElementById('arcade-iframe');
                          if(ifr?.requestFullscreen) ifr.requestFullscreen();
                       }} className="text-[#00E5FF] font-black text-xs uppercase tracking-widest flex items-center gap-2"><Maximize2 size={12}/> Fullscreen</button>
                    </div>
                    <iframe id="arcade-iframe" src={arcadeGameUrl} className="w-full flex-1 bg-black" allowFullScreen />
                 </div>
               )}
            </div>
          )}
        </main>
      )}

      {/* Game Detail Subpage */}
      {viewState === 'game' && gameCode && (
        <main className="flex-1 flex flex-col w-full h-[calc(100vh-80px)] bg-[#1e1e1e] text-gray-300 font-sans text-xs relative">
          {/* Top Control Bar */}
          <div className="h-12 bg-[#2d2d2d] border-b border-[#111] flex items-center justify-between px-4 shadow-md z-10 w-full shrink-0">
             <div className="flex items-center gap-4">
                <button 
                  onClick={() => setViewState('builder')}
                  className="flex items-center gap-2 hover:text-[#00E5FF] transition-colors uppercase tracking-widest font-bold"
                >
                  <ArrowLeft size={16} /> Back
                </button>
             </div>
             
             <div className="flex items-center gap-2">
                <button className="p-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded shadow-inner text-[#76FF03]" title="Play">
                   <Play size={16} className="fill-current" />
                </button>
             </div>

             <div className="flex items-center gap-4">
               {currentSharedGameId && (
                  <button onClick={() => setShowRatingDialog(true)} className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 uppercase tracking-widest font-bold">
                    ★ Rate Game 
                  </button>
               )}
               <button onClick={() => { setGameTags([]); setNewTagInput(''); setShowPublishDialog(true); }} className="flex items-center gap-2 bg-[#00E5FF]/20 hover:bg-[#00E5FF]/40 text-[#00E5FF] px-4 py-1.5 rounded uppercase tracking-widest font-bold border border-[#00E5FF]/30">
                  <Share2 size={14} /> Share
               </button>
             </div>
          </div>

          <div className="flex-1 flex w-full overflow-hidden">
             
             {/* Left Panel: Turbowarp Scripting */}
             <div className="w-1/3 bg-[#1e1e1e] border-r border-[#111] flex flex-col shrink-0 min-w-[300px]">
                 <BlocklyEditor 
                   nodeId={selectedNode || 'global_script'}
                   savedXml={nodeXmls[selectedNode || 'global_script'] || ''}
                   onSaveXml={(xml) => {
                      setNodeXmls(prev => ({...prev, [selectedNode || 'global_script']: xml}));
                   }}
                   onInject={(code) => {
                     const iframe = document.getElementById('game-frame') as HTMLIFrameElement;
                     if (selectedNode === 'global_script' || !selectedNode) {
                         iframe.contentWindow?.postMessage({ type: 'INJECT_CUSTOM_TICK_SCRIPT', code }, '*');
                     } else {
                         iframe.contentWindow?.postMessage({ type: 'INJECT_NODE_SCRIPT', uuid: selectedNode, code }, '*');
                     }
                 }} />
             </div>

             {/* Center Area: Game Preview */}
             <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
                 {/* 3D Scene View */}
                 <div className="flex-1 relative bg-black" ref={gameWrapperRef}>
                    {(currentSharedGameId && !hasStartedSharedGame) ? (
                      <div className="w-full h-full border-none flex flex-col items-center justify-center bg-black/80 backdrop-blur-md absolute inset-0 z-40 relative">
                         <h2 className="text-3xl font-black uppercase tracking-widest text-white mb-6">Shared Game</h2>
                         <button 
                           onClick={() => setHasStartedSharedGame(true)} 
                           className="bg-[#76FF03] hover:bg-[#66DD00] text-[#1A0033] px-8 py-4 rounded-full font-black uppercase tracking-widest text-xl shadow-[0_0_40px_rgba(118,255,3,0.5)] transition-all hover:scale-105 flex items-center gap-3"
                         >
                            <Play size={24} className="fill-current" /> PLAY NOW
                         </button>
                      </div>
                    ) : (
                      <>
                        <iframe 
                          id="game-frame"
                          srcDoc={getIframeContent(gameCode)} 
                          className="w-full h-full border-none pointer-events-auto" 
                          sandbox="allow-scripts allow-downloads allow-modals allow-popups allow-pointer-lock allow-same-origin"
                          allowFullScreen
                        />
                        <button 
                          onClick={toggleFullscreen}
                          className="absolute top-4 right-4 bg-black/60 hover:bg-[#00E5FF] hover:text-black text-white p-2.5 rounded backdrop-blur-md transition-all z-50 border border-white/20"
                        >
                          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                        </button>
                      </>
                    )}
                 </div>

                 {/* Bottom Panel: Variables / Code Toggle */}
                 <div className="h-64 bg-[#252526] border-t border-[#111] flex flex-col shrink-0">
                    <div className="bg-[#2d2d2d] px-3 py-1.5 font-bold uppercase tracking-wider text-gray-400 border-b border-[#111] flex justify-between items-center">
                       <span>Game Config & Code</span>
                       <button onClick={() => {
                          if (!showCode && gameCode) setEditableCode(gameCode);
                          setShowCode(!showCode);
                       }} className="text-[#00E5FF] hover:text-white transition-colors bg-[#3c3c3c] px-2 py-0.5 rounded flex items-center gap-2">
                          <Box size={14} /> {showCode ? 'Hide Code' : 'Show Engine Code'}
                       </button>
                    </div>
                    {showCode && (
                       <div className="flex-1 w-full flex flex-col bg-[#1e1e1e]">
                          <div className="flex-1 w-full relative">
                             <Editor
                                height="100%"
                                theme="vs-dark"
                                defaultLanguage="javascript"
                                value={editableCode}
                                onChange={(value) => setEditableCode(value || "")}
                                options={{
                                   minimap: { enabled: false },
                                   fontSize: 12,
                                   fontFamily: "'JetBrains Mono', monospace",
                                }}
                             />
                          </div>
                          <div className="p-2 border-t border-[#111] flex justify-end">
                             <button
                               onClick={() => setGameCode(editableCode)}
                               className="bg-[#76FF03] hover:bg-[#66DD00] text-black px-4 py-1.5 rounded font-bold transition-colors"
                             >
                               Apply Changes
                             </button>
                          </div>
                       </div>
                    )}
                 </div>
             </div>

             {/* Right Panel: Hierarchy & Inspector */}
             <div className="w-80 bg-[#252526] border-l border-[#111] flex flex-col shrink-0 h-full overflow-hidden">
                <div className="flex-1 flex flex-col min-h-0">
                   <div className="bg-[#2d2d2d] px-3 py-1.5 font-bold uppercase tracking-wider text-gray-400 border-b border-[#111] flex justify-between items-center">
                      Hierarchy
                   </div>
                   <div className="flex-1 overflow-y-auto p-2 space-y-0.5 font-medium border-b border-[#111] max-h-[40%]">
                      {/* Global Script Node */}
                      <div 
                         onClick={() => setSelectedNode('global_script')}
                         className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${selectedNode === 'global_script' ? 'bg-[#37373d] text-white' : 'hover:bg-[#2a2d2e] text-gray-400'}`}
                      >
                         <Box size={14} className={selectedNode === 'global_script' ? "text-[#00E5FF]" : "text-gray-500"} /> 
                         <span className="truncate">Global Game Script</span>
                      </div>
                      
                      {hierarchy.map(node => (
                         <div 
                            key={node.uuid} 
                            onClick={() => setSelectedNode(node.uuid)}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${selectedNode === node.uuid ? 'bg-[#37373d] text-white' : 'hover:bg-[#2a2d2e] text-gray-400'}`}
                         >
                            <Box size={14} className={selectedNode === node.uuid ? "text-[#00E5FF]" : "text-gray-500"} /> 
                            <span className="truncate">{node.name}</span>
                         </div>
                      ))}
                   </div>
                   
                   <div className="bg-[#2d2d2d] px-3 py-1.5 font-bold uppercase tracking-wider text-gray-400 border-b border-[#111]">
                      Inspector
                   </div>
                   <div className="flex-1 p-4 space-y-6 overflow-y-auto min-h-0">
                   
                   {/* Transform */}
                   <div>
                     <div className="font-bold mb-3 flex items-center gap-2 text-white"><ArrowRight size={14} className="text-[#00E5FF]" /> Transform {hierarchy.find(n => n.uuid === selectedNode)?.name || 'Block'}</div>
                     <div className="space-y-3 bg-[#1e1e1e] p-3 rounded border border-[#333]">
                        <div className="flex items-center gap-2">
                           <span className="w-12 text-gray-500 font-bold">POS</span>
                           {["X", "Y", "Z"].map((axis, i) => (
                             <input 
                               key={axis} 
                               type="number" 
                               id={`bp-${axis.toLowerCase()}`}
                               className="flex-1 bg-[#3c3c3c] border-none rounded px-2 py-1 text-white placeholder-gray-500 w-0" 
                               placeholder={axis} 
                               value={selectedNode ? (hierarchy.find(n => n.uuid === selectedNode)?.pos[i]?.toFixed(2) || "0") : "0"} 
                               onChange={(e) => {
                                   const val = parseFloat(e.target.value) || 0;
                                   const node = hierarchy.find(n => n.uuid === selectedNode);
                                   if (node) {
                                       const newPos = [...node.pos];
                                       newPos[i] = val;
                                       const iframe = document.getElementById('game-frame') as HTMLIFrameElement;
                                       iframe.contentWindow?.postMessage({ type: 'UPDATE_TRANSFORM', uuid: node.uuid, pos: newPos }, '*');
                                       setHierarchy(prev => prev.map(n => n.uuid === node.uuid ? {...n, pos: newPos} : n));
                                   }
                               }}
                             />
                           ))}
                        </div>
                     </div>
                   </div>

                   {/* Renderer */}
                   <div>
                     <div className="font-bold mb-3 flex items-center gap-2 text-white"><ArrowRight size={14} className="text-yellow-400" /> Object Spawner</div>
                     <div className="space-y-3 bg-[#1e1e1e] p-3 rounded border border-[#333]">
                        <div className="flex items-center gap-2">
                           <span className="w-12 text-gray-500 font-bold text-xs">SPAWN</span>
                           <input type="number" id="sp-x" className="flex-1 bg-[#3c3c3c] border-none rounded px-2 py-1 text-white placeholder-gray-500 w-0" placeholder="X" defaultValue="0" />
                           <input type="number" id="sp-y" className="flex-1 bg-[#3c3c3c] border-none rounded px-2 py-1 text-white placeholder-gray-500 w-0" placeholder="Y" defaultValue="5" />
                           <input type="number" id="sp-z" className="flex-1 bg-[#3c3c3c] border-none rounded px-2 py-1 text-white placeholder-gray-500 w-0" placeholder="Z" defaultValue="0" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                           <span className="text-gray-500 font-bold text-[10px] uppercase">Material Texture</span>
                           <select className="w-full bg-[#3c3c3c] border-none rounded px-2 py-1.5 text-white" id="sp-tex">
                              <option value="grass">Grass Block</option>
                              <option value="dirt">Dirt Block</option>
                              <option value="stone">Stone Block</option>
                              <option value="bricks">Bricks Block</option>
                              <option value="wood">Wood Planks</option>
                           </select>
                        </div>
                        <button 
                           onClick={() => {
                               const x = parseFloat((document.getElementById('sp-x') as HTMLInputElement).value) || 0;
                               const y = parseFloat((document.getElementById('sp-y') as HTMLInputElement).value) || 0;
                               const z = parseFloat((document.getElementById('sp-z') as HTMLInputElement).value) || 0;
                               const tex = (document.getElementById('sp-tex') as HTMLSelectElement).value;
                               const iframe = document.getElementById('game-frame') as HTMLIFrameElement;
                               iframe.contentWindow?.postMessage({ type: 'ADD_BLOCK', x, y, z, tex }, '*');
                           }}
                           className="w-full py-2 mt-2 bg-[#76FF03]/20 hover:bg-[#76FF03]/30 border border-[#76FF03]/50 text-[#76FF03] font-bold rounded transition-colors"
                        >
                           Spawn Block
                        </button>
                     </div>
                   </div>

                   {/* Add Component / UI Element */}
                   <div>
                     <div className="font-bold mb-3 flex items-center gap-2 text-white"><ArrowRight size={14} className="text-[#FF4081]" /> Add Element</div>
                     <div className="space-y-2 bg-[#1e1e1e] p-3 rounded border border-[#333]">
                        <button onClick={() => {
                           const iframe = document.getElementById('game-frame') as HTMLIFrameElement;
                           iframe.contentWindow?.postMessage({ type: 'ADD_UI_BUTTON', label: 'New Button' }, '*');
                        }} className="w-full py-1.5 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white rounded font-bold transition-colors text-xs shadow">
                           Add UI Button
                        </button>
                        <button onClick={() => {
                           const iframe = document.getElementById('game-frame') as HTMLIFrameElement;
                           iframe.contentWindow?.postMessage({ type: 'ADD_UI_TEXT', text: 'New Text' }, '*');
                        }} className="w-full py-1.5 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white rounded font-bold transition-colors text-xs shadow">
                           Add UI Text
                        </button>
                     </div>
                   </div>
                </div>
              </div>
             </div>
          </div>
        </main>
      )}

      {/* Rate Game Modal */}
      {showRatingDialog && currentSharedGameId && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A0033] border border-white/20 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative text-center">
            <button onClick={() => setShowRatingDialog(false)} className="absolute top-4 right-4 text-white/50 hover:text-white">✕</button>
            <h2 className="text-2xl font-black uppercase tracking-widest text-yellow-400 mb-2">Rate Game</h2>
            <p className="text-white/60 text-xs mb-8">What did you think of this game?</p>
            
            <div className="flex justify-center gap-2 mb-8">
               {[1, 2, 3, 4, 5].map((star) => (
                 <button 
                   key={star}
                   onClick={() => setCurrentRating(star)}
                   className={`text-4xl transition-all ${currentRating >= star ? 'text-yellow-400 scale-110 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'text-white/20 hover:text-white/50 hover:scale-105'}`}
                 >
                   ★
                 </button>
               ))}
            </div>

            <button 
               onClick={async () => {
                  if (!user) {
                     addLog("You must be logged in to rate.", "error");
                     return;
                  }
                  if (currentRating === 0) return;
                  setRatingLoading(true);
                  try {
                     await updateDoc(doc(db, "games", currentSharedGameId), {
                        [`ratings.${user.uid}`]: currentRating
                     });
                     addLog("Rating submitted! Thank you.", "success");
                     setShowRatingDialog(false);
                  } catch (e: any) {
                     addLog("Failed to submit rating: " + e.message, "error");
                  }
                  setRatingLoading(false);
               }} 
               disabled={currentRating === 0 || ratingLoading}
               className="w-full bg-yellow-400 hover:bg-yellow-300 text-black disabled:opacity-50 font-black uppercase tracking-widest py-4 rounded-xl transition-all"
            >
               {ratingLoading ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>
        </div>
      )}

      {/* Publish Game Modal */}
      {showPublishDialog && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A0033] border border-white/20 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <button onClick={() => setShowPublishDialog(false)} className="absolute top-4 right-4 text-white/50 hover:text-white">✕</button>
            <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-6">Publish Game</h2>
            
            <div className="mb-6">
               <label className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2 block">Add Tags (Press Enter)</label>
               <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex flex-wrap gap-2 focus-within:border-[#00E5FF]">
                 {gameTags.map(tag => (
                   <span key={tag} className="bg-[#00E5FF]/20 text-[#00E5FF] px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 uppercase tracking-widest">
                     {tag} <button onClick={() => setGameTags(prev => prev.filter(t => t !== tag))} className="hover:text-white ml-1">✕</button>
                   </span>
                 ))}
                 <input 
                   type="text"
                   value={newTagInput}
                   onChange={e => setNewTagInput(e.target.value)}
                   onKeyDown={e => {
                     if (e.key === 'Enter' && newTagInput.trim()) {
                       const tag = newTagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
                       if (tag && !gameTags.includes(tag) && gameTags.length < 10) {
                         setGameTags(prev => [...prev, tag]);
                       }
                       setNewTagInput('');
                     }
                   }}
                   placeholder={gameTags.length < 10 ? "obby, racing..." : "Limit reached"}
                   disabled={gameTags.length >= 10}
                   className="flex-1 min-w-[100px] bg-transparent outline-none text-white text-sm disabled:opacity-50"
                 />
               </div>
            </div>

            <button onClick={handleShare} className="w-full bg-[#76FF03] hover:bg-[#66DD00] text-black font-black uppercase tracking-widest py-4 rounded-xl transition-all">
               Confirm Publish
            </button>
          </div>
        </div>
      )}

      {/* Avatar Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A0033] border border-white/20 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <button onClick={() => setShowAvatarModal(false)} className="absolute top-4 right-4 text-white/50 hover:text-white">✕</button>
            <h2 className="text-2xl font-black uppercase tracking-widest text-[#00E5FF] mb-6">Customize Avatar</h2>
            
            <div className="flex justify-center mb-8">
               <div className="w-32 h-32 rounded-full border-4 border-[#00E5FF] flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: avatarColor + '20' }}>
                  {/* Visual preview of avatar */}
                  {avatarBodyShape === 'blocky' && <Box size={48} color={avatarColor} />}
                  {avatarBodyShape === 'round' && <User size={48} color={avatarColor} />}
                  {avatarBodyShape === 'humanoid' && <User size={48} color={avatarColor} className="scale-125" />}
                  {avatarAccessory === 'hat' && <div className="absolute top-2 w-16 h-8 bg-purple-500 rounded-t-lg border-b-4 border-yellow-400"></div>}
                  {avatarAccessory === 'crown' && <div className="absolute top-2 text-yellow-400 font-bold text-xl">♔</div>}
                  {avatarAccessory === 'glasses' && <div className="absolute top-12 flex gap-1"><div className="w-4 h-4 rounded-full border-2 border-white"></div><div className="w-4 h-4 rounded-full border-2 border-white"></div></div>}
               </div>
            </div>

            <div className="space-y-4">
               <div>
                  <label className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2 block">Body Shape</label>
                  <div className="flex gap-2">
                     {['blocky', 'round', 'humanoid'].map(shape => (
                        <button key={shape} onClick={() => setAvatarBodyShape(shape)} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase ${avatarBodyShape === shape ? 'bg-[#00E5FF] text-black' : 'bg-white/10 text-white'}`}>{shape}</button>
                     ))}
                  </div>
               </div>
               <div>
                  <label className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2 block">Primary Color</label>
                  <div className="flex gap-2 flex-wrap">
                     {['#00E5FF', '#76FF03', '#FF4081', '#FFD700', '#9C27B0', '#FFFFFF'].map(color => (
                        <button key={color} onClick={() => setAvatarColor(color)} className={`w-10 h-10 rounded-full border-2 ${avatarColor === color ? 'border-white scale-110' : 'border-transparent'} transition-transform`} style={{ backgroundColor: color }} />
                     ))}
                  </div>
               </div>
               <div>
                  <label className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2 block">Accessory</label>
                  <div className="flex gap-2 flex-wrap">
                     {['none', 'hat', 'crown', 'glasses'].map(acc => (
                        <button key={acc} onClick={() => setAvatarAccessory(acc)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${avatarAccessory === acc ? 'bg-[#FF4081] text-white' : 'bg-white/10 text-white'}`}>{acc}</button>
                     ))}
                  </div>
               </div>
            </div>

            <button onClick={async () => {
               if (user) {
                  try {
                     await updateDoc(doc(db, "profiles", userProfile.username), {
                        avatarConfig: {
                           bodyShape: avatarBodyShape,
                           color: avatarColor,
                           accessory: avatarAccessory
                        }
                     });
                     setUserProfile({ ...userProfile, avatarConfig: { bodyShape: avatarBodyShape, color: avatarColor, accessory: avatarAccessory } });
                     addLog("Avatar updated!", "success");
                     setShowAvatarModal(false);
                  } catch (e: any) {
                     const errInfo = {
                        error: e instanceof Error ? e.message : String(e),
                        operationType: "update",
                        path: "users/" + user.uid,
                        authInfo: { uid: user.uid, email: user.email }
                     };
                     addLog("Avatar update error: " + JSON.stringify(errInfo), "error");
                  }
               }
            }} className="w-full mt-6 bg-[#00E5FF] text-black font-black uppercase tracking-widest py-3 rounded-xl transition-all">
               Save Avatar
            </button>
          </div>
        </div>
      )}



      {/* Global Errors */}
      <AnimatePresence>
        {error && (
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

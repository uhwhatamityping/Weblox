const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf8');

const headerStart = content.indexOf('<header className="w-full p-4');
const headerEnd = content.indexOf('</header>') + 9;

const homeStart = content.indexOf("{viewState === 'home' && (");
const homeEndString = "      {/* Profile View */}";
const homeEnd = content.indexOf(homeEndString);

if (headerStart === -1 || homeStart === -1 || homeEnd === -1) {
    console.error("Could not find markers.", {
        headerStart: headerStart !== -1,
        homeStart: homeStart !== -1,
        homeEnd: homeEnd !== -1
    });
    process.exit(1);
}

const newHeaderAndHome = `
      {/* Top Navigation - matching hand-drawn UI */}
      <header className="w-full flex items-center justify-between border-b border-white/20 p-2 z-20 relative" style={{ backgroundColor: activeBgColor }}>
         {/* Left: Languages */}
         <div className="flex-1 flex flex-col items-start px-2">
            <span className="text-xs font-bold text-gray-300">Languages:</span>
            <select className="bg-transparent border border-gray-400 text-white rounded px-2 py-0.5 text-sm outline-none w-32 cursor-pointer mt-1">
               <option>English(US)</option>
               <option>Spanish</option>
               <option>French</option>
            </select>
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
               
               {/* Start from Scratch */}
               <button 
                  onClick={() => startBlankGame()} 
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
                  <span className="mt-2 text-sm font-bold text-white uppercase tracking-widest">Start from Scratch</span>
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

`;

const newContent = content.substring(0, headerStart) + newHeaderAndHome + content.substring(homeEnd);

fs.writeFileSync('src/App.tsx', newContent);
console.log("Successfully updated home view to match the drawing layout.");

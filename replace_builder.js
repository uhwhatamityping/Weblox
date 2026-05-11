const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

const startIndex = content.indexOf("{viewState === 'builder' && (");
const endIndex = content.indexOf("      {/* Profile View */}");

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{viewState === 'home' && (
      <main className="flex-1 overflow-y-auto p-8 relative flex flex-col items-center">
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
             <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FF4081] rounded-full blur-[150px] opacity-20" />
             <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00E5FF] rounded-full blur-[150px] opacity-20" />
        </div>
        
        <div className="max-w-4xl w-full z-10 flex flex-col gap-8 relative mt-16">
           <div className="w-full bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col justify-center items-center shadow-2xl relative group">
              <input 
                 value={customBanner}
                 onChange={e => setCustomBanner(e.target.value)}
                 className="bg-transparent text-5xl font-black text-center text-white outline-none w-full border-b-2 border-transparent focus:border-[#76FF03] transition-colors"
                 maxLength={60}
              />
              <span className="absolute -top-3 bg-[#FF4081] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Click to Edit Custom Banner</span>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {/* Theme Customization */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl">
                 <h2 className="text-xl font-black uppercase tracking-widest text-[#00E5FF] mb-4 flex items-center gap-2">
                   <Sparkles size={18} /> App Theme
                 </h2>
                 <div className="flex flex-col gap-2">
                    {Object.keys(themeColors).map(t => (
                       <button 
                         key={t}
                         onClick={() => setAppTheme(t)}
                         className={\`p-3 rounded-xl font-bold text-left transition-colors flex items-center justify-between border \${appTheme === t ? 'bg-white/20 border-white text-white' : 'bg-black/20 border-white/5 text-white/50 hover:bg-white/10 hover:text-white'}\`}
                       >
                         {t}
                         {appTheme === t && <div className="w-4 h-4 rounded-full bg-[#76FF03]" />}
                       </button>
                    ))}
                 </div>
              </div>

              {/* Start Playing/Building */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col justify-center">
                 <h2 className="text-xl font-black uppercase tracking-widest text-[#76FF03] mb-4 flex items-center gap-2">
                   <LayoutGrid size={18} /> Quick Start
                 </h2>
                 <p className="text-white/60 mb-6 font-medium">Dive right into the Weblox 3D Engine. Build maps, program nodes visually, and test physics directly in the browser.</p>
                 <button 
                   onClick={() => startBlankGame()} 
                   className="w-full shadow-[0_8px_0_#4C9900] active:shadow-[0_2px_0_#4C9900] active:translate-y-2 bg-[#76FF03] hover:bg-[#66DD00] text-[#2A004E] font-black px-6 py-6 rounded-2xl transition-all tracking-widest text-xl flex items-center justify-center gap-3 uppercase cursor-pointer"
                 >
                   Open 3D Editor
                   <Box size={24} />
                 </button>
              </div>
           </div>
        </div>
      </main>
      )}

`;
  
  const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync('src/App.tsx', newContent);
  console.log('Successfully replaced builder with home.');
} else {
  console.error('Could not find start or end markers.');
}

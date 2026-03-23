import React from 'react';

export default function MapPlaceholder() {
  return (
    <div className="absolute inset-0 bg-zinc-950 overflow-hidden">
      {/* Dark Map Tiles Emulation */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, #27272a 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Grid Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="w-full h-full grid grid-cols-12 grid-rows-12 gap-px bg-zinc-800/20">
          {Array.from({ length: 144 }).map((_, i) => (
            <div key={i} className="border-r border-b border-zinc-800/30" />
          ))}
        </div>
      </div>

      {/* Decorative Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Placeholder Content */}
      <div className="relative h-full w-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20 animate-pulse-slow">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center border border-primary/30">
              <div className="w-4 h-4 bg-primary rounded-full shadow-[0_0_15px_rgba(5,150,105,0.5)]" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-zinc-100 font-bold tracking-tight text-lg">Interactive Map Layer</h2>
            <p className="text-zinc-500 text-sm max-w-[240px] mx-auto leading-relaxed">
              Waiting for video analysis to pin locations on the map.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Compass, Loader2 } from 'lucide-react';

export default function MapPlaceholder() {
  return (
    <div className="absolute inset-0 bg-background overflow-hidden">
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full grid grid-cols-12 grid-rows-12 gap-px bg-muted/20">
          {Array.from({ length: 144 }).map((_, i) => (
            <div key={i} className="border-r border-b border-muted/30" />
          ))}
        </div>
      </div>

      <div className="relative h-full flex flex-col items-center justify-center text-center p-6">
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
          <div className="relative w-24 h-24 bg-surface border border-surface-border rounded-3xl flex items-center justify-center shadow-2xl">
            <Compass className="w-12 h-12 text-primary animate-pulse" />
          </div>
        </div>

        <div className="space-y-4 max-w-sm">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-foreground font-bold tracking-tight text-lg">Interactive Map Layer</h2>
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">Initialising Tiles...</span>
            </div>
          </div>
          <p className="text-muted text-sm max-w-[240px] mx-auto leading-relaxed">
            Curating pins and building your personal travel workspace.
          </p>
        </div>
      </div>
    </div>
  );
}

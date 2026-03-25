"use client";

import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Compass, 
  MapPin, 
  Clock, 
  Navigation, 
  Utensils, 
  Beer, 
  MoreHorizontal,
  ExternalLink,
  ChevronRight,
  Loader2
} from "lucide-react";
import { GlassCard, Badge, cn } from "@/components/ui";
import { formatDuration } from "@/lib/utils/formatters";

// Dynamically import the map to avoid SSR issues with Leaflet
const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted font-medium text-sm text-center px-4">Initialising Map...</p>
      </div>
    </div>
  ),
});

interface SharedItineraryViewProps {
  itinerary: any;
}

export default function SharedItineraryView({ itinerary }: SharedItineraryViewProps) {
  const [selectedPin, setSelectedPin] = useState<any | null>(null);
  const stops = useMemo(() => 
    itinerary.stops.sort((a: any, b: any) => a.stop_order - b.stop_order),
    [itinerary.stops]
  );
  const pins = useMemo(() => stops.map((s: any) => s.pin), [stops]);
  const activeItineraryStops = useMemo(() => pins.map((p: any) => p.id), [pins]);

  const totalDuration = useMemo(() => 
    itinerary.legs.reduce((acc: number, l: any) => acc + (l.duration_seconds || 0), 0),
    [itinerary.legs]
  );

  return (
    <main className="h-screen w-full relative flex flex-col lg:flex-row overflow-hidden bg-background">
      {/* Branding Header (Mobile Only) */}
      <div className="lg:hidden p-4 flex items-center justify-between border-b border-surface-border bg-background z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Compass className="text-white w-4 h-4" />
          </div>
          <span className="text-lg font-black tracking-tighter text-foreground uppercase">GeoVibe</span>
        </div>
      </div>

      {/* Map Layer */}
      <div className="flex-1 h-[40vh] lg:h-full relative z-0">
        <LeafletMap 
          pins={pins} 
          selectedPin={selectedPin}
          activeItineraryStops={activeItineraryStops}
          itineraryLegs={itinerary.legs}
          showItinerary={true}
        />
      </div>

      {/* Sidebar Overlay */}
      <div className="w-full lg:w-[420px] lg:h-full flex flex-col bg-background/80 backdrop-blur-md lg:border-l border-surface-border shadow-2xl z-10 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 border-b border-surface-border/50">
          <div className="hidden lg:flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-2xl shadow-primary/20">
              <Compass className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tighter text-foreground uppercase">GeoVibe</span>
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight line-clamp-2">{itinerary.title}</h1>
              <div className="flex items-center gap-3 mt-1.5">
                <p className="text-[11px] text-muted font-bold uppercase tracking-widest">{stops.length} Stops</p>
                <div className="w-1 h-1 rounded-full bg-surface-border" />
                <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest">
                  {formatDuration(totalDuration)} {itinerary.legs[0]?.transport_mode || 'Route'}
                </span>
              </div>
            </div>
            {itinerary.description && (
              <p className="text-[13px] text-muted font-medium leading-relaxed italic">{itinerary.description}</p>
            )}
          </div>
        </div>

        {/* Stops Section */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">The plan</h3>
          <div className="space-y-2 relative">
            {stops.map((stop: any, idx: number) => {
              const pin = stop.pin;
              const leg = itinerary.legs.find((l: any) => l.from_pin_id === pin.id);
              const isFood = pin.category === 'Food';
              const isDrinks = pin.category === 'Drinks';
              const isOther = pin.category === 'Other';
              const isActive = selectedPin?.id === pin.id;

              return (
                <div key={stop.id} className="space-y-4">
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => setSelectedPin(pin)}
                    className={cn(
                      "group relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                      isActive 
                        ? "bg-surface border-primary/50 shadow-lg shadow-primary/5 scale-[1.02]" 
                        : "border-surface-border bg-surface/40 hover:bg-surface/60"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-xl border shrink-0 z-10",
                      isFood ? "border-amber-500/30 bg-amber-500/10 text-amber-500" : 
                      isDrinks ? "border-purple-500/30 bg-purple-500/10 text-purple-500" : 
                      isOther ? "border-blue-500/30 bg-blue-500/10 text-blue-500" :
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    )}>
                      {isFood ? <Utensils className="w-5 h-5" /> : 
                       isDrinks ? <Beer className="w-5 h-5" /> : 
                       isOther ? <MoreHorizontal className="w-5 h-5" /> :
                       <Compass className="w-5 h-5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-[13px] font-black text-foreground truncate tracking-tight uppercase group-hover:text-primary transition-colors">
                          {pin.venue_name}
                        </h4>
                        <span className="text-[10px] font-black text-muted opacity-30">#{idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-muted font-bold uppercase tracking-wider">{pin.city}</span>
                        <Badge 
                          status={isFood ? 'accent' : (isOther || isDrinks ? 'default' : 'success')} 
                          className={cn(
                            "text-[8px] px-1 py-0 h-3.5 flex items-center leading-none",
                            isDrinks && "bg-purple-500/10 text-purple-500 border-purple-500/20",
                            isOther && "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          )}
                        >
                          {pin.category}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted line-clamp-1 mt-2 font-medium italic opacity-60">
                        {pin.summary}
                      </p>
                    </div>
                  </motion.div>

                  {leg && idx < stops.length - 1 && (
                    <div className="flex items-center gap-3 ml-16 py-1">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-surface/50 border border-surface-border rounded-full shadow-sm">
                        <Clock className="w-2.5 h-2.5 text-muted/50" />
                        <span className="text-[9px] font-black text-muted uppercase tracking-widest whitespace-nowrap">
                          {formatDuration(leg.duration_seconds)}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-surface-border" />
                        <span className="text-[9px] font-bold text-muted uppercase tracking-widest">
                           {leg.transport_mode || 'Transit'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="p-6 border-t border-surface-border bg-surface/20">
          <a 
            href="/"
            className="flex items-center justify-between w-full p-4 bg-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Create your own path</span>
            <div className="flex items-center gap-1 opacity-70">
              <span>GeoVibe</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </a>
        </div>
      </div>
    </main>
  );
}
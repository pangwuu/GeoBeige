"use client";

import { useState, useEffect } from "react";
import { GlassCard, Badge, cn, Input } from "@/components/ui";
import { 
  AlertCircle,
  Sparkles, 
  MapPin, 
  Trash2, 
  Save, 
  Loader2, 
  X,
  Navigation,
  Clock,
  CheckCircle2,
  Edit3,
  Search,
  Utensils,
  Beer,
  Compass,
  LogIn,
  MoreHorizontal,
  GripVertical,
  Share2
} from "lucide-react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { getAISuggestedItinerary, generateRouteData, saveItinerary, getItineraries, deleteItinerary, updateItinerary, optimiseRoute } from "@/app/actions/itineraries";
import { TransportMode } from "@/lib/google/directions";
import { formatDuration, formatDistance } from "@/lib/utils/formatters";
import { getUser } from "@/app/actions/auth";
import { User } from "@supabase/supabase-js";
import ShareItineraryModal from "./ShareItineraryModal";

interface ItineraryDrawerProps {
  pins: any[];
  user: User | null;
  activeStops: string[];
  loadedItineraryId: string | null;
  setLoadedItineraryId: (id: string | null) => void;
  onReorderStops: (newOrder: string[]) => void;
  onRemoveStop: (pinId: string) => void;
  onClear: () => void;
  onAddStop: (pinId: string) => void;
  onRoutesGenerated: (legs: any[]) => void;
  onSignIn?: () => void;
}

export default function ItineraryDrawer({ 
  pins, 
  user,
  activeStops, 
  loadedItineraryId,
  setLoadedItineraryId,
  onReorderStops,
  onRemoveStop, 
  onClear,
  onAddStop,
  onRoutesGenerated,
  onSignIn
}: ItineraryDrawerProps) {
  const [mode, setMode] = useState<'manual' | 'ai' | 'list'>('manual');
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isOptimising, setIsOptimising] = useState(false);
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transportMode, setTransportMode] = useState<TransportMode>('transit');
  const [itineraryData, setItineraryData] = useState<{
    title: string;
    description: string;
    legs: any[];
  } | null>(null);
  
  const [savedItineraries, setSavedItineraries] = useState<any[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedPins = activeStops.map(id => pins.find(p => p.id === id)).filter(Boolean);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (mode === 'list') {
      fetchItineraries();
    }
  }, [mode, user]);

  const fetchItineraries = async () => {
    if (!user) {
      setSavedItineraries([]);
      return;
    }
    setIsLoadingList(true);
    const result = await getItineraries();
    if (result.success) {
      setSavedItineraries(result.itineraries || []);
    }
    setIsLoadingList(false);
  };

  const handleDeleteItinerary = async (id: string) => {
    if (!confirm("Delete this itinerary?")) return;
    const result = await deleteItinerary(id);
    if (result.success) {
      setSavedItineraries(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleClear = () => {
    onClear();
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsAiGenerating(true);
    setErrorMessage(null);
    const result = await getAISuggestedItinerary(aiPrompt);
    if (result.success && result.suggestion) {
      handleClear();
      result.suggestion.stops.forEach((stop: any) => {
        onAddStop(stop.pinId);
      });
      
      setItineraryData({
        title: result.suggestion.title,
        description: result.suggestion.description,
        legs: []
      });
      setMode('manual');
    } else {
      setErrorMessage(result.error || "Failed to generate AI plan");
    }
    setIsAiGenerating(false);
  };

  const handleOptimise = async () => {
    if (activeStops.length < 2) return;
    setIsOptimising(true);
    setErrorMessage(null);
    const result = await optimiseRoute(activeStops);
    if (result.success && result.optimizedIds) {
      onReorderStops(result.optimizedIds);
    } else {
      setErrorMessage(result.error || "Failed to optimise route");
    }
    setIsOptimising(false);
  };

  const handleGenerateRoute = async () => {
    if (activeStops.length < 2) return;
    setIsGeneratingRoute(true);
    setErrorMessage(null);
    const result = await generateRouteData(activeStops, transportMode);
    if (result.success && result.legs) {
      onRoutesGenerated(result.legs);
      setItineraryData(prev => ({
        title: prev?.title || "New Itinerary",
        description: prev?.description || "",
        legs: result.legs
      }));
    } else {
      setErrorMessage(result.error || "Failed to generate route");
    }
    setIsGeneratingRoute(false);
  };

  const handleSave = async () => {
    if (!itineraryData || activeStops.length < 2) return;
    setIsSaving(true);
    setErrorMessage(null);
    
    const result = await saveItinerary({
      title: itineraryData.title,
      description: itineraryData.description,
      stops: activeStops.map(id => ({ pinId: id, dwell_time_minutes: 60 })),
      legs: itineraryData.legs.map(leg => ({
        from_pin_id: leg.from_pin_id,
        to_pin_id: leg.to_pin_id,
        polyline: leg.polyline,
        duration_seconds: leg.duration_seconds,
        distance_meters: leg.distance_meters,
        mode: leg.mode
      }))
    });

    if (result.success) {
      alert("Itinerary saved successfully!");
      onClear();
      setItineraryData(null);
    } else {
      setErrorMessage(result.error || "Failed to save itinerary");
    }
    setIsSaving(false);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3 relative">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[11px] font-medium text-red-500 flex-1 pr-4">{errorMessage}</p>
              <button 
                onClick={() => setErrorMessage(null)}
                className="absolute top-2 right-2 text-red-500/50 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex bg-background/50 p-1 rounded-xl border border-surface-border">
          {(['manual', 'ai', 'list'] as const).map((m) => (
            <button 
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                mode === m ? "bg-surface text-foreground shadow-sm border border-surface-border" : "text-muted hover:text-foreground"
              )}
            >
              {m === 'manual' && <MapPin className="w-3.5 h-3.5" />}
              {m === 'ai' && <Sparkles className="w-3.5 h-3.5" />}
              {m === 'list' && <Save className="w-3.5 h-3.5" />}
              <span className="capitalize">{m}</span>
            </button>
          ))}
        </div>
        {activeStops.length > 0 && (
          <button 
            onClick={onClear}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all shadow-sm"
            title="Clear Itinerary"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-4 min-h-0">
        <AnimatePresence mode="wait">
          {mode === 'list' ? (
            <motion.div 
              key="list-mode"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col gap-4 min-h-0"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <Input 
                  placeholder="Search itineraries..." 
                  className="pl-9 h-9 text-xs"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                {!user ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <div className="w-16 h-16 rounded-3xl bg-background flex items-center justify-center mb-4 border border-surface-border shadow-xl">
                      <LogIn className="w-8 h-8 text-muted" />
                    </div>
                    <p className="text-xs text-muted font-bold uppercase tracking-widest mb-2">Private Itineraries</p>
                    <p className="text-[11px] text-muted/80 font-medium leading-relaxed max-w-[200px]">
                      Sign in to save paths, share with friends, and access your curated trips.
                    </p>
                  </div>
                ) : isLoadingList ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  </div>
                ) : savedItineraries.filter(i => i.title.toLowerCase().includes(listSearch.toLowerCase())).length > 0 ? (
                  savedItineraries
                    .filter(i => i.title.toLowerCase().includes(listSearch.toLowerCase()))
                    .map((itin) => (
                      <SavedItineraryCard 
                        key={itin.id} 
                        itinerary={itin} 
                        isLoaded={loadedItineraryId === itin.id}
                        onDelete={() => handleDeleteItinerary(itin.id)}
                        onLoad={() => {
                          onClear();
                          itin.stops.sort((a: any, b: any) => a.stop_order - b.stop_order).forEach((s: any) => onAddStop(s.pin_id));
                          onRoutesGenerated(itin.legs);
                          setLoadedItineraryId(itin.id);
                          setMode('manual');
                        }}
                        onUnload={() => {
                          onClear();
                          setLoadedItineraryId(null);
                        }}
                      />
                    ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Save className="w-8 h-8 text-muted mb-2 opacity-20" />
                    <p className="text-[11px] text-muted font-bold uppercase tracking-widest">No Itineraries Found</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : mode === 'ai' ? (
            <motion.div 
              key="ai-mode"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/20"
            >
              <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                Gemini Intelligence
              </h4>
              <p className="text-[11px] text-muted font-medium">Describe your ideal night out, and Gemini will curate the best path from your saved pins.</p>
              <div className="relative">
                <textarea 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., A romantic date night in Newtown with 3 stops, starting with an activity then dinner..."
                  className="w-full bg-background border border-surface-border rounded-xl p-3 text-xs text-foreground placeholder:text-muted focus:ring-1 focus:ring-primary outline-none min-h-[100px] resize-none"
                />
              </div>
              <button 
                onClick={handleAiGenerate}
                disabled={isAiGenerating || !aiPrompt}
                className="w-full py-3 bg-primary text-white rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isAiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Plan with AI
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="manual-mode"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col gap-4 min-h-0"
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black uppercase text-muted tracking-[0.2em]">
                  {activeStops.length} {activeStops.length === 1 ? 'Stop' : 'Stops'} Selected
                </h3>
                {activeStops.length > 0 && (
                  <button onClick={handleClear} className="text-[10px] text-red-500 font-bold hover:underline uppercase tracking-wider">
                    Clear All
                  </button>
                )}
              </div>

              <Reorder.Group 
                axis="y" 
                values={activeStops} 
                onReorder={onReorderStops}
                className="space-y-2 flex-1 overflow-y-auto pr-1 min-h-0 custom-scrollbar"
              >
                {selectedPins.length > 0 ? (
                  selectedPins.map((pin, idx) => (
                    <Reorder.Item 
                      key={pin.id} 
                      value={pin.id}
                      className="group relative"
                    >
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface/50 border border-surface-border group-hover:bg-surface transition-all">
                        <div className="cursor-grab active:cursor-grabbing text-muted/30 hover:text-muted transition-colors">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="w-6 h-6 rounded-full bg-background border border-surface-border flex items-center justify-center text-[10px] font-black text-muted group-hover:text-primary transition-colors">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate tracking-tight">{pin.venue_name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-muted font-bold uppercase tracking-wider">{pin.city}</span>
                            <Badge 
                              status={pin.category === 'Food' ? 'accent' : (pin.category === 'Other' || pin.category === 'Drinks' ? 'default' : 'success')} 
                              className={cn(
                                "text-[8px] px-1 py-0 h-3 flex items-center leading-none",
                                pin.category === 'Drinks' && "bg-purple-500/10 text-purple-500 border-purple-500/20",
                                pin.category === 'Other' && "bg-blue-500/10 text-blue-500 border-blue-500/20"
                              )}
                            >
                              {pin.category}
                            </Badge>
                          </div>
                        </div>
                        <button 
                          onClick={() => onRemoveStop(pin.id)}
                          className="p-1.5 opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      {idx < selectedPins.length - 1 && (
                        <div className="ml-10 py-1 flex items-center gap-3">
                          <div className="h-10 border-l-2 border-dashed border-surface-border ml-[-1px] shrink-0" />
                          
                          {itineraryData?.legs[idx] && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-surface border border-surface-border rounded-full animate-in fade-in slide-in-from-left-2 duration-300 shadow-sm">
                              <Clock className="w-2.5 h-2.5 text-muted" />
                              <span className="text-[9px] font-black text-muted uppercase tracking-wider">
                                {formatDuration(itineraryData.legs[idx].duration_seconds)}
                              </span>
                              <div className="w-1 h-1 rounded-full bg-surface-border" />
                              <span className="text-[9px] font-bold text-muted uppercase tracking-wider">
                                {formatDistance(itineraryData.legs[idx].distance_meters)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </Reorder.Item>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
                    <div className="w-16 h-16 rounded-3xl bg-background flex items-center justify-center mb-4 border border-surface-border shadow-xl">
                      <MapPin className="w-8 h-8 text-muted" />
                    </div>
                    <p className="text-xs text-muted font-bold uppercase tracking-widest mb-2">Build Your Trip</p>
                    <p className="text-[11px] text-muted/60 font-medium leading-relaxed max-w-[200px]">
                      Select markers on the map sequentially to build your perfect night out.
                    </p>
                  </div>
                )}
              </Reorder.Group>

              {activeStops.length >= 2 && (
                <div className="pt-4 border-t border-surface-border space-y-4">
                  {!itineraryData?.legs.length && (
                    <button 
                      onClick={handleOptimise}
                      disabled={isOptimising}
                      className="w-full py-2 bg-surface border border-surface-border text-foreground rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-surface-hover transition-all disabled:opacity-50"
                    >
                      {isOptimising ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
                      Optimise Order
                    </button>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">Transport Mode</label>
                      {itineraryData?.legs.length ? (
                         <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                              Total: {formatDuration(itineraryData.legs.reduce((acc, l) => acc + (l.duration_seconds || 0), 0))}
                            </span>
                         </div>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      {(['transit', 'walking', 'driving'] as TransportMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setTransportMode(m)}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all",
                            transportMode === m 
                              ? "bg-primary/10 text-primary border-primary/30" 
                              : "bg-background text-muted border-surface-border hover:border-muted/50"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {itineraryData?.legs.length ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                         <div className="flex items-center gap-2 text-emerald-500 mb-1">
                           <CheckCircle2 className="w-4 h-4" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Route Calculated</span>
                         </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest">Itinerary Name</label>
                          <Input 
                            value={itineraryData.title}
                            onChange={(e) => setItineraryData({ ...itineraryData, title: e.target.value })}
                            className="h-9 py-1 text-xs bg-background border-surface-border font-bold"
                            placeholder="E.g., Newtown Food Crawl"
                          />
                        </div>
                      </div>
                      {!user ? (
                        <div className="p-4 rounded-xl bg-background border border-surface-border text-center shadow-sm">
                          <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-3">Sign in to save this trip</p>
                          <button 
                            onClick={onSignIn}
                            className="w-full py-3 bg-surface border border-surface-border text-foreground rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-surface-hover transition-all"
                          >
                            Sign In
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={handleSave}
                          disabled={isSaving}
                          className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Itinerary
                        </button>
                      )}
                    </div>
                  ) : (
                    <button 
                      onClick={handleGenerateRoute}
                      disabled={isGeneratingRoute}
                      className="w-full py-4 bg-primary text-white rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      {isGeneratingRoute ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                      Generate Route & Timings
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SavedItineraryCard({ 
  itinerary, 
  onDelete, 
  onLoad, 
  onUnload, 
  isLoaded 
}: { 
  itinerary: any, 
  onDelete: () => void, 
  onLoad: () => void, 
  onUnload: () => void, 
  isLoaded: boolean 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: itinerary.title, description: itinerary.description || "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleUpdate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating(true);
    const result = await updateItinerary(itinerary.id, editForm);
    if (result.success) {
      setIsEditing(false);
      itinerary.title = editForm.title;
      itinerary.description = editForm.description;
    }
    setIsUpdating(false);
  };

  return (
    <div className="group bg-surface/40 border border-surface-border rounded-xl p-3 hover:bg-surface/60 transition-all shadow-sm">
      <ShareItineraryModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        itinerary={itinerary}
      />
      {isEditing ? (
        <div className="space-y-3">
          <Input 
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            className="h-8 text-xs font-bold"
          />
          <textarea 
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            className="w-full bg-background border border-surface-border rounded-lg p-2 text-[10px] text-foreground min-h-[50px] outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(false)} className="flex-1 py-1 bg-surface text-[10px] font-bold rounded-md border border-surface-border">Cancel</button>
            <button onClick={handleUpdate} className="flex-1 py-1 bg-primary text-white text-[10px] font-bold rounded-md">
              {isUpdating ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-foreground truncate tracking-tight">{itinerary.title}</h4>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-muted font-medium line-clamp-1">{itinerary.description || "No description"}</p>
                {itinerary.legs?.length > 0 && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-surface-border" />
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest whitespace-nowrap">
                      {formatDuration(itinerary.legs.reduce((acc: number, l: any) => acc + (l.duration_seconds || 0), 0))}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsShareModalOpen(true)} className="p-1 hover:bg-primary/10 rounded text-muted hover:text-primary transition-colors"><Share2 className="w-3 h-3" /></button>
              <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-surface-hover rounded text-muted hover:text-foreground transition-colors"><Edit3 className="w-3 h-3" /></button>
              <button onClick={onDelete} className="p-1 hover:bg-red-500/10 rounded text-muted hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
          
          <div className="space-y-1 mb-4 relative pl-3">
            <div className="absolute left-0 top-1 bottom-1 w-[1.5px] border-l border-dashed border-surface-border" />
            
            {itinerary.stops.sort((a: any, b: any) => a.stop_order - b.stop_order).map((s: any, idx: number) => {
              const category = s.pin?.category;
              const isFood = category === 'Food';
              const isDrinks = category === 'Drinks';
              const isOther = category === 'Other';
              const leg = itinerary.legs?.find((l: any) => l.from_pin_id === s.pin_id);
              
              return (
                <div key={s.id} className="space-y-1">
                  <div className="flex items-center gap-2 group/stop">
                    <div className={cn(
                      "flex items-center justify-center w-4 h-4 rounded-md border shrink-0",
                      isFood ? "border-amber-500/30 bg-amber-500/10 text-amber-500" : 
                      isDrinks ? "border-purple-500/30 bg-purple-500/10 text-purple-500" : 
                      isOther ? "border-blue-500/30 bg-blue-500/10 text-blue-500" :
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    )}>
                      {isFood ? <Utensils className="w-2 h-2" /> : 
                       isDrinks ? <Beer className="w-2 h-2" /> : 
                       isOther ? <MoreHorizontal className="w-2 h-2" /> :
                       <Compass className="w-2 h-2" />}
                    </div>
                    <span className="text-[10px] font-bold text-muted truncate tracking-tight group-hover/stop:text-foreground transition-colors">
                      {s.pin?.venue_name}
                    </span>
                  </div>
                  
                  {leg && idx < itinerary.stops.length - 1 && (
                    <div className="flex items-center gap-1.5 ml-0.5 py-0.5">
                      <Clock className="w-2 h-2 text-muted/50" />
                      <span className="text-[8px] font-black text-muted uppercase tracking-tighter">
                        {formatDuration(leg.duration_seconds)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

            {isLoaded ? (
              <button 
                onClick={onUnload}
                className="w-full py-1.5 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest rounded-lg border border-primary/30 transition-all flex items-center justify-center gap-2"
              >
                <X className="w-3 h-3" />
                Unload from Map
              </button>
            ) : (
              <button 
                onClick={onLoad}
                className="w-full py-1.5 bg-surface hover:bg-primary/10 text-muted hover:text-primary text-[9px] font-black uppercase tracking-widest rounded-lg border border-surface-border hover:border-primary/30 transition-all flex items-center justify-center gap-2"
              >
                <Navigation className="w-3 h-3" />
                Load to Map
              </button>
            )}
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import UnifiedSearchBar from "@/components/forms/UnifiedSearchBar";
import { GlassCard, Badge, cn, Input } from "@/components/ui";
import { Compass, History, Share2, LogIn, Search, Loader2, Trash2, X, ChevronUp, Edit3, Save, Utensils, MapPinned, Beer, MoreHorizontal, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deletePin, updatePin } from "@/app/actions/pins";
import { searchPlaces } from "@/app/actions/manualPins";
import ItineraryDrawer from "@/components/map/ItineraryDrawer";
import ThemeToggle from "@/components/ui/ThemeToggle";
import AuthModal from "@/components/auth/AuthModal";
import { getUser } from "@/app/actions/auth";
import { User } from "@supabase/supabase-js";


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

export default function Home() {
  const [activeTab, setActiveTab] = useState<'activity' | 'search' | 'itinerary'>('activity');
  const [pins, setPins] = useState<any[]>([]);
  const [isLoadingPins, setIsLoadingPins] = useState(false);
  const [mapBounds, setMapBounds] = useState<{ ne: [number, number], sw: [number, number] } | null>(null);
  const [pinSearch, setPinSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Food' | 'Drinks' | 'Activity' | 'Other'>('all');
  const [selectedPin, setSelectedPin] = useState<any | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeItineraryStops, setActiveItineraryStops] = useState<string[]>([]);
  const [itineraryLegs, setItineraryLegs] = useState<any[]>([]);
  const [loadedItineraryId, setLoadedItineraryId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  
  const refreshUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  }, [supabase]);

  useEffect(() => {
    setMounted(true);
    refreshUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router, refreshUser]);

  // If the modal was just closed, proactively check for a user session
  // This handles cases where the event listener might be slightly delayed
  useEffect(() => {
    if (!isAuthModalOpen && mounted) {
      refreshUser();
    }
  }, [isAuthModalOpen, mounted, refreshUser]);

  useEffect(() => {
    const fetchPins = async () => {
      setIsLoadingPins(true);
      
      let query = supabase
        .from("pins")
        .select("*")
        .order("created_at", { ascending: false });

      if (mapBounds && !selectedPin) {
        // PostGIS filter: location && BOX(sw_lng sw_lat, ne_lng ne_lat)
        query = query.filter('location', 'contained_in', `BOX(${mapBounds.sw[1]} ${mapBounds.sw[0]}, ${mapBounds.ne[1]} ${mapBounds.ne[0]})`);
      }
      
      const { data, error } = await query;
      if (data) setPins(data);
      setIsLoadingPins(false);
    };

    fetchPins();

    const channel = supabase
      .channel("realtime-pins")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pins" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setPins((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setPins((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            );
          } else if (payload.eventType === "DELETE") {
            setPins((prev) => prev.filter((p) => p.id === payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mapBounds, selectedPin]);

  const handleBoundsChange = useCallback((bounds: { ne: [number, number], sw: [number, number] }) => {
    setMapBounds(prev => {
      if (!prev) return bounds;
      if (prev.ne[0] === bounds.ne[0] && prev.ne[1] === bounds.ne[1] &&
          prev.sw[0] === bounds.sw[0] && prev.sw[1] === bounds.sw[1]) {
        return prev;
      }
      return bounds;
    });
  }, []);

  const filteredPins = pins.filter(pin => {
    const matchesSearch = pin.venue_name?.toLowerCase().includes(pinSearch.toLowerCase()) || 
                         pin.city?.toLowerCase().includes(pinSearch.toLowerCase()) ||
                         pin.summary?.toLowerCase().includes(pinSearch.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || pin.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSelectPin = (pin: any) => {
    if (selectedPin?.id === pin.id) {
      setSelectedPin(null);
    } else {
      setSelectedPin(pin);
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    }
  };

  const handleDeselectPin = () => {
    setSelectedPin(null);
  };

  const MAX_STOPS = 5;

  const handleAddStop = (pinId: string) => {
    setLoadedItineraryId(null);
    setActiveItineraryStops(prev => {
      if (prev.includes(pinId)) return prev;
      if (prev.length >= MAX_STOPS) {
        alert(`You can only add up to ${MAX_STOPS} stops to your itinerary.`);
        return prev;
      }
      return [...prev, pinId];
    });
    setActiveTab('itinerary');
    setIsSidebarOpen(true);
  };

  const handleReorderStops = (newOrder: string[]) => {
    setLoadedItineraryId(null);
    setActiveItineraryStops(newOrder);
    setItineraryLegs([]); // Reset legs when order changes to force recalculation
  };

  const handleRemoveStop = (pinId: string) => {
    setLoadedItineraryId(null);
    setActiveItineraryStops(prev => prev.filter(id => id !== pinId));
    setItineraryLegs([]); // Reset legs if stops change
  };

  const handleClearItinerary = () => {
    setLoadedItineraryId(null);
    setActiveItineraryStops([]);
    setItineraryLegs([]);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };  

  return (
    <div className="relative h-screen w-full bg-background overflow-hidden font-sans selection:bg-primary/30 flex flex-col lg:block">
      {/* Full Background Map */}
      <div className="absolute inset-0 z-0">
        <LeafletMap 
          pins={pins} 
          selectedPin={selectedPin} 
          activeItineraryStops={activeItineraryStops}
          onAddStop={handleAddStop}
          onRemoveStop={handleRemoveStop}
          itineraryLegs={itineraryLegs}
          showItinerary={activeTab === 'itinerary'}
          onBoundsChange={handleBoundsChange}
        />
      </div>

      {/* Floating Command Centre (Input) */}
      <div className="fixed top-4 lg:top-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-lg px-4 sm:px-6">
        <UnifiedSearchBar user={user} />
      </div>

      {/* Mobile Activity Toggle */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[900] lg:hidden">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="h-12 px-6 bg-surface border border-surface-border backdrop-blur-xl rounded-full text-foreground font-bold text-sm flex items-center gap-2 shadow-2xl transition-transform active:scale-95"
        >
          <History className="w-4 h-4 text-primary" />
          <span>View Activity</span>
          <ChevronUp className="w-4 h-4 text-muted" />
        </button>
      </div>

      {/* Mobile Sidebar Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Glass Sidebar */}
      <aside className={cn(
        "fixed z-[1200] lg:z-[900] transition-all duration-500 ease-in-out flex flex-col gap-4",
        "lg:top-6 lg:left-6 lg:bottom-6 lg:w-[400px] lg:pointer-events-none",
        !mounted 
          ? "bottom-[-100%] left-0 right-0 h-[85vh] w-full p-4 pointer-events-none"
          : isSidebarOpen 
            ? "bottom-0 left-0 right-0 h-[85vh] w-full p-4 pointer-events-auto" 
            : "bottom-[-100%] left-0 right-0 h-[85vh] w-full p-4 pointer-events-none lg:pointer-events-none"
      )}>
        <GlassCard className="hidden lg:block p-5 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Compass className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-foreground">GeoVibe</h1>
              <div className="flex flex-col gap-0.5 mt-0.5">
                <p className="text-[9px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                  1. Paste a TikTok or Instagram link to analyse
                </p>
                <p className="text-[9px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5"> 
                  2. Select pins to build itinerary
                  
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="flex-1 p-5 flex flex-col gap-6 pointer-events-auto overflow-hidden relative">
          <div className="lg:hidden flex items-center justify-between mb-2">
            <div className="w-10 h-1 bg-surface-border rounded-full absolute top-3 left-1/2 -translate-x-1/2" />
            <h2 className="text-lg font-black text-foreground mt-2">
              {activeTab === 'activity' ? 'Activity' : activeTab === 'search' ? 'Manual Add' : 'Itinerary'}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <ThemeToggle className="h-8 w-8 shadow-none" />
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="w-8 h-8 rounded-lg bg-background border border-surface-border flex items-center justify-center text-muted hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <nav className="flex bg-background/50 p-1 rounded-xl border border-surface-border">
            <button 
              onClick={() => setActiveTab('activity')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                activeTab === 'activity' ? "bg-surface text-foreground shadow-sm border border-surface-border" : "text-muted hover:text-foreground"
              )}
            >
              <History className="w-3.5 h-3.5" />
              Activity
            </button>
            <button 
              onClick={() => setActiveTab('itinerary')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all relative",
                activeTab === 'itinerary' ? "bg-surface text-foreground shadow-sm border border-surface-border" : "text-muted hover:text-foreground"
              )}
            >
              <MapPinned className="w-3.5 h-3.5" />
              Itinerary
              {activeItineraryStops.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-background">
                  {activeItineraryStops.length}
                </span>
              )}
            </button>
          </nav>

          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {activeTab === 'activity' ? (
              <>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                    <Input 
                      placeholder="Search venue, city, or vibe..." 
                      className="pl-9 h-9 text-xs"
                      value={pinSearch}
                      onChange={(e) => setPinSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar-hide">
                    {(['all', 'Food', 'Drinks', 'Activity', 'Other'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all",
                          categoryFilter === cat 
                            ? "bg-primary/10 text-primary border-primary/30 shadow-sm" 
                            : "bg-background/50 text-muted border-surface-border hover:border-muted/50"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-bold uppercase text-muted tracking-widest">Recent Activity</h3>
                  {selectedPin && (
                    <button 
                      onClick={handleDeselectPin}
                      className="text-[10px] text-primary font-bold hover:underline uppercase tracking-wider flex items-center gap-1"
                    >
                      <X className="w-2.5 h-2.5" />
                      Clear Selection
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {isLoadingPins && pins.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted">Initialising Pins...</p>
                    </div>
                  ) : filteredPins.length > 0 ? (
                    filteredPins.map((pin) => (
                      <ActivityCard 
                        key={pin.id}
                        pin={pin}
                        onClick={() => handleSelectPin(pin)}
                        active={selectedPin?.id === pin.id}
                        onAddStop={handleAddStop}
                        isInItinerary={activeItineraryStops.includes(pin.id)}
                        onDeselect={handleDeselectPin}
                      />
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <div className="w-12 h-12 rounded-full bg-background border border-surface-border flex items-center justify-center mb-3">
                        <History className="w-6 h-6 text-muted" />
                      </div>
                      <p className="text-xs text-muted font-medium">No activity found.<br/>Try adjusting your search.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <ItineraryDrawer 
                pins={pins}
                user={user}
                activeStops={activeItineraryStops}
                loadedItineraryId={loadedItineraryId}
                setLoadedItineraryId={setLoadedItineraryId}
                onReorderStops={handleReorderStops}
                onRemoveStop={handleRemoveStop}
                onClear={handleClearItinerary}
                onAddStop={handleAddStop}
                onRoutesGenerated={setItineraryLegs}
                onSignIn={() => setIsAuthModalOpen(true)}
              />
            )}
          </div>

          <footer className="pt-4 border-t border-surface-border text-[10px] text-muted font-medium flex justify-between items-center">
            <span>&copy; 2026 GeoVibe</span>
            <span className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity cursor-help">
              <span className="w-1 h-1 bg-primary rounded-full animate-pulse" />
              Sydney, AU
            </span>
          </footer>
        </GlassCard>
      </aside>

      {/* Floating Action Buttons */}
      <div className="hidden lg:flex fixed top-6 right-6 z-[900] gap-3">
        <ThemeToggle className="h-11 w-11" />
        {user ? (
          <div className="flex items-center gap-3 bg-surface border border-surface-border backdrop-blur-md rounded-xl px-1.5 shadow-xl">
            <span className="hidden sm:inline text-[10px] font-black text-muted uppercase tracking-widest pl-2">
              {user.email?.split('@')[0]}
            </span>
            <button 
              onClick={() => handleSignOut()}
              className="h-8 px-3 bg-background border border-surface-border hover:bg-surface-hover text-muted hover:text-foreground rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsAuthModalOpen(true)}
            className="h-11 px-5 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary-hover transition-all flex items-center gap-2 shadow-xl shadow-primary/20"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        )}
      </div>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}

function ActivityCard({ pin, onClick, active, onAddStop, isInItinerary, onDeselect }: { pin: any, onClick?: () => void, active?: boolean, onAddStop?: (id: string) => void, isInItinerary?: boolean, onDeselect?: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    venue_name: pin.venue_name || "",
    summary: pin.summary || "",
    category: pin.category || "Activity",
    city: pin.city || "",
    lat: 0,
    lng: 0
  });
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  const handleLocationSearch = async () => {
    if (!locationSearch.trim()) return;
    setIsSearchingLocation(true);
    const results = await searchPlaces(locationSearch);
    setLocationResults(results);
    setIsSearchingLocation(false);
  };

  const selectLocation = (result: any) => {
    setEditForm({
      ...editForm,
      venue_name: result.text,
      city: result.place_name.split(',')[0].trim(),
      lat: result.center[1],
      lng: result.center[0]
    });
    setLocationResults([]);
    setLocationSearch("");
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to remove this pin?")) return;
    
    setIsDeleting(true);
    const result = await deletePin(pin.id);
    if (result.error) {
      alert(result.error);
      setIsDeleting(false);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditForm({
      venue_name: pin.venue_name || "",
      summary: pin.summary || "",
      category: pin.category || "Activity",
      city: pin.city || "",
      lat: 0,
      lng: 0
    });
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setLocationResults([]);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating(true);
    
    const updates: any = {
      venue_name: editForm.venue_name,
      summary: editForm.summary,
      category: editForm.category,
      city: editForm.city,
      status: 'completed'
    };

    if (editForm.lat !== 0 && editForm.lng !== 0) {
      updates.location = `POINT(${editForm.lng} ${editForm.lat})`;
    }

    const result = await updatePin(pin.id, updates);
    if (result.success) {
      setIsEditing(false);
    } else {
      alert(result.error || "Failed to update pin");
    }
    setIsUpdating(false);
  };

  if (isEditing) {
    return (
      <div className="p-3 rounded-xl border border-primary/30 bg-background shadow-xl space-y-3" onClick={e => e.stopPropagation()}>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted uppercase">Correct Location</label>
          <div className="flex gap-2">
            <Input 
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              placeholder="Search Google Places..."
              className="h-8 py-1 text-xs"
              onKeyDown={e => e.key === 'Enter' && handleLocationSearch()}
            />
            <button 
              onClick={handleLocationSearch}
              disabled={isSearchingLocation}
              className="px-2 bg-surface border border-surface-border rounded-lg text-muted hover:text-foreground transition-all"
            >
              {isSearchingLocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            </button>
          </div>
          
          {locationResults.length > 0 && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto custom-scrollbar border border-surface-border rounded-lg p-1 bg-surface/50">
              {locationResults.map(res => (
                <button 
                  key={res.id}
                  onClick={() => selectLocation(res)}
                  className="w-full text-left p-1.5 hover:bg-primary/10 rounded text-[10px] transition-colors"
                >
                  <p className="font-bold text-foreground">{res.text}</p>
                  <p className="text-muted truncate text-[9px]">{res.place_name}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted uppercase">Venue Name</label>
          <Input 
            value={editForm.venue_name}
            onChange={(e) => setEditForm({ ...editForm, venue_name: e.target.value })}
            className="h-8 py-1 text-xs"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted uppercase">Category</label>
          <div className="flex gap-2">
            <button 
              onClick={() => setEditForm({ ...editForm, category: 'Food' })}
              className={cn(
                "flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1.5",
                editForm.category === 'Food' ? "bg-amber-500/10 text-amber-500 border-amber-500/30" : "bg-background text-muted border-surface-border"
              )}
            >
              <Utensils className="w-3 h-3" />
              Food
            </button>
            <button 
              onClick={() => setEditForm({ ...editForm, category: 'Drinks' })}
              className={cn(
                "flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1.5",
                editForm.category === 'Drinks' ? "bg-purple-500/10 text-purple-500 border-purple-500/30" : "bg-background text-muted border-surface-border"
              )}
            >
              <Beer className="w-3 h-3" />
              Drinks
            </button>
            <button 
              onClick={() => setEditForm({ ...editForm, category: 'Activity' })}
              className={cn(
                "flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1.5",
                editForm.category === 'Activity' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-background text-muted border-surface-border"
              )}
            >
              <Compass className="w-3 h-3" />
              Activity
            </button>
            <button 
              onClick={() => setEditForm({ ...editForm, category: 'Other' })}
              className={cn(
                "flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1.5",
                editForm.category === 'Other' ? "bg-blue-500/10 text-blue-500 border-blue-500/30" : "bg-background text-muted border-surface-border"
              )}
            >
              <MoreHorizontal className="w-3 h-3" />
              Other
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted uppercase">Vibe Summary</label>
          <textarea 
            value={editForm.summary}
            onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-surface-border rounded-xl text-xs text-foreground outline-none focus:ring-1 focus:ring-primary min-h-[60px]"
            placeholder="Tell us the vibe..."
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={handleCancel} className="flex-1 py-1.5 rounded-lg bg-surface text-muted text-[10px] font-bold hover:bg-surface-hover hover:text-foreground transition-all flex items-center justify-center gap-1.5">
            <X className="w-3 h-3" />
            Cancel
          </button>
          <button onClick={handleSave} disabled={isUpdating} className="flex-1 py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold hover:bg-primary-hover transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
            {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
        </div>
      </div>
    );
  }

  const title = pin.venue_name || "Analysing...";
  const status = pin.status === 'completed' ? 'success' : (pin.status === 'failed' ? 'warning' : 'processing');
  const description = pin.summary || (pin.status === 'failed' ? "AI found the vibe, but couldn't pin the exact spot. Click edit to search manually." : "Extracting details from video...");
  const isFood = pin.category === 'Food';
  const isDrinks = pin.category === 'Drinks';
  const isOther = pin.category === 'Other';

  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative p-3 rounded-xl border transition-all cursor-pointer",
        active 
          ? "bg-surface border-primary/50 shadow-lg shadow-primary/5" 
          : "border-surface-border bg-surface/40 hover:bg-surface/60"
      )}
    >
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex flex-col min-w-0">
          <span className={cn(
            "font-bold text-sm transition-colors pr-2 truncate", 
            active ? "text-foreground" : "text-foreground group-hover:text-primary transition-colors"
          )}>{title}</span>
          {pin.status === 'failed' && (
            <div className="flex items-center gap-1 text-[9px] font-black text-amber-500 uppercase tracking-wider">
              <AlertCircle className="w-2.5 h-2.5" />
              <span>Location Unresolved</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {active && onDeselect && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDeselect();
              }}
              className="p-1 hover:bg-primary/20 rounded-lg text-primary transition-all"
              title="Deselect"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {status === 'success' && onAddStop && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isInItinerary) onAddStop(pin.id);
              }}
              className={cn(
                "p-1 rounded-lg transition-all",
                isInItinerary ? "text-primary bg-primary/10" : "text-muted hover:text-primary hover:bg-primary/10"
              )}
              title={isInItinerary ? "Added to itinerary" : "Add to itinerary"}
            >
              <MapPinned className="w-3.5 h-3.5" />
            </button>
          )}

          <Badge 
            status={isFood ? 'accent' : (isOther ? 'default' : status)} 
            className={cn(
              "text-[9px] px-1.5 py-0",
              isDrinks && "bg-purple-500/10 text-purple-500 border-purple-500/20",
              isOther && "bg-blue-500/10 text-blue-500 border-blue-500/20"
            )}
          >
            {status === 'success' ? pin.category : (status === 'warning' ? 'Needs Fix' : 'AI')}
          </Badge>
          
          <div className="flex items-center">
            <button onClick={handleEdit} className="p-1 hover:bg-primary/20 rounded-lg text-muted hover:text-primary transition-all" title="Edit Pin">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete} disabled={isDeleting} className="p-1 hover:bg-red-500/20 rounded-lg text-muted hover:text-red-400 transition-all disabled:opacity-50" title="Delete Pin">
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
      <div className="text-[11px] text-muted line-clamp-2 italic leading-relaxed">
        {description}
      </div>
      <div className={cn(
        "absolute inset-0 border rounded-xl transition-all pointer-events-none",
        active ? "border-primary/30" : "border-primary/0 group-hover:border-primary/20"
      )} />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import UnifiedSearchBar from "@/components/forms/UnifiedSearchBar";
import { GlassCard, Badge, cn, Input } from "@/components/ui";
import { Compass, History, Share2, LogIn, Search, Loader2, Trash2, X, ChevronUp, Edit3, Save, Utensils, MapPinned, Beer, MoreHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deletePin, updatePin } from "@/app/actions/pins";
import BionicText from "@/components/ui/BionicText";
import ItineraryDrawer from "@/components/map/ItineraryDrawer";
import ThemeToggle from "@/components/ui/ThemeToggle";
import AuthModal from "@/components/auth/AuthModal";
import { getUser, signOut } from "@/app/actions/auth";
import { User } from "@supabase/supabase-js";


// Dynamically import the map to avoid SSR issues with Leaflet
const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-zinc-500 font-medium text-sm text-center px-4">Initialising Map...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [activeTab, setActiveTab] = useState<'activity' | 'search' | 'itinerary'>('activity');
  const [pins, setPins] = useState<any[]>([]);
  const [pinSearch, setPinSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Food' | 'Drinks' | 'Activity' | 'Other'>('all');
  const [selectedPin, setSelectedPin] = useState<any | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeItineraryStops, setActiveItineraryStops] = useState<string[]>([]);
  const [itineraryLegs, setItineraryLegs] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const supabase = createClient();
  

  useEffect(() => {
    setMounted(true);
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUser = async () => {
    const user = await getUser();
    setUser(user);
  };

  useEffect(() => {
    // Initial fetch
    const fetchPins = async () => {
      const { data, error } = await supabase
        .from("pins")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (data) setPins(data);
    };

    fetchPins();

    // Real-time subscription
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
  }, []);

  const filteredPins = pins.filter(pin => {
    const matchesSearch = pin.venue_name?.toLowerCase().includes(pinSearch.toLowerCase()) || 
                         pin.city?.toLowerCase().includes(pinSearch.toLowerCase()) ||
                         pin.summary?.toLowerCase().includes(pinSearch.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || pin.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSelectPin = (pin: any) => {
    setSelectedPin(pin);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleAddStop = (pinId: string) => {
    setActiveItineraryStops(prev => {
      if (prev.includes(pinId)) return prev;
      return [...prev, pinId];
    });
    setActiveTab('itinerary');
    setIsSidebarOpen(true);
  };

  const handleRemoveStop = (pinId: string) => {
    setActiveItineraryStops(prev => prev.filter(id => id !== pinId));
    setItineraryLegs([]); // Reset legs if stops change
  };

  const handleClearItinerary = () => {
    setActiveItineraryStops([]);
    setItineraryLegs([]);
  };

  return (
    <div className="relative h-screen w-full bg-zinc-950 overflow-hidden font-sans selection:bg-primary/30 flex flex-col lg:block">
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
        />
      </div>

      {/* Floating Command Centre (Input) - Centred and responsive width */}
      <div className="fixed top-4 lg:top-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-lg px-4 sm:px-6">
        <UnifiedSearchBar />
      </div>

      {/* Mobile Activity Toggle (Floating bottom) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[900] lg:hidden">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="h-12 px-6 bg-zinc-900/90 border border-zinc-800 backdrop-blur-xl rounded-full text-white font-bold text-sm flex items-center gap-2 shadow-2xl mobile-drawer-shadow transition-transform active:scale-95"
        >
          <History className="w-4 h-4 text-primary" />
          <span>View Activity</span>
          <ChevronUp className="w-4 h-4 text-zinc-500" />
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

      {/* Glass Sidebar (Responsive Drawer on Mobile) */}
      <aside className={cn(
  "fixed z-[1200] lg:z-[900] transition-all duration-500 ease-in-out flex flex-col gap-4",
  "lg:top-6 lg:left-6 lg:bottom-6 lg:w-[400px] lg:pointer-events-none",
  // Only apply dynamic mobile classes after mount
  !mounted 
    ? "bottom-[-100%] left-0 right-0 h-[85vh] w-full p-4 pointer-events-none"
    : isSidebarOpen 
      ? "bottom-0 left-0 right-0 h-[85vh] w-full p-4 pointer-events-auto" 
      : "bottom-[-100%] left-0 right-0 h-[85vh] w-full p-4 pointer-events-none lg:pointer-events-none"
)}>
        {/* Brand Header (Desktop Only) */}
        <GlassCard className="hidden lg:block p-5 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Compass className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-zinc-100">GeoVibe</h1>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">InstaNightPlanner</p>
            </div>
          </div>
        </GlassCard>

        {/* Navigation / Activity */}
        <GlassCard className="flex-1 p-5 flex flex-col gap-6 pointer-events-auto overflow-hidden relative">
          {/* Mobile Handle / Close */}
          <div className="lg:hidden flex items-center justify-between mb-2">
            <div className="w-10 h-1 bg-zinc-800 rounded-full absolute top-3 left-1/2 -translate-x-1/2" />
            <h2 className="text-lg font-black text-zinc-100 mt-2">
              {activeTab === 'activity' ? 'Activity' : activeTab === 'search' ? 'Manual Add' : 'Itinerary'}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <ThemeToggle className="h-8 w-8" />
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <nav className="flex bg-zinc-950/50 p-1 rounded-xl border border-surface-border">
            <button 
              onClick={() => setActiveTab('activity')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                activeTab === 'activity' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <History className="w-3.5 h-3.5" />
              Activity
            </button>
            <button 
              onClick={() => setActiveTab('itinerary')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all relative",
                activeTab === 'itinerary' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <MapPinned className="w-3.5 h-3.5" />
              Itinerary
              {activeItineraryStops.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-zinc-900">
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <Input 
                      placeholder="Search venue, city, or vibe..." 
                      className="pl-9 h-9 text-xs bg-zinc-950/50"
                      value={pinSearch}
                      onChange={(e) => setPinSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {(['all', 'Food', 'Drinks', 'Activity', 'Other'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all",
                          categoryFilter === cat 
                            ? "bg-primary/10 text-primary border-primary/30 shadow-sm" 
                            : "bg-zinc-950/30 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <h3 className="text-[11px] font-bold uppercase text-zinc-500 tracking-widest px-1">Recent Activity</h3>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {filteredPins.length > 0 ? (
                    filteredPins.map((pin) => (
                      <ActivityCard 
                        key={pin.id}
                        pin={pin}
                        onClick={() => handleSelectPin(pin)}
                        active={selectedPin?.id === pin.id}
                        onAddStop={handleAddStop}
                        isInItinerary={activeItineraryStops.includes(pin.id)}
                      />
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-3">
                        <History className="w-6 h-6 text-zinc-700" />
                      </div>
                      <p className="text-xs text-zinc-500 font-medium">No activity found.<br/>Try adjusting your search.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <ItineraryDrawer 
                pins={pins}
                activeStops={activeItineraryStops}
                onRemoveStop={handleRemoveStop}
                onClear={handleClearItinerary}
                onAddStop={handleAddStop}
                onRoutesGenerated={setItineraryLegs}
                onSignIn={() => setIsAuthModalOpen(true)}
              />
            )}
          </div>

          <footer className="pt-4 border-t border-surface-border text-[10px] text-zinc-500 font-medium flex justify-between items-center">
            <span>&copy; 2026 GeoVibe</span>
            <span className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity cursor-help">
              <span className="w-1 h-1 bg-primary rounded-full animate-pulse" />
              Sydney, AU
            </span>
          </footer>
        </GlassCard>
      </aside>

      {/* Floating Action Buttons (Desktop Only) */}
      <div className="hidden lg:flex fixed top-6 right-6 z-[900] gap-3">
        <ThemeToggle className="h-11 w-11" />
        <button className="h-11 px-4 bg-surface border border-surface-border backdrop-blur-md rounded-xl text-zinc-300 font-bold text-xs hover:bg-zinc-800/50 hover:text-zinc-100 transition-all flex items-center gap-2 shadow-xl">
          <Share2 className="w-4 h-4" />
          <span>Share Map</span>
        </button>
        {user ? (
          <div className="flex items-center gap-3 bg-surface border border-surface-border backdrop-blur-md rounded-xl px-1.5 shadow-xl">
            <span className="hidden sm:inline text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">
              {user.email?.split('@')[0]}
            </span>
            <button 
              onClick={() => signOut()}
              className="h-8 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all"
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

function ActivityCard({ pin, onClick, active, onAddStop, isInItinerary }: { pin: any, onClick?: () => void, active?: boolean, onAddStop?: (id: string) => void, isInItinerary?: boolean }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    venue_name: pin.venue_name || "",
    summary: pin.summary || "",
    category: pin.category || "Activity"
  });

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
      category: pin.category || "Activity"
    });
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating(true);
    const result = await updatePin(pin.id, editForm);
    if (result.success) {
      setIsEditing(false);
    } else {
      alert(result.error || "Failed to update pin");
    }
    setIsUpdating(false);
  };

  if (isEditing) {
    return (
      <div className="p-3 rounded-xl border border-primary/30 bg-zinc-900 shadow-xl space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase">Venue Name</label>
          <Input 
            value={editForm.venue_name}
            onChange={(e) => setEditForm({ ...editForm, venue_name: e.target.value })}
            className="h-8 py-1 text-xs"
          />
        </div>
        
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase">Category</label>
          <div className="flex gap-2">
            <button 
              onClick={() => setEditForm({ ...editForm, category: 'Food' })}
              className={cn(
                "flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1.5",
                editForm.category === 'Food' ? "bg-amber-400/10 text-amber-400 border-amber-400/30" : "bg-zinc-950 text-zinc-500 border-zinc-800"
              )}
            >
              <Utensils className="w-3 h-3" />
              Food
            </button>
            <button 
              onClick={() => setEditForm({ ...editForm, category: 'Drinks' })}
              className={cn(
                "flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1.5",
                editForm.category === 'Drinks' ? "bg-purple-400/10 text-purple-400 border-purple-400/30" : "bg-zinc-950 text-zinc-500 border-zinc-800"
              )}
            >
              <Beer className="w-3 h-3" />
              Drinks
            </button>
            <button 
              onClick={() => setEditForm({ ...editForm, category: 'Activity' })}
              className={cn(
                "flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1.5",
                editForm.category === 'Activity' ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" : "bg-zinc-950 text-zinc-500 border-zinc-800"
              )}
            >
              <Compass className="w-3 h-3" />
              Activity
            </button>
            <button 
              onClick={() => setEditForm({ ...editForm, category: 'Other' })}
              className={cn(
                "flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1.5",
                editForm.category === 'Other' ? "bg-blue-400/10 text-blue-400 border-blue-400/30" : "bg-zinc-950 text-zinc-500 border-zinc-800"
              )}
            >
              <MoreHorizontal className="w-3 h-3" />
              Other
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase">Vibe Summary</label>
          <textarea 
            value={editForm.summary}
            onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-primary min-h-[60px]"
            placeholder="Tell us the vibe..."
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button 
            onClick={handleCancel}
            className="flex-1 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-[10px] font-bold hover:bg-zinc-700 transition-all flex items-center justify-center gap-1.5"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isUpdating}
            className="flex-1 py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold hover:bg-primary-hover transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
        </div>
      </div>
    );
  }

  const title = pin.venue_name || "Analysing...";
  const status = pin.status === 'completed' ? 'success' : 'processing';
  const description = pin.summary || "Extracting details from video...";
  const isFood = pin.category === 'Food';
  const isDrinks = pin.category === 'Drinks';
  const isOther = pin.category === 'Other';

  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative p-3 rounded-xl border transition-all cursor-pointer",
        active 
          ? "bg-zinc-800/80 border-primary/50 shadow-lg shadow-primary/5" 
          : "border-surface-border bg-zinc-950/40 hover:bg-zinc-900/60"
      )}
    >
      <div className="flex justify-between items-start mb-1.5">
        <span className={cn(
          "font-bold text-sm transition-colors pr-2", 
          active ? "text-white" : "text-zinc-200 group-hover:text-white"
        )}>{title}</span>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {status === 'success' && onAddStop && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isInItinerary) onAddStop(pin.id);
              }}
              className={cn(
                "p-1 rounded-lg transition-all",
                isInItinerary ? "text-primary bg-primary/10" : "text-zinc-500 hover:text-primary hover:bg-primary/10"
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
              isDrinks && "bg-purple-900/30 text-purple-400 border-purple-800/50",
              isOther && "bg-blue-900/30 text-blue-400 border-blue-800/50"
            )}
          >
            {status === 'success' ? pin.category : 'AI'}
          </Badge>
          
          <div className="flex items-center">
            <button
              onClick={handleEdit}
              className="p-1 hover:bg-primary/20 rounded-lg text-zinc-500 hover:text-primary transition-all"
              title="Edit Pin"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1 hover:bg-red-500/20 rounded-lg text-zinc-500 hover:text-red-400 transition-all disabled:opacity-50"
              title="Delete Pin"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
      <div className="text-[11px] text-zinc-500 line-clamp-2 italic leading-relaxed">
        <BionicText text={description} />
      </div>
      <div className={cn(
        "absolute inset-0 border rounded-xl transition-all pointer-events-none",
        active ? "border-primary/30" : "border-primary/0 group-hover:border-primary/20"
      )} />
    </div>
  );
}

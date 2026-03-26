"use client";

import { useState } from "react";
import { submitVideoUrl } from "@/app/actions/pins";
import { searchPlaces, addManualPin } from "@/app/actions/manualPins";
import { CommandCentre, Button, Input, cn, GlassCard } from "@/components/ui";
import { Link2, Sparkles, CheckCircle2, Search, MapPin, Utensils, Compass, Beer, Loader2, X, MoreHorizontal, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "@supabase/supabase-js";

export default function UnifiedSearchBar({ user }: { user: User | null }) {
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState("");
  
  // Manual Search States
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [addingPinId, setAddingPinId] = useState<string | null>(null);
  const [manualDescriptions, setManualDescriptions] = useState<Record<string, string>>({});

  const isUrl = (string: string) => {
    let testStr = string.trim();
    if (!/^https?:\/\//i.test(testStr)) {
      testStr = 'https://' + testStr;
    }
    try {
      const url = new URL(testStr);
      return url.hostname.includes('.') && testStr.length > 8;
    } catch (_) {
      return false;
    }
  };

  async function handleUnifiedAction(formData: FormData) {
    let value = (formData.get("query") as string || "").trim();
    if (!value) return;

    if (isUrl(value)) {
      // Ensure it has a protocol before sending to the backend
      if (!/^https?:\/\//i.test(value)) {
        value = 'https://' + value;
      }
      
      setLoading(true);
      setStatus('idle');
      setMessage("");
      setSearchResults([]);
      
      try {
        const result = await submitVideoUrl(value);
        if (result.success) {
          setStatus('success');
          setMessage(result.message || "Video queued for analysis");
          setInputValue("");
          setTimeout(() => {
            setStatus('idle');
            setMessage("");
          }, 4000);
        } else {
          setStatus('error');
          setMessage(result.error || "Failed to process link");
          setTimeout(() => {
            setStatus('idle');
            setMessage("");
          }, 5000);
        }
      } catch (error) {
        setStatus('error');
        setMessage("Connection failed. Check your network.");
      } finally {
        setLoading(false);
      }
    } else {
      if (value.length < 2) return;
      setManualLoading(true);
      setStatus('idle');
      setMessage("");
      
      try {
        const data = await searchPlaces(value);
        setSearchResults(data);
        if (data.length === 0) {
          setStatus('error');
          setMessage("No places found for that search.");
          setTimeout(() => {
            setStatus('idle');
            setMessage("");
          }, 3000);
        }
      } catch (err) {
        setStatus('error');
        setMessage("Place search unavailable.");
      } finally {
        setManualLoading(false);
      }
    }
  }

  async function handleAddManual(place: any, category: string) {
    const actionKey = `${place.id}:${category}`;
    setAddingPinId(actionKey);
    setStatus('idle');
    setMessage("");

    try {
      const cityParts = place.place_name.split(',');
      const city = cityParts.length > 1 ? cityParts[cityParts.length - 2].trim() : "Unknown";

      const result = await addManualPin({
        venue_name: place.text,
        city: city,
        lng: place.center[0],
        lat: place.center[1],
        category: category,
        summary: manualDescriptions[place.id],
        source_url: place.google_place_link
      });
      
      if (result.success) {
        setStatus('success');
        setMessage(`Added "${place.text}"!`);
        setTimeout(() => {
          setAddingPinId(null);
          setSearchResults(prev => prev.filter(r => r.id !== place.id));
          setManualDescriptions(prev => {
            const next = { ...prev };
            delete next[place.id];
            return next;
          });
          if (searchResults.length <= 1) {
             setInputValue("");
          }
          setStatus('idle');
          setMessage("");
        }, 1500);
      } else {
        setAddingPinId(null);
        setStatus('error');
        setMessage(result.error || "Could not add place.");
        setTimeout(() => {
          setStatus('idle');
          setMessage("");
        }, 4000);
      }
    } catch (err) {
      setAddingPinId(null);
      setStatus('error');
      setMessage("Failed to reach server.");
    }
  }

  return (
    <div className="relative w-full max-w-lg">
      <CommandCentre className="relative !top-0 !left-0 !translate-x-0 !w-full max-w-none px-0">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleUnifiedAction(formData);
          }} 
          className="flex-1 flex items-center gap-2"
        >
          <div className="relative flex-1 group">
            {isUrl(inputValue) ? (
              <Link2 className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
                loading ? "text-primary animate-pulse" : "text-muted group-focus-within:text-primary"
              )} />
            ) : (
              <Search className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
                manualLoading ? "text-primary animate-pulse" : "text-muted group-focus-within:text-primary"
              )} />
            )}
            <Input
              name="query"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={!user ? "Sign in to add locations..." : "Paste link or search places..."}
              className="pl-10 bg-transparent border-none focus:ring-0 h-11"
              disabled={loading}
            />
          </div>
          
          <Button 
            type="submit" 
            size="sm"
            disabled={!user || loading || manualLoading}
            className={cn(
              "h-9 px-4 rounded-lg shrink-0 transition-all min-w-[100px]",
              !user && "opacity-50 grayscale cursor-not-allowed",
              status === 'success' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
            )}
          >
            <AnimatePresence mode="wait">
              {loading || manualLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-2"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isUrl(inputValue) ? 'Analysing...' : 'Searching...'}</span>
                </motion.div>
              ) : status === 'success' ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Queued</span>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-2"
                >
                  {isUrl(inputValue) ? <Sparkles className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                  <span>{isUrl(inputValue) ? 'Analyse' : 'Search'}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </form>
        
        <AnimatePresence>
          {!user && inputValue.trim().length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap shadow-xl border border-amber-500/30 bg-amber-500/10 text-amber-500 backdrop-blur-md flex items-center gap-2"
            >
              <AlertCircle className="w-3 h-3" />
              Sign in to add locations
            </motion.div>
          )}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={cn(
                "absolute -bottom-10 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-tight whitespace-nowrap shadow-xl border backdrop-blur-md glass",
                status === 'success' 
                  ? "text-emerald-500 border-emerald-500/30" 
                  : "text-red-500 border-red-500/30"
              )}
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>
      </CommandCentre>

      {/* Manual Search Results Dropdown */}
      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 12, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="absolute left-0 right-0 z-[1100] max-h-[380px] overflow-y-auto custom-scrollbar p-2 glass rounded-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between px-2 py-1 mb-2">
               <span className="text-[10px] font-black uppercase text-muted tracking-widest">Places Found</span>
               <button onClick={() => setSearchResults([])} className="text-muted hover:text-foreground">
                 <X className="w-3.5 h-3.5" />
               </button>
            </div>
            <div className="space-y-2">
              {searchResults.map((place) => (
                <GlassCard key={place.id} className="p-3 flex flex-col gap-3 group border-surface-border hover:border-primary/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0 border border-surface-border">
                      <MapPin className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className="text-xs font-extrabold text-foreground truncate leading-none mb-1">{place.text}</p>
                      <p className="text-[10px] text-muted truncate font-medium">{place.place_name}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-muted uppercase tracking-widest pl-1">Enter a description</label>
                    <Input 
                      placeholder="e.g. Best espresso martinis in Sydney..." 
                      className="h-8 py-1 text-[10px] bg-background/50"
                      value={manualDescriptions[place.id] || ""}
                      onChange={(e) => setManualDescriptions(prev => ({ ...prev, [place.id]: e.target.value }))}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddManual(place, 'Food')}
                      disabled={!!addingPinId}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border bg-background text-muted border-surface-border hover:text-amber-500 hover:border-amber-500/30 hover:bg-amber-500/5",
                        addingPinId && addingPinId !== `${place.id}:Food` && "opacity-50 grayscale"
                      )}
                    >
                      {addingPinId === `${place.id}:Food` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Utensils className="w-3 h-3" />}
                      Food
                    </button>
                    <button
                      onClick={() => handleAddManual(place, 'Drinks')}
                      disabled={!!addingPinId}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border bg-background text-muted border-surface-border hover:text-purple-500 hover:border-purple-500/30 hover:bg-purple-500/5",
                        addingPinId && addingPinId !== `${place.id}:Drinks` && "opacity-50 grayscale"
                      )}
                    >
                      {addingPinId === `${place.id}:Drinks` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Beer className="w-3 h-3" />}
                      Drinks
                    </button>
                    <button
                      onClick={() => handleAddManual(place, 'Activity')}
                      disabled={!!addingPinId}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border bg-background text-muted border-surface-border hover:text-emerald-500 hover:border-emerald-500/30 hover:bg-emerald-500/5",
                        addingPinId && addingPinId !== `${place.id}:Activity` && "opacity-50 grayscale"
                      )}
                    >
                      {addingPinId === `${place.id}:Activity` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Compass className="w-3 h-3" />}
                      Activity
                    </button>
                    <button
                      onClick={() => handleAddManual(place, 'Other')}
                      disabled={!!addingPinId}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border bg-background text-muted border-surface-border hover:text-blue-500 hover:border-blue-500/30 hover:bg-blue-500/5",
                        addingPinId && addingPinId !== `${place.id}:Other` && "opacity-50 grayscale"
                      )}
                    >
                      {addingPinId === `${place.id}:Other` ? <Loader2 className="w-3 h-3 animate-spin" /> : <MoreHorizontal className="w-3 h-3" />}
                      Other
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

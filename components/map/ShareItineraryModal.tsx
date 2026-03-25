"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Copy, Check, Globe, Lock, Loader2, Link as LinkIcon } from "lucide-react";
import { GlassCard, Button, Input, cn } from "@/components/ui";
import { toggleItineraryPrivacy } from "@/app/actions/itineraries";

interface ShareItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  itinerary: {
    id: string;
    title: string;
    is_public: boolean;
    share_slug: string | null;
  };
}

export default function ShareItineraryModal({ isOpen, onClose, itinerary }: ShareItineraryModalProps) {
  const [isPublic, setIsPublic] = useState(itinerary.is_public);
  const [slug, setSlug] = useState(itinerary.share_slug);
  const [isUpdating, setIsUpdating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsPublic(itinerary.is_public);
    setSlug(itinerary.share_slug);
  }, [itinerary]);

  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/shared/${slug}`
    : "";

  async function handleTogglePrivacy() {
    setIsUpdating(true);
    const newStatus = !isPublic;
    const result = await toggleItineraryPrivacy(itinerary.id, newStatus);
    
    if (result.success) {
      setIsPublic(newStatus);
      if (result.slug) setSlug(result.slug);
    }
    setIsUpdating(false);
  }

  function copyToClipboard() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000]"
          />
          <div className="fixed inset-0 flex items-center justify-center z-[2001] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md pointer-events-auto"
            >
              <GlassCard className="p-6 relative overflow-visible">
                <button
                  onClick={onClose}
                  className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-background border border-surface-border flex items-center justify-center text-muted hover:text-foreground transition-colors shadow-xl"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                      <Share2 className="text-primary w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-foreground">Share Itinerary</h2>
                      <p className="text-muted text-xs font-medium truncate max-w-[240px]">{itinerary.title}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-surface-border">
                      <div className="flex items-center gap-3">
                        {isPublic ? (
                          <Globe className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Lock className="w-5 h-5 text-muted" />
                        )}
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-foreground">
                            {isPublic ? "Public Access" : "Private Access"}
                          </p>
                          <p className="text-[10px] text-muted font-medium">
                            {isPublic ? "Anyone with the link can view." : "Only you can see this itinerary."}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleTogglePrivacy}
                        disabled={isUpdating}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none",
                          isPublic ? "bg-primary" : "bg-zinc-700"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            isPublic ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                        {isUpdating && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                            <Loader2 className="w-3 h-3 animate-spin text-white" />
                          </div>
                        )}
                      </button>
                    </div>

                    <AnimatePresence>
                      {isPublic && slug && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Share Link</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                              <Input
                                readOnly
                                value={shareUrl}
                                className="pl-9 h-10 text-[11px] font-medium bg-background/50"
                              />
                            </div>
                            <Button
                              variant={copied ? "secondary" : "primary"}
                              size="sm"
                              onClick={copyToClipboard}
                              className="w-24 h-10 shrink-0"
                            >
                              {copied ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span className="text-[10px] font-black uppercase tracking-wider">
                                {copied ? "Copied" : "Copy"}
                              </span>
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="pt-2">
                    <Button variant="secondary" onClick={onClose} className="w-full">
                      Close
                    </Button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

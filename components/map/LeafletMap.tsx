"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Tooltip, LayerGroup } from "react-leaflet";
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createClient } from "@/lib/supabase/client";
import { Badge, GlassCard, cn } from "@/components/ui";
import { ExternalLink, Utensils, Compass, Plus, Minus, Beer, Clock, Footprints, Bus, Car, Bike, MoreHorizontal, Edit3, Trash2 } from "lucide-react";
import { renderToString } from "react-dom/server";
import { decodePostGISPoint } from "@/lib/utils/postgis";
import { formatDuration } from "@/lib/utils/formatters";


function MapReadyGate({ children }: { children: React.ReactNode }) {
  const map = useMap();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (map) setReady(true);
  }, [map]);

  return ready ? <>{children}</> : null;
}


// Fix for default Leaflet icons in Next.js
function createCustomIcon(category: string, status?: string) {
  const isFood = category === "Food";
  const isDrinks = category === "Drinks";
  const isOther = category === "Other";
  const colorClass = isFood ? "text-amber-400" : (isDrinks ? "text-purple-400" : (isOther ? "text-blue-400" : "text-emerald-500"));
  const bgClass = isFood ? "bg-amber-400/20" : (isDrinks ? "bg-purple-400/20" : (isOther ? "bg-blue-400/20" : "bg-emerald-500/20"));
  const borderClass = isFood ? "border-amber-400/50" : (isDrinks ? "border-purple-400/50" : (isOther ? "border-blue-400/50" : "border-emerald-500/50"));

  const iconHtml = renderToString(
    <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl border ${borderClass} ${bgClass} backdrop-blur-sm transition-transform hover:scale-110 shadow-lg`}>
      {isFood ? (
        <Utensils className={`w-5 h-5 ${colorClass}`} />
      ) : isDrinks ? (
        <Beer className={`w-5 h-5 ${colorClass}`} />
      ) : isOther ? (
        <MoreHorizontal className={`w-5 h-5 ${colorClass}`} />
      ) : (
        <Compass className={`w-5 h-5 ${colorClass}`} />
      )}

      {status === 'processing' && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse border-2 border-background" />
      )}
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-leaflet-icon",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  const iconHtml = renderToString(
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 border-2 border-primary/50 backdrop-blur-md shadow-xl">
      <span className="text-primary font-black text-xs">{count}</span>
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-cluster-icon",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function createTransportIcon(duration: number, mode?: string) {
  const ModeIcon = mode === 'walking' ? Footprints : (mode === 'driving' ? Car : (mode === 'bicycling' ? Bike : Bus));

  const iconHtml = renderToString(
    <div className="flex items-center gap-1.5 px-2 py-1 bg-surface border border-surface-border backdrop-blur-md rounded-full shadow-lg">
      <ModeIcon className="w-2.5 h-2.5 text-primary" />
      <span className="text-[9px] font-black text-foreground uppercase tracking-wider">{formatDuration(duration)}</span>
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-transport-icon",
    iconSize: [60, 24],
    iconAnchor: [30, 12],
  });
}

function MapController({ 
  selectedPin, 
  polylinePoints
}: { 
  selectedPin: any | null, 
  polylinePoints?: [number, number][]
}) {
  const map = useMap();

  const lastSelectedPinId = useRef<string | null>(null);
  const lastPolylineKey = useRef<string>("");

  useEffect(() => {
    if (selectedPin && selectedPin.id !== lastSelectedPinId.current) {
      lastSelectedPinId.current = selectedPin.id;
      const position = decodePostGISPoint(selectedPin.location || selectedPin.geography);
      if (position && !(position.lng === 0 && position.lat === 0)) {
        map.flyTo([position.lat, position.lng], 15, { duration: 1.5 });
      }
    } else if (!selectedPin && polylinePoints && polylinePoints.length > 0) {
      const polylineKey = JSON.stringify(polylinePoints.slice(0, 10)) + polylinePoints.length;
      if (polylineKey !== lastPolylineKey.current) {
        lastPolylineKey.current = polylineKey;
        const bounds = L.latLngBounds(polylinePoints);
        map.fitBounds(bounds, { padding: [50, 50], duration: 1.5 });
      }
    }

    if (!selectedPin) {
      lastSelectedPinId.current = null;
    }
  }, [selectedPin, polylinePoints, map]);

  return null;
}

// Helper to decode Google Polyline
const decodePolyline = (encoded: string): [number, number][] => {
  if (!encoded) return [];
  // Standard polyline decoding logic (simplified for this turn, using a reliable regex-based or manual approach)
  // For production, usually use '@googlemaps/polyline-codec'
  let points: [number, number][] = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
};

export default function LeafletMap({ 
  pins, 
  selectedPin, 
  user,
  activeItineraryStops = [], 
  onAddStop,
  onRemoveStop,
  onEditPin,
  onDeletePin,
  itineraryLegs = [],
  showItinerary = true
}: { 
  pins: any[], 
  selectedPin?: any | null,
  user?: any | null,
  activeItineraryStops?: string[],
  onAddStop?: (pinId: string) => void,
  onRemoveStop?: (pinId: string) => void,
  onEditPin?: (pin: any) => void,
  onDeletePin?: (pinId: string) => void,
  itineraryLegs?: any[],
  showItinerary?: boolean
}) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const allPolylinePoints = useMemo(() => 
    showItinerary ? itineraryLegs.flatMap(leg => decodePolyline(leg.polyline)) : []
  , [showItinerary, itineraryLegs]);

  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  return (
    <MapContainer
      center={[-33.8688, 151.2093]} 
      zoom={12}
      className="h-full w-full bg-background"
      zoomControl={false}
    >
      <MapController 
        selectedPin={selectedPin} 
        polylinePoints={allPolylinePoints} 
        
      />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={isDarkMode 
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        }
      />

      <MapReadyGate>
      {showItinerary && itineraryLegs.map((leg, idx) => {
        const positions = decodePolyline(leg.polyline);
        const midPoint = positions[Math.floor(positions.length / 2)];

        return (
          <LayerGroup key={`leg-group-${idx}`}>
            <Polyline
              positions={positions}
              pathOptions={{ 
                color: '#10b981', 
                weight: 4, 
                opacity: 0.6,
                dashArray: '10, 10',
                lineJoin: 'round'
              }}
            />
            {midPoint && leg.duration_seconds > 0 && (
              <Marker 
                position={midPoint} 
                icon={createTransportIcon(leg.duration_seconds, leg.mode)}
                interactive={false}
              />
            )}
          </LayerGroup>
        );
      })}

      <MarkerClusterGroup
        chunkedLoading
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={40}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
      >
        {pins.map((pin) => {
          const positionObj = decodePostGISPoint(pin.location || pin.geography);
          if (!positionObj || (positionObj.lng === 0 && positionObj.lat === 0)) return null;

          const position: [number, number] = [positionObj.lat, positionObj.lng];
          const isFood = pin.category === "Food";
          const isDrinks = pin.category === "Drinks";
          const isOther = pin.category === "Other";
          const isSelectedForItinerary = activeItineraryStops.includes(pin.id);
          const stopIndex = activeItineraryStops.indexOf(pin.id);

          return (
            <Marker
              key={pin.id}
              position={position}
              icon={createCustomIcon(pin.category, pin.status)}
            >
              <Popup className="custom-popup" maxWidth={320} minWidth={280}>
                <div className="flex gap-2 p-2 sm:gap-4 sm:p-4">
                  <div className="shrink-0 flex flex-col items-center gap-2.5">
                    <div className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-xl border backdrop-blur-sm shadow-md",
                      isFood ? 'border-amber-400/50 bg-amber-400/20' : 
                      isDrinks ? 'border-purple-400/50 bg-purple-400/20' : 
                      isOther ? 'border-blue-400/50 bg-blue-400/20' :
                      'border-emerald-500/50 bg-emerald-500/20'
                    )}>
                      {isFood ? <Utensils className="w-5 h-5 text-amber-400" /> : 
                       isDrinks ? <Beer className="w-5 h-5 text-purple-400" /> : 
                       isOther ? <MoreHorizontal className="w-5 h-5 text-blue-400" /> :
                       <Compass className="w-5 h-5 text-emerald-500" />}
                    </div>

                    {onAddStop && onRemoveStop && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!user) return;
                          isSelectedForItinerary ? onRemoveStop(pin.id) : onAddStop(pin.id);
                        }}
                        disabled={!user}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-lg",
                          !user ? "bg-muted/10 border border-muted/20 text-muted opacity-50 cursor-not-allowed" :
                          isSelectedForItinerary 
                            ? "bg-red-500/20 border border-red-500/50 text-red-500 hover:bg-red-500/30" 
                            : "bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30"
                        )}
                        title={!user ? "Sign in to build itinerary" : (isSelectedForItinerary ? "Remove from itinerary" : "Add to itinerary")}
                      >
                        {isSelectedForItinerary ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </button>
                    )}

                    <div className="flex flex-col gap-2 pt-1 border-t border-surface-border/50 w-full items-center">
                      <button 
                        onClick={() => user && onEditPin?.(pin)}
                        disabled={!user}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          !user ? "text-muted opacity-30 cursor-not-allowed" : "text-muted hover:text-primary hover:bg-primary/10"
                        )}
                        title={!user ? "Sign in to edit" : "Edit Pin"}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => user && onDeletePin?.(pin.id)}
                        disabled={!user}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          !user ? "text-muted opacity-30 cursor-not-allowed" : "text-muted hover:text-red-500 hover:bg-red-500/10"
                        )}
                        title={!user ? "Sign in to delete" : "Delete Pin"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-col mb-2.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-foreground text-base leading-tight tracking-tight line-clamp-2">
                            {pin.venue_name || "Analysing..."}
                          </h3>
                          {isSelectedForItinerary && (
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black">
                              {stopIndex + 1}
                            </span>
                          )}
                        </div>
                        <div>
                          <Badge 
                            status={pin.category === 'Food' ? 'accent' : (pin.category === 'Other' || pin.category === 'Drinks' ? 'default' : (pin.status === 'processing' ? 'processing' : 'success'))}
                            className={cn(
                              "text-[9px] px-1.5 py-0",
                              pin.category === 'Other' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                              pin.category === 'Drinks' && "bg-purple-500/10 text-purple-500 border-purple-500/20"
                            )}
                          >
                            {pin.category || 'Pending'}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-4">
                        {pin.summary ? (
                          pin.summary.split('\n').map((line: string, i: number) => (
                            <p key={i} className="text-[11px] text-muted leading-relaxed font-medium">
                              • {line.trim().startsWith('•') || line.trim().startsWith('-') ? line.trim().substring(1).trim() : line.trim()}
                            </p>
                          ))
                        ) : (
                          <p className="text-xs text-muted italic">Generating summary...</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-surface-border">
                      <span 
                        className="text-[10px] text-muted font-bold uppercase tracking-wider truncate flex-1 min-w-0 mr-4" 
                        title={pin.city || 'Processing'}
                      >
                        {pin.city || 'Processing'}
                      </span>
                      {pin.source_url && (
                        <a
                          href={pin.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] font-black text-primary hover:text-primary-hover transition-colors uppercase tracking-widest shrink-0"
                        >
                          Original
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
      </MapReadyGate>

    </MapContainer>
  );
}
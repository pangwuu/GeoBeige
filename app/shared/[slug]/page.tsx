import { getPublicItinerary } from "@/app/actions/itineraries";
import SharedItineraryView from "./SharedItineraryView";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicItinerary(slug);

  if (!result.success || !result.itinerary) {
    return {
      title: "Itinerary Not Found | GeoVibe",
    };
  }

  const itin = result.itinerary;
  return {
    title: `${itin.title} | GeoVibe`,
    description: itin.description || `Check out this travel itinerary on GeoVibe.`,
    openGraph: {
      title: itin.title,
      description: itin.description || `Check out this travel itinerary on GeoVibe.`,
      type: "website",
    },
  };
}

export default async function SharedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getPublicItinerary(slug);

  if (!result.success || !result.itinerary) {
    notFound();
  }

  return <SharedItineraryView itinerary={result.itinerary} />;
}

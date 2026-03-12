import { NextRequest, NextResponse } from 'next/server';

// Uses Overpass API (OpenStreetMap) — free, no API key needed
// Also uses Nominatim for geocoding address to lat/lon

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
            { headers: { 'User-Agent': 'VeroAI/1.0' } }
        );
        let data: any = null;
        try { data = await res.json(); } catch { return null; }

        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
        return null;
    } catch {
        return null;
    }
}

async function searchNearbyPlaces(lat: number, lon: number, category: string, radiusMeters: number = 1500) {
    // Map category to Overpass amenity types
    const categoryMap: Record<string, string> = {
        restaurant: '["amenity"~"restaurant|fast_food|cafe|food_court"]',
        food: '["amenity"~"restaurant|fast_food|cafe|food_court|bar"]',
        attraction: '["tourism"~"attraction|museum|artwork|viewpoint|zoo|theme_park"]',
        hotel: '["tourism"~"hotel|motel|hostel|guest_house"]',
        shop: '["shop"]',
        hospital: '["amenity"~"hospital|clinic|pharmacy"]',
        atm: '["amenity"~"atm|bank"]',
    };

    const filter = categoryMap[category] || categoryMap['food'];

    const query = `
        [out:json][timeout:10];
        (
            node${filter}(around:${radiusMeters},${lat},${lon});
            way${filter}(around:${radiusMeters},${lat},${lon});
        );
        out center body 20;
    `;

    const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter'
    ];

    let places: any[] = [];
    let success = false;

    for (const endpoint of endpoints) {
        if (success) break;
        try {
            console.log(`maps: trying overpass endpoint ${endpoint}`);
            const res = await fetch(endpoint, {
                method: 'POST',
                body: `data=${encodeURIComponent(query)}`,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            const text = await res.text();

            // Checking if response is XML/HTML error before JSON parse
            if (text.includes('<?xml') || text.includes('<html>') || text.includes('Error')) {
                console.warn(`Overpass API ${endpoint} failed/busy (returned HTML). Trying next.`);
                continue;
            }

            const data = JSON.parse(text);

            places = (data.elements || [])
                .filter((el: any) => el.tags?.name)
                .map((el: any) => {
                    const placeLat = el.lat || el.center?.lat;
                    const placeLon = el.lon || el.center?.lon;
                    // Calculate approximate distance
                    const dist = getDistanceKm(lat, lon, placeLat, placeLon);
                    return {
                        name: el.tags.name,
                        type: el.tags.amenity || el.tags.tourism || el.tags.shop || 'place',
                        cuisine: el.tags.cuisine || '',
                        address: el.tags['addr:street'] ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] || ''}`.trim() : '',
                        phone: el.tags.phone || el.tags['contact:phone'] || '',
                        website: el.tags.website || el.tags['contact:website'] || '',
                        opening_hours: el.tags.opening_hours || '',
                        lat: placeLat,
                        lon: placeLon,
                        distance_km: Math.round(dist * 100) / 100,
                        maps_url: `https://www.google.com/maps/search/?api=1&query=${placeLat},${placeLon}`,
                    };
                })
                .sort((a: any, b: any) => a.distance_km - b.distance_km)
                .slice(0, 15);

            success = true;
        } catch (err) {
            console.error(`Overpass error for ${endpoint}:`, err);
        }
    }

    return places;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { business_name, address, city, category = 'food', radius = 1500, lat, lon } = body;

        let coords: { lat: number; lon: number } | null = null;

        if (lat && lon) {
            // Bypass geocoding if exact coordinates are provided (e.g. from Maps link)
            coords = { lat: parseFloat(lat), lon: parseFloat(lon) };
        } else {
            // Create smarter fallback strings by extracting District (Kecamatan/Kec.)
            let districtMatch = address?.match(/(?:Kec\.|Kecamatan)\s+([A-Za-z\s]+)(?:,|\b)/i);
            let district = districtMatch ? districtMatch[1].trim() : '';

            // Setup search hierarchy: 
            // 1. Business Name + City
            // 2. Address + City
            // 3. Business Name + District + City
            // 4. District + City
            // 5. City
            const searchQueries = [];
            if (business_name && city) searchQueries.push(`${business_name}, ${city}`.trim());
            if (address && city) searchQueries.push(`${address}, ${city}`.trim());
            if (business_name && district && city) searchQueries.push(`${business_name}, ${district}, ${city}`.trim());
            if (district && city) searchQueries.push(`${district}, ${city}`.trim());
            if (city) searchQueries.push(city.trim());

            if (searchQueries.length === 0) {
                return NextResponse.json({ error: 'Address or City is required if no coordinates provided' }, { status: 400 });
            }

            // Try geocoding from most specific to least
            for (const query of searchQueries) {
                if (!query || query === ',') continue;
                coords = await geocodeAddress(query);
                if (coords) break;
            }
        }

        if (!coords) {
            return NextResponse.json({ error: 'Could not geocode address', places: [] }, { status: 200 });
        }

        // Search nearby
        const places = await searchNearbyPlaces(coords.lat, coords.lon, category, radius);

        return NextResponse.json({
            coords,
            places,
            query: { address, category, radius },
        });
    } catch (error: any) {
        console.error('Places error:', error);
        return NextResponse.json({ error: 'Failed to search places: ' + error.message }, { status: 500 });
    }
}

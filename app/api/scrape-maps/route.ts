import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();
        if (!url || (!url.includes('google.com/maps') && !url.includes('goo.gl'))) {
            return NextResponse.json({ error: 'Invalid Google Maps URL' }, { status: 400 });
        }

        // Fetch the raw HTML of the maps link
        // Some Google Maps short links redirect, so we need to follow redirects
        const res = await fetch(url, {
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });

        const finalUrl = res.url;
        const html = await res.text();

        // 1. Extract Business Name from title
        // e.g. <meta property="og:title" content="Pakuwon Mall - Google Maps">
        let businessName = '';
        let address = '';
        let city = '';
        let lat = null;
        let lon = null;

        const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
        if (titleMatch) {
            businessName = titleMatch[1].replace(' · Google Map', '').replace(' \u00b7 Google Map', '').replace(' - Google Maps', '').trim();
        }

        // URL parsing for exact name if meta fails or returns generic "Google Maps"
        if (!businessName || businessName === 'Google Maps') {
            const nameMatch = finalUrl.match(/\/place\/([^\/]+)\//);
            if (nameMatch) {
                businessName = decodeURIComponent(nameMatch[1].replace(/\+/g, ' '));
            } else {
                const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
                if (titleTagMatch) businessName = titleTagMatch[1].replace('- Google Maps', '').trim();
            }
        }

        // 2. Extract address from meta description
        // e.g. <meta property="og:description" content="Pakuwon Mall \u00b7 Jl. Mayjend. Jonosewojo No.2, Babatan, Kec. Wiyung, Surabaya, Jawa Timur 60227">
        const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
        if (descMatch) {
            const desc = descMatch[1].replace(/\\u00b7/g, '·');
            const parts = desc.split('·');
            if (parts.length > 1) {
                // Usually the second part is the address
                address = parts[1].trim();
            } else if (parts.length === 1 && businessName !== desc) {
                address = desc.trim();
            }
        }

        // Attempt to extract city from address (usually right before province)
        if (address) {
            const addrParts = address.split(',');
            if (addrParts.length >= 3) {
                // City is often the second to last or 3rd to last in Indonesian addresses
                // e.g. ..., Kec. Wiyung, Surabaya, Jawa Timur 60227
                for (let i = addrParts.length - 1; i >= 0; i--) {
                    const part = addrParts[i].trim();
                    if (part.startsWith('Kota ') || part.startsWith('Kabupaten ') ||
                        ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Denpasar'].some(c => part.includes(c))) {
                        city = part.replace(/[0-9]+/g, '').trim();
                        break;
                    }
                }
                if (!city && addrParts.length > 2) {
                    // Fallback guess: 2nd to last part, stripping digits (postal codes)
                    city = addrParts[addrParts.length - 2].replace(/[0-9]+/g, '').trim();
                    if (city.includes('Kec')) {
                        city = addrParts[addrParts.length - 1].replace(/[0-9]+/g, '').trim();
                    }
                }
            }
        }

        // 3. Extract exact coordinates from URL parameters (!3d... !4d...)
        const pinMatch = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (pinMatch) {
            lat = parseFloat(pinMatch[1]);
            lon = parseFloat(pinMatch[2]);
        } else {
            // Fallback 1: look at viewport in URL
            const coordsMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (coordsMatch) {
                lat = parseFloat(coordsMatch[1]);
                lon = parseFloat(coordsMatch[2]);
            } else {
                // Fallback 2: Sometimes it's buried in the window.APP_INITIALIZATION_STATE
                const initMatch = html.match(/window\.APP_INITIALIZATION_STATE\s*=\s*(.*?)\];/);
                if (initMatch) {
                    try {
                        const appState = JSON.parse(initMatch[1] + ']');
                        // It's a huge array, coords are usually tucked deep or in standard places like [0, [0, lat, lon]]
                        const strData = JSON.stringify(appState);
                        const latLonMatches = [...strData.matchAll(/(-?\d+\.\d{5,}),(-?\d+\.\d{5,})/g)];
                        if (latLonMatches.length > 0) {
                            lat = parseFloat(latLonMatches[0][1]);
                            lon = parseFloat(latLonMatches[0][2]);
                        }
                    } catch (e) { }
                }
            }
        }

        // 4. If we have coordinates but no address/city, use Nominatim reverse geocoding
        if (lat && lon && (!address || !city)) {
            try {
                const reverseRes = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=id`,
                    { headers: { 'User-Agent': 'AI-Vero-App/1.0' } }
                );
                if (reverseRes.ok) {
                    const geo = await reverseRes.json();
                    if (geo.address) {
                        if (!address) {
                            // Build a clean address from components
                            const parts = [
                                geo.address.road,
                                geo.address.house_number ? `No.${geo.address.house_number}` : '',
                                geo.address.suburb || geo.address.village,
                                geo.address.city_district ? `Kec. ${geo.address.city_district}` : '',
                            ].filter(Boolean);
                            address = parts.join(', ');
                        }
                        if (!city) {
                            city = geo.address.city || geo.address.town || geo.address.county || geo.address.state || '';
                        }
                    }
                }
            } catch (e) {
                console.warn('Reverse geocoding failed:', e);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                business_name: businessName,
                address,
                city,
                lat,
                lon
            }
        });
    } catch (error: any) {
        console.error('Scrape maps error:', error);
        return NextResponse.json({ error: 'Failed to scrape maps: ' + error.message }, { status: 500 });
    }
}

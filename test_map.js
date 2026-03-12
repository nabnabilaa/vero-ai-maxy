const https = require('https');

async function fetchUrl(url) {
    try {
        const response = await fetch(url, {
            redirect: 'follow', // Make sure to follow redirects
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const finalUrl = response.url;
        console.log("Final URL:", finalUrl);

        let businessName = '';
        let lat = null;
        let lon = null;

        // 1. Extract Name from URL path (/place/STORE+NAME/...)
        const nameMatch = finalUrl.match(/\/place\/([^\/]+)\//);
        if (nameMatch) {
            businessName = decodeURIComponent(nameMatch[1].replace(/\+/g, ' '));
            console.log("Business Name:", businessName);
        }

        // 2. Extract Exact Coordinates from URL parameters (!3d... !4d...)
        const pinMatch = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (pinMatch) {
            lat = parseFloat(pinMatch[1]);
            lon = parseFloat(pinMatch[2]);
            console.log("Exact Pin Coordinates:", lat, lon);
        } else {
            // Fallback to Viewport coordinates (@lat,lon)
            const viewMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (viewMatch) {
                lat = parseFloat(viewMatch[1]);
                lon = parseFloat(viewMatch[2]);
                console.log("Viewport Coordinates:", lat, lon);
            }
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

fetchUrl('https://maps.app.goo.gl/13f5R3bpQjfBdaKz8');

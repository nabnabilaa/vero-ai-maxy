import * as cheerio from 'cheerio';

// ─── URL Classification ────────────────────────────────────────────────
// Determine if a URL is "general" (should deep-crawl entire site)
// or "specific" (only scrape that single page)
export function isGeneralUrl(url: URL): boolean {
    const path = url.pathname.replace(/\/+$/, ''); // trim trailing slashes

    // Root domain = definitely general
    if (!path || path === '' || path === '/') return true;

    const segments = path.split('/').filter(Boolean);

    // Common homepage/landing paths
    const generalPaths = ['home', 'index', 'id', 'en', 'about', 'services', 'products', 'contact', 'tentang', 'layanan', 'kontak', 'rooms', 'facilities', 'gallery'];
    if (segments.length === 1 && generalPaths.includes(segments[0].toLowerCase())) return true;

    // If path has a numeric ID segment → specific (e.g. /berita/123, /product/456)
    if (segments.some(seg => /^\d+$/.test(seg))) return false;

    // If path has ≥ 3 segments → likely specific (e.g. /blog/2024/03/my-article)  
    if (segments.length >= 3) return false;

    // If path ends with a file extension → specific
    if (/\.\w{2,5}$/.test(path)) return false;

    // Short paths (≤ 2 segments) without IDs → treat as general
    if (segments.length <= 2) return true;

    return false;
}

// ─── User-Agent rotation to reduce bot detection ────────────────────────
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
];

function getRandomUA(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ─── Puppeteer-based scraper (handles JavaScript-rendered sites) ────────
async function scrapeWithPuppeteer(targetUrl: string): Promise<{ title: string; markdown: string; links: string[] }> {
    const url = new URL(targetUrl);
    const puppeteer = require('puppeteer');

    console.log(`[Scraper:Puppeteer] Launching browser for: ${targetUrl}`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-features=VizDisplayCompositor',
            '--window-size=1280,720',
        ],
    });

    try {
        const page = await browser.newPage();
        const ua = getRandomUA();
        await page.setUserAgent(ua);
        await page.setViewport({ width: 1280, height: 720 });

        // Block unnecessary resources to speed up load
        await page.setRequestInterception(true);
        page.on('request', (req: any) => {
            const type = req.resourceType();
            if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto(url.toString(), {
            waitUntil: 'networkidle2',
            timeout: 25000,
        });

        // Wait a bit for any lazy-loaded content
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try to dismiss cookie/consent banners
        try {
            await page.evaluate(() => {
                const selectors = [
                    '[class*="cookie"] button',
                    '[class*="consent"] button',
                    '[id*="cookie"] button',
                    '[class*="Cookie"] button',
                    'button[class*="accept"]',
                    'button[class*="Accept"]',
                    '[data-testid*="cookie"] button',
                ];
                for (const sel of selectors) {
                    const btn = document.querySelector(sel) as HTMLButtonElement;
                    if (btn) { btn.click(); break; }
                }
            });
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch { /* ignore consent errors */ }

        const pageTitle = await page.title();

        // Extract links BEFORE removing navigation
        const renderedLinks: string[] = await page.evaluate((origin: string, hostname: string) => {
            const links: string[] = [];
            document.querySelectorAll('a[href]').forEach(a => {
                try {
                    const u = new URL(a.getAttribute('href') || '', origin);
                    if (u.hostname === hostname && u.protocol.startsWith('http')) {
                        u.hash = '';
                        links.push(u.toString().replace(/\/+$/, ''));
                    }
                } catch { }
            });
            return [...new Set(links)];
        }, url.origin, url.hostname);

        // Extract clean body text
        const bodyText: string = await page.evaluate(() => {
            // Remove noisy elements
            document.querySelectorAll('script, style, svg, nav, footer, header, aside, form, iframe, noscript, [role="navigation"], [role="banner"], [class*="cookie"], [class*="popup"], [class*="modal"], [class*="overlay"]').forEach(el => el.remove());

            const result: string[] = [];
            const seenTexts = new Set<string>();

            // Extract structured content
            document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, figcaption, dt, dd, address, article, section, [class*="content"], [class*="body"], [class*="description"], [class*="text"], main').forEach(el => {
                // Only get direct text, avoid deep nested duplicates for containers
                const tag = el.tagName.toLowerCase();
                let text = '';

                if (['article', 'section', 'main'].includes(tag) || el.className?.toString().includes('content') || el.className?.toString().includes('body')) {
                    // For container elements, get innerText but only if no child content elements
                    const hasContentChildren = el.querySelector('h1, h2, h3, p, li');
                    if (!hasContentChildren) {
                        text = (el as HTMLElement).innerText?.replace(/\s+/g, ' ').trim() || '';
                    }
                } else {
                    text = (el as HTMLElement).innerText?.replace(/\s+/g, ' ').trim() || '';
                }

                if (!text || text.length < 5) return;
                if (seenTexts.has(text)) return;
                seenTexts.add(text);

                if (tag === 'h1') result.push(`\n# ${text}\n`);
                else if (tag === 'h2') result.push(`\n## ${text}\n`);
                else if (tag === 'h3') result.push(`\n### ${text}\n`);
                else if (tag.startsWith('h')) result.push(`\n#### ${text}\n`);
                else if (tag === 'li') result.push(`- ${text}\n`);
                else if (tag === 'blockquote') result.push(`> ${text}\n`);
                else result.push(`${text}\n\n`);
            });

            // Fallback: if structured extraction got very little, just get all body text
            if (result.join('').trim().length < 200) {
                return document.body?.innerText || '';
            }

            return result.join('');
        });

        console.log(`[Scraper:Puppeteer] Extracted ${bodyText.length} chars from ${targetUrl}`);

        return {
            title: pageTitle || '',
            markdown: bodyText.trim(),
            links: renderedLinks,
        };
    } finally {
        await browser.close();
    }
}

// ─── Cheerio-based scraper (fast, for server-rendered sites) ────────────
async function scrapeWithCheerio(targetUrl: string): Promise<{ title: string; markdown: string; links: string[] }> {
    const url = new URL(targetUrl);
    const internalLinks: string[] = [];

    const res = await fetch(url.toString(), {
        headers: {
            'User-Agent': getRandomUA(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return { title: '', markdown: '', links: [] };

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        return { title: '', markdown: '', links: [] };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Collect internal links BEFORE stripping nav/footer
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
            const linkUrl = new URL(href, url.origin);
            if (linkUrl.hostname === url.hostname && linkUrl.protocol.startsWith('http')) {
                linkUrl.hash = '';
                const normalized = linkUrl.toString().replace(/\/+$/, '');
                if (!internalLinks.includes(normalized)) {
                    internalLinks.push(normalized);
                }
            }
        } catch { /* invalid URL, skip */ }
    });

    // Strip noisy elements for content extraction
    $('script, style, svg, nav, footer, iframe, noscript, link, meta, header, aside, form, button, input, select, textarea').remove();

    const title = $('title').text().trim() || $('h1').first().text().trim() || '';

    let markdown = '';
    const seenTexts = new Set<string>();

    $('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, figcaption, dt, dd, address').each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (!text || text.length < 5) return;
        if (seenTexts.has(text)) return;
        seenTexts.add(text);

        const tagName = (el as any).tagName?.toLowerCase() || '';
        if (tagName === 'h1') markdown += `\n# ${text}\n`;
        else if (tagName === 'h2') markdown += `\n## ${text}\n`;
        else if (tagName === 'h3') markdown += `\n### ${text}\n`;
        else if (tagName.startsWith('h')) markdown += `\n#### ${text}\n`;
        else if (tagName === 'li') markdown += `- ${text}\n`;
        else if (tagName === 'blockquote') markdown += `> ${text}\n`;
        else markdown += `${text}\n\n`;
    });

    console.log(`[Scraper:Cheerio] Extracted ${markdown.trim().length} chars from ${targetUrl}`);

    return { title, markdown: markdown.trim(), links: internalLinks };
}

// ─── Google Cache / alternative source fallback ─────────────────────────
async function scrapeViaAlternativeSource(targetUrl: string): Promise<{ title: string; markdown: string; links: string[] }> {
    // Try fetching from Google's web cache
    const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(targetUrl)}`;
    try {
        const res = await fetch(cacheUrl, {
            headers: {
                'User-Agent': getRandomUA(),
                'Accept': 'text/html',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
            const html = await res.text();
            const $ = cheerio.load(html);
            $('script, style, svg, nav, footer, iframe, noscript, link, meta').remove();
            const title = $('title').text().trim();
            let markdown = '';
            const seenTexts = new Set<string>();
            $('h1, h2, h3, h4, p, li, td, th, blockquote, figcaption, address').each((_, el) => {
                const text = $(el).text().replace(/\s+/g, ' ').trim();
                if (!text || text.length < 5 || seenTexts.has(text)) return;
                seenTexts.add(text);
                const tagName = (el as any).tagName?.toLowerCase() || '';
                if (tagName === 'h1') markdown += `\n# ${text}\n`;
                else if (tagName === 'h2') markdown += `\n## ${text}\n`;
                else if (tagName === 'h3') markdown += `\n### ${text}\n`;
                else if (tagName === 'li') markdown += `- ${text}\n`;
                else markdown += `${text}\n\n`;
            });
            if (markdown.trim().length >= 200) {
                console.log(`[Scraper:GoogleCache] Got ${markdown.trim().length} chars for ${targetUrl}`);
                return { title, markdown: markdown.trim(), links: [] };
            }
        }
    } catch (e: any) {
        console.log(`[Scraper:GoogleCache] Cache unavailable: ${e.message}`);
    }
    return { title: '', markdown: '', links: [] };
}

// ─── AI-powered content generation for bot-protected sites ──────────────
async function generateContentWithAI(targetUrl: string): Promise<{ title: string; markdown: string }> {
    const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
    if (!GROQ_API_KEY) {
        console.warn('[Scraper:AI] No GROQ_API_KEY set, skipping AI fallback');
        return { title: '', markdown: '' };
    }

    // Parse the URL to extract hints about the business
    const url = new URL(targetUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const domain = url.hostname.replace('www.', '');

    const prompt = `I need detailed information about the business/property at this URL: ${targetUrl}

Based on the URL structure and domain (${domain}), path segments: [${pathParts.join(', ')}], generate comprehensive knowledge about this business.

Please provide ALL available information in a structured markdown format including:
- Official business name and type
- Location/address
- Key facilities and amenities  
- Room types or product offerings (if applicable)
- Dining options
- Contact information
- Check-in/out times or operating hours
- Notable features or awards
- Nearby attractions

Write factual, detailed content as if you are creating a knowledge base entry for a customer service AI agent. Use markdown headings and bullet points. Write at least 800 words. Do NOT make up specific prices or phone numbers if you are not certain.`;

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'You are a knowledgeable travel and business information specialist. Provide accurate, detailed information based on publicly available knowledge. Format your response in clean markdown.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 4000,
            }),
            signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
            console.warn(`[Scraper:AI] Groq API returned ${res.status}`);
            return { title: '', markdown: '' };
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';

        if (content.length > 200) {
            // Extract title from first heading or generate one
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1] : `${pathParts[pathParts.length - 1]?.replace(/-/g, ' ') || domain}`;
            
            console.log(`[Scraper:AI] Generated ${content.length} chars of knowledge for ${targetUrl}`);
            return { title, markdown: content };
        }
    } catch (e: any) {
        console.warn(`[Scraper:AI] AI generation failed: ${e.message}`);
    }

    return { title: '', markdown: '' };
}

// ─── Single Page Scraper (main entry) ───────────────────────────────────
// Strategy: Try Cheerio first (fast). If too little content (<300 chars),
// fallback to Puppeteer → Google Cache → AI generation.
export async function scrapeSinglePage(targetUrl: string): Promise<{ title: string; markdown: string; links: string[] }> {
    try {
        // Step 1: Try Cheerio (fast, lightweight)
        const cheerioResult = await scrapeWithCheerio(targetUrl);

        // Step 2: If Cheerio got enough content, return it
        if (cheerioResult.markdown.length >= 300) {
            return cheerioResult;
        }

        console.log(`[Scraper] Cheerio got only ${cheerioResult.markdown.length} chars for ${targetUrl}, trying Puppeteer...`);

        // Step 3: Fallback to Puppeteer for JS-rendered pages
        try {
            const puppeteerResult = await scrapeWithPuppeteer(targetUrl);

            if (puppeteerResult.markdown.length > cheerioResult.markdown.length && puppeteerResult.markdown.length >= 100) {
                // Merge links from both methods
                const allLinks = [...new Set([...cheerioResult.links, ...puppeteerResult.links])];
                return { ...puppeteerResult, links: allLinks };
            }
        } catch (puppeteerErr: any) {
            console.warn(`[Scraper] Puppeteer fallback failed for ${targetUrl}:`, puppeteerErr.message || puppeteerErr);
        }

        // Step 4: Try Google Cache for bot-protected sites
        console.log(`[Scraper] Both scrapers failed for ${targetUrl}, trying Google Cache...`);
        const cacheResult = await scrapeViaAlternativeSource(targetUrl);
        if (cacheResult.markdown.length >= 200) {
            return cacheResult;
        }

        // Step 5: AI-powered content generation as last resort
        console.log(`[Scraper] All scrapers failed for ${targetUrl}, using AI to generate knowledge...`);
        const aiResult = await generateContentWithAI(targetUrl);
        if (aiResult.markdown.length >= 200) {
            return {
                title: aiResult.title,
                markdown: `${aiResult.markdown}\n\n---\n*⚠️ Content generated by AI based on publicly available information about this URL. Direct scraping was blocked by the website's security system.*`,
                links: [],
            };
        }

        // Step 6: Return whatever we got (even if small)
        return cheerioResult;

    } catch (err) {
        console.warn(`[Scraper] Failed to scrape ${targetUrl}:`, err);
        return { title: '', markdown: '', links: [] };
    }
}

// ─── BFS Deep Crawler ──────────────────────────────────────────────────
const MAX_PAGES = 20;

export async function crawlSite(startUrl: string): Promise<{ siteName: string; fullContent: string; pagesCrawled: number }> {
    const origin = new URL(startUrl);
    const visited = new Set<string>();
    const queue: string[] = [startUrl.replace(/\/+$/, '')];
    const allContent: string[] = [];
    let siteName = '';
    let pagesCrawled = 0;

    const skipPatterns = [
        /\.(jpg|jpeg|png|gif|svg|webp|mp4|mp3|pdf|zip|rar|exe|dmg|ico|css|js|woff|woff2|ttf|eot)$/i,
        /\/(login|logout|register|signup|signin|admin|wp-admin|wp-login|cart|checkout|api)\b/i,
        /[?&](utm_|fbclid|gclid|ref=)/i,
    ];

    while (queue.length > 0 && pagesCrawled < MAX_PAGES) {
        const currentUrl = queue.shift()!;
        const normalizedUrl = currentUrl.replace(/\/+$/, '');

        if (visited.has(normalizedUrl)) continue;
        visited.add(normalizedUrl);

        if (skipPatterns.some(p => p.test(normalizedUrl))) continue;

        console.log(`[Crawler] Scraping page ${pagesCrawled + 1}/${MAX_PAGES}: ${normalizedUrl}`);
        const { title, markdown, links } = await scrapeSinglePage(normalizedUrl);

        if (markdown && markdown.length > 50) {
            pagesCrawled++;

            if (!siteName && title) siteName = title;

            allContent.push(`\n---\n## 📄 Page: ${title || normalizedUrl}\nURL: ${normalizedUrl}\n\n${markdown}`);

            for (const link of links) {
                const normalized = link.replace(/\/+$/, '');
                if (!visited.has(normalized) && !queue.includes(normalized)) {
                    try {
                        const linkUrl = new URL(normalized);
                        if (linkUrl.hostname === origin.hostname) {
                            queue.push(normalized);
                        }
                    } catch { }
                }
            }
        }

        await new Promise(resolve => setTimeout(resolve, 300));
    }

    return {
        siteName: siteName || origin.hostname,
        fullContent: `# 🌐 ${siteName || origin.hostname}\nSource: ${startUrl}\nPages Crawled: ${pagesCrawled}\n\n${allContent.join('\n')}`,
        pagesCrawled
    };
}

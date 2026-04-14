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

// ─── Single Page Scraper ───────────────────────────────────────────────
export async function scrapeSinglePage(targetUrl: string): Promise<{ title: string; markdown: string; links: string[] }> {
    const url = new URL(targetUrl);
    const internalLinks: string[] = [];

    try {
        const res = await fetch(url.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36 AI-Vero/1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en;q=0.5'
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(12000)
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

        // If Cheerio got very little, try Puppeteer
        if (markdown.trim().length < 150) {
            try {
                const puppeteer = require('puppeteer');
                const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
                try {
                    const page = await browser.newPage();
                    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36');
                    await page.goto(url.toString(), { waitUntil: 'networkidle2', timeout: 15000 });

                    const pageTitle = await page.title();
                    const bodyText = await page.evaluate(() => {
                        document.querySelectorAll('script, style, svg, nav, footer, header, aside, form').forEach(el => el.remove());
                        return document.body?.innerText || '';
                    });

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

                    renderedLinks.forEach(l => { if (!internalLinks.includes(l)) internalLinks.push(l); });

                    return {
                        title: pageTitle || title,
                        markdown: bodyText || markdown,
                        links: internalLinks
                    };
                } finally {
                    await browser.close();
                }
            } catch (puppeteerErr) {
                console.warn('Puppeteer fallback failed, using Cheerio result:', puppeteerErr);
            }
        }

        return { title, markdown: markdown.trim(), links: internalLinks };

    } catch (err) {
        console.warn(`Failed to scrape ${targetUrl}:`, err);
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

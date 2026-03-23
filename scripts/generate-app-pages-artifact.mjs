import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const appPort = Number(process.env.APP_ARTIFACT_PORT || '3100');
const baseUrl = `http://127.0.0.1:${appPort}`;
const viewportWidth = 1600;
const baseViewportHeight = 1200;
const maxViewportHeight = 4400;
const timeoutMs = 120_000;
const deckPath = path.join(rootDir, 'output', 'pdf', 'app-pages-screenshot-deck.pdf');
const runStamp = formatTimestamp(new Date());
const screenshotDir = path.join(rootDir, 'output', 'screenshots', 'app-pages', runStamp);
const manifestPath = path.join(screenshotDir, 'manifest.json');
const loginEmail = 'carlos.paucar@intelica.com';
const loginPassword = '123456';
const requiredFeeDashboardIframeCount = 8;

const edgeCandidates = [
    process.env.EDGE_EXECUTABLE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const pageSpecs = [
    {
        route: '/login',
        fileName: '01-login.png',
        title: 'Login',
        caption: 'Sign-in experience with branded hero video and credential form.',
    },
    {
        route: '/dashboards',
        fileName: '02-dashboards.png',
        title: 'Dashboards',
        caption: 'Dashboard landing page with the available report entry points.',
    },
    {
        route: '/fee-dashboard',
        fileName: '03-fee-dashboard.png',
        title: 'Fee Dashboard',
        caption: 'Scheme billing overview with live QuickSight visual embeds and filters.',
    },
    {
        route: '/fee-library',
        fileName: '04-fee-library.png',
        title: 'Fee Library',
        caption: 'Live QuickSight dashboard embed for the scheme fees library.',
    },
    {
        route: '/saving-opportunities',
        fileName: '05-saving-opportunities.png',
        title: 'Saving Opportunities',
        caption: 'Cost-optimization landing page within the authenticated app shell.',
    },
];

function log(message) {
    console.log(`[artifact] ${message}`);
}

function formatTimestamp(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(
        date.getMinutes()
    )}${pad(date.getSeconds())}`;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(timeout = 60_000) {
    const deadline = Date.now() + timeout;
    let lastError = null;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${baseUrl}/login`, {
                redirect: 'manual',
            });

            if (response.status >= 200 && response.status < 400) {
                return;
            }

            lastError = new Error(`Unexpected response status ${response.status}`);
        } catch (error) {
            lastError = error;
        }

        await wait(1000);
    }

    throw new Error(`Timed out waiting for local app server. Last error: ${String(lastError)}`);
}

function findEdgeExecutable() {
    for (const candidate of edgeCandidates) {
        if (candidate && existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(
        'Microsoft Edge executable not found. Set EDGE_EXECUTABLE_PATH or install Edge in the default location.'
    );
}

async function ensureOutputDirs() {
    await mkdir(screenshotDir, { recursive: true });
    await mkdir(path.dirname(deckPath), { recursive: true });
}

async function waitForFonts(page) {
    await page.evaluate(async () => {
        if (document.fonts?.ready) {
            await document.fonts.ready;
        }
    });
}

async function applyCaptureStyles(page) {
    await page.addStyleTag({
        content: `
            *,
            *::before,
            *::after {
                animation-duration: 0s !important;
                animation-delay: 0s !important;
                transition: none !important;
                scroll-behavior: auto !important;
                caret-color: transparent !important;
            }
        `,
    });
}

async function freezeLoginVideo(page) {
    await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        for (const video of videos) {
            try {
                video.pause();
                video.currentTime = 0;
            } catch {}
        }
    });
}

async function sizeViewportToPage(page) {
    const pageHeight = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;

        return Math.ceil(
            Math.max(
                body?.scrollHeight ?? 0,
                body?.offsetHeight ?? 0,
                html?.clientHeight ?? 0,
                html?.scrollHeight ?? 0,
                html?.offsetHeight ?? 0,
                window.innerHeight
            )
        );
    });

    const viewportHeight = Math.min(Math.max(pageHeight + 24, baseViewportHeight), maxViewportHeight);
    await page.setViewportSize({
        width: viewportWidth,
        height: viewportHeight,
    });
    await wait(300);
}

async function captureCurrentPage(page, spec) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await applyCaptureStyles(page);
    await waitForFonts(page);

    if (spec.route === '/login') {
        await freezeLoginVideo(page);
    }

    await sizeViewportToPage(page);

    const screenshotPath = path.join(screenshotDir, spec.fileName);
    await page.screenshot({
        path: screenshotPath,
        type: 'png',
        animations: 'disabled',
        caret: 'hide',
        fullPage: false,
    });

    const fileInfo = await stat(screenshotPath);
    if (fileInfo.size <= 0) {
        throw new Error(`Screenshot ${screenshotPath} is empty.`);
    }

    const viewport = page.viewportSize();
    return {
        ...spec,
        screenshotPath,
        bytes: fileInfo.size,
        viewport,
    };
}

async function navigate(page, route) {
    await page.setViewportSize({ width: viewportWidth, height: baseViewportHeight });
    const response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: 'domcontentloaded',
    });

    if (!response) {
        throw new Error(`No response returned for ${route}.`);
    }

    if (response.status() >= 400) {
        throw new Error(`Navigation to ${route} failed with status ${response.status()}.`);
    }
}

async function waitForLoginPage(page) {
    await page.getByRole('heading', { name: 'Log In' }).waitFor({
        state: 'visible',
        timeout: timeoutMs,
    });
    await page.locator('input[type="email"]').waitFor({
        state: 'visible',
        timeout: timeoutMs,
    });
}

async function waitForDashboardsPage(page) {
    await page.getByRole('heading', { name: 'Dashboards' }).waitFor({
        state: 'visible',
        timeout: timeoutMs,
    });
    await page.locator('aside nav').waitFor({
        state: 'visible',
        timeout: timeoutMs,
    });
}

async function waitForSavingOpportunitiesPage(page) {
    await page.getByRole('heading', { name: 'Saving Opportunities' }).waitFor({
        state: 'visible',
        timeout: timeoutMs,
    });
}

async function waitForFeeDashboardPage(page) {
    await page.getByText('Applied filters:').waitFor({
        state: 'visible',
        timeout: timeoutMs,
    });

    await page.waitForFunction(
        (expectedCount) => {
            const text = document.body?.innerText ?? '';
            const blockingError =
                text.includes('Unable to load QuickSight visuals') || text.includes('Visual unavailable');
            const iframeCount = document.querySelectorAll('iframe[title^="QuickSight visual"]').length;
            return !blockingError && iframeCount >= expectedCount;
        },
        requiredFeeDashboardIframeCount,
        {
            timeout: timeoutMs,
        }
    );

    await wait(5000);
}

async function waitForFeeLibraryPage(page) {
    await page.waitForFunction(
        () => {
            const text = document.body?.innerText ?? '';
            const loading = text.includes('Loading dashboard...');
            const blockingError = text.includes('Unable to load QuickSight dashboard');
            const iframeCount = document.querySelectorAll('iframe[title^="QuickSight Dashboard"]').length;
            return !loading && !blockingError && iframeCount >= 1;
        },
        undefined,
        {
            timeout: timeoutMs,
        }
    );

    await wait(5000);
}

async function performLogin(page) {
    await page.locator('input#email').fill(loginEmail);
    await page.locator('input#password').fill(loginPassword);

    await Promise.all([
        page.waitForURL(/\/dashboards$/, {
            timeout: timeoutMs,
        }),
        page.getByRole('button', { name: 'Sign In' }).click(),
    ]);

    await waitForDashboardsPage(page);
    await wait(1000);
}

function wrapText(text, font, fontSize, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);
        if (candidateWidth <= maxWidth || !current) {
            current = candidate;
            continue;
        }

        lines.push(current);
        current = word;
    }

    if (current) {
        lines.push(current);
    }

    return lines;
}

function drawCoverPage(pdfDoc, titleFont, bodyFont, captures) {
    const page = pdfDoc.addPage([792, 612]);
    const { width, height } = page.getSize();

    page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: rgb(0.95, 0.96, 0.98),
    });

    page.drawRectangle({
        x: 0,
        y: height - 170,
        width,
        height: 170,
        color: rgb(0.16, 0.32, 0.77),
    });

    page.drawText('inControl App Screenshot Deck', {
        x: 42,
        y: height - 88,
        size: 26,
        font: titleFont,
        color: rgb(1, 1, 1),
    });

    page.drawText(`Captured ${new Date().toLocaleString()}`, {
        x: 42,
        y: height - 118,
        size: 12,
        font: bodyFont,
        color: rgb(0.9, 0.93, 1),
    });

    page.drawText('Pages included', {
        x: 42,
        y: height - 230,
        size: 16,
        font: titleFont,
        color: rgb(0.16, 0.24, 0.4),
    });

    let y = height - 262;
    for (const [index, capture] of captures.entries()) {
        page.drawText(`${index + 1}. ${capture.title} (${capture.route})`, {
            x: 48,
            y,
            size: 13,
            font: bodyFont,
            color: rgb(0.24, 0.27, 0.36),
        });
        y -= 24;
    }

    page.drawText('Generated from a local authenticated run with live dashboard embeds.', {
        x: 42,
        y: 58,
        size: 12,
        font: bodyFont,
        color: rgb(0.35, 0.39, 0.51),
    });
}

function drawScreenshotPage(pdfDoc, titleFont, bodyFont, capture, image) {
    const page = pdfDoc.addPage([792, 612]);
    const { width, height } = page.getSize();
    const margin = 32;
    const contentWidth = width - margin * 2;
    const headerTop = height - 38;
    const imageTop = height - 92;
    const imageBottom = 86;
    const imageAreaHeight = imageTop - imageBottom;

    page.drawText(capture.title, {
        x: margin,
        y: headerTop,
        size: 22,
        font: titleFont,
        color: rgb(0.16, 0.24, 0.4),
    });

    page.drawText(capture.route, {
        x: width - margin - bodyFont.widthOfTextAtSize(capture.route, 12),
        y: headerTop + 4,
        size: 12,
        font: bodyFont,
        color: rgb(0.35, 0.39, 0.51),
    });

    page.drawRectangle({
        x: margin,
        y: imageBottom,
        width: contentWidth,
        height: imageAreaHeight,
        borderColor: rgb(0.85, 0.87, 0.92),
        borderWidth: 1,
        color: rgb(0.99, 0.99, 1),
    });

    const scale = Math.min(contentWidth / image.width, imageAreaHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const imageX = margin + (contentWidth - drawWidth) / 2;
    const imageY = imageBottom + (imageAreaHeight - drawHeight) / 2;

    page.drawImage(image, {
        x: imageX,
        y: imageY,
        width: drawWidth,
        height: drawHeight,
    });

    const captionLines = wrapText(capture.caption, bodyFont, 11, contentWidth);
    let captionY = 54;
    for (const line of captionLines) {
        page.drawText(line, {
            x: margin,
            y: captionY,
            size: 11,
            font: bodyFont,
            color: rgb(0.35, 0.39, 0.51),
        });
        captionY -= 14;
    }
}

async function buildPdf(captures) {
    const pdfDoc = await PDFDocument.create();
    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    drawCoverPage(pdfDoc, titleFont, bodyFont, captures);

    for (const capture of captures) {
        const imageBytes = await readFile(capture.screenshotPath);
        const image = await pdfDoc.embedPng(imageBytes);
        drawScreenshotPage(pdfDoc, titleFont, bodyFont, capture, image);
    }

    const pdfBytes = await pdfDoc.save();
    await writeFile(deckPath, pdfBytes);

    const verificationDoc = await PDFDocument.load(pdfBytes);
    const expectedPageCount = captures.length + 1;
    if (verificationDoc.getPageCount() !== expectedPageCount) {
        throw new Error(
            `Generated PDF has ${verificationDoc.getPageCount()} pages; expected ${expectedPageCount}.`
        );
    }
}

async function writeManifest(captures) {
    const payload = {
        generatedAt: new Date().toISOString(),
        baseUrl,
        deckPath,
        captures: captures.map((capture) => ({
            route: capture.route,
            title: capture.title,
            caption: capture.caption,
            screenshotPath: capture.screenshotPath,
            bytes: capture.bytes,
            viewport: capture.viewport,
        })),
    };

    await writeFile(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function captureScreenshots() {
    const executablePath = findEdgeExecutable();
    const browser = await chromium.launch({
        executablePath,
        headless: true,
        args: ['--disable-dev-shm-usage'],
    });

    try {
        const context = await browser.newContext({
            viewport: { width: viewportWidth, height: baseViewportHeight },
            screen: { width: viewportWidth, height: baseViewportHeight },
            colorScheme: 'light',
            deviceScaleFactor: 1,
        });
        context.setDefaultTimeout(timeoutMs);

        const page = await context.newPage();
        const captures = [];

        log('Capturing /login');
        await navigate(page, '/login');
        await waitForLoginPage(page);
        captures.push(await captureCurrentPage(page, pageSpecs[0]));

        log('Signing in with the default artifact account');
        await performLogin(page);

        log('Capturing /dashboards');
        captures.push(await captureCurrentPage(page, pageSpecs[1]));

        log('Capturing /fee-dashboard');
        await navigate(page, '/fee-dashboard');
        await waitForFeeDashboardPage(page);
        captures.push(await captureCurrentPage(page, pageSpecs[2]));

        log('Capturing /fee-library');
        await navigate(page, '/fee-library');
        await waitForFeeLibraryPage(page);
        captures.push(await captureCurrentPage(page, pageSpecs[3]));

        log('Capturing /saving-opportunities');
        await navigate(page, '/saving-opportunities');
        await waitForSavingOpportunitiesPage(page);
        captures.push(await captureCurrentPage(page, pageSpecs[4]));

        await context.close();
        return captures;
    } finally {
        await browser.close();
    }
}

async function main() {
    await ensureOutputDirs();

    log(`Waiting for the local app server on ${baseUrl}`);
    await waitForServer();

    const captures = await captureScreenshots();
    await buildPdf(captures);
    await writeManifest(captures);

    log(`Artifact complete: ${deckPath}`);
    log(`Raw screenshots: ${screenshotDir}`);
}

main().catch((error) => {
    console.error(`[artifact] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    process.exitCode = 1;
});

import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pdfPath = path.join(rootDir, 'output', 'pdf', 'app-pages-screenshot-deck.pdf');
const manifestPath = path.join(rootDir, 'output', 'pdf', 'app-pages-screenshot-deck.manifest.json');
const pageWidth = 1200;
const pageHeight = 900;
const margin = 48;
const brandBlue = rgb(0.16, 0.32, 0.77);
const softBackground = rgb(0.95, 0.96, 0.98);
const bodyText = rgb(0.32, 0.35, 0.45);
const mutedText = rgb(0.42, 0.45, 0.55);
const borderColor = rgb(0.85, 0.87, 0.92);

const pages = [
    {
        title: 'Login',
        route: '/login',
        imagePath: path.join(rootDir, 'output', 'screenshots', 'app-pages', 'login.png'),
        caption: 'Branded sign-in entry point for the inControl platform.',
    },
    {
        title: 'Dashboards',
        route: '/dashboards',
        imagePath: path.join(rootDir, 'output', 'screenshots', 'app-pages', 'dashboards.png'),
        caption: 'Landing page where users choose between the Fee Dashboard and Fee Library experiences.',
    },
    {
        title: 'Fee Dashboard',
        route: '/fee-dashboard',
        imagePath: path.join(rootDir, 'output', 'screenshots', 'app-pages', 'fee-dashboard.png'),
        caption:
            'Embeds QuickSight visuals independently so the app can compose a cleaner, more curated experience with a stronger native look and feel.',
    },
    {
        title: 'Fee Library',
        route: '/fee-library',
        imagePath: path.join(rootDir, 'output', 'screenshots', 'app-pages', 'fee-library.png'),
        caption:
            'Embeds the full QuickSight dashboard, which is better suited to broader dashboard exploration and custom dashboard use cases.',
    },
];

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

    if (current) lines.push(current);
    return lines;
}

function drawParagraph(page, text, font, fontSize, x, startY, maxWidth, color, lineHeight = 18) {
    const lines = wrapText(text, font, fontSize, maxWidth);
    let y = startY;
    for (const line of lines) {
        page.drawText(line, {
            x,
            y,
            size: fontSize,
            font,
            color,
        });
        y -= lineHeight;
    }

    return y;
}

function fitImageDimensions(sourceWidth, sourceHeight, boxWidth, boxHeight) {
    const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
    return {
        width: sourceWidth * scale,
        height: sourceHeight * scale,
    };
}

function drawCoverPage(pdfDoc, titleFont, bodyFont) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: softBackground,
    });

    page.drawRectangle({
        x: 0,
        y: pageHeight - 210,
        width: pageWidth,
        height: 210,
        color: brandBlue,
    });

    page.drawText('inControl App Experience', {
        x: margin,
        y: pageHeight - 102,
        size: 34,
        font: titleFont,
        color: rgb(1, 1, 1),
    });

    page.drawText('Curated PDF built from approved screenshots', {
        x: margin,
        y: pageHeight - 138,
        size: 16,
        font: bodyFont,
        color: rgb(0.9, 0.93, 1),
    });

    page.drawText('QuickSight embedding strategy', {
        x: margin,
        y: pageHeight - 288,
        size: 24,
        font: titleFont,
        color: brandBlue,
    });

    let y = pageHeight - 332;
    y = drawParagraph(
        page,
        'Fee Dashboard embeds QuickSight visuals independently so each section can be composed into a cleaner, more curated in-app experience.',
        bodyFont,
        16,
        margin,
        y,
        pageWidth - margin * 2,
        bodyText,
        24
    );

    y -= 12;
    y = drawParagraph(
        page,
        'Fee Library embeds the full QuickSight dashboard, making it the better fit for broader dashboard workflows and custom dashboard scenarios.',
        bodyFont,
        16,
        margin,
        y,
        pageWidth - margin * 2,
        bodyText,
        24
    );

    page.drawText('Pages included', {
        x: margin,
        y: 220,
        size: 20,
        font: titleFont,
        color: brandBlue,
    });

    let listY = 186;
    for (const [index, entry] of pages.entries()) {
        page.drawText(`${index + 1}. ${entry.title} (${entry.route})`, {
            x: margin + 6,
            y: listY,
            size: 15,
            font: bodyFont,
            color: bodyText,
        });
        listY -= 26;
    }
}

function drawContentPage(pdfDoc, titleFont, bodyFont, entry, image) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const headerY = pageHeight - 58;
    const imageTop = pageHeight - 118;
    const captionY = 84;
    const imageBottom = 160;
    const imageAreaWidth = pageWidth - margin * 2;
    const imageAreaHeight = imageTop - imageBottom;

    page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(1, 1, 1),
    });

    page.drawText(entry.title, {
        x: margin,
        y: headerY,
        size: 28,
        font: titleFont,
        color: brandBlue,
    });

    page.drawText(entry.route, {
        x: pageWidth - margin - bodyFont.widthOfTextAtSize(entry.route, 14),
        y: headerY + 5,
        size: 14,
        font: bodyFont,
        color: mutedText,
    });

    page.drawRectangle({
        x: margin,
        y: imageBottom,
        width: imageAreaWidth,
        height: imageAreaHeight,
        borderColor,
        borderWidth: 1.25,
        color: rgb(0.99, 0.99, 1),
    });

    const fitted = fitImageDimensions(image.width, image.height, imageAreaWidth - 16, imageAreaHeight - 16);
    const imageX = margin + (imageAreaWidth - fitted.width) / 2;
    const imageY = imageBottom + (imageAreaHeight - fitted.height) / 2;

    page.drawImage(image, {
        x: imageX,
        y: imageY,
        width: fitted.width,
        height: fitted.height,
    });

    drawParagraph(
        page,
        entry.caption,
        bodyFont,
        14,
        margin,
        captionY,
        imageAreaWidth,
        bodyText,
        20
    );
}

async function loadImage(pdfDoc, imagePath) {
    const bytes = await readFile(imagePath);
    return pdfDoc.embedPng(bytes);
}

async function ensureAssetsExist() {
    for (const entry of pages) {
        await stat(entry.imagePath);
    }
}

async function writeManifest() {
    const payload = {
        generatedAt: new Date().toISOString(),
        deckPath: pdfPath,
        pageCount: pages.length + 1,
        images: pages.map((entry) => ({
            title: entry.title,
            route: entry.route,
            imagePath: entry.imagePath,
            caption: entry.caption,
        })),
        summary: {
            feeDashboard:
                'Embeds QuickSight visuals independently for a more curated, app-native experience.',
            feeLibrary:
                'Embeds the full QuickSight dashboard for broader exploration and custom dashboard use cases.',
        },
    };

    await writeFile(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
    await ensureAssetsExist();

    const pdfDoc = await PDFDocument.create();
    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    drawCoverPage(pdfDoc, titleFont, bodyFont);

    for (const entry of pages) {
        const image = await loadImage(pdfDoc, entry.imagePath);
        drawContentPage(pdfDoc, titleFont, bodyFont, entry, image);
    }

    const pdfBytes = await pdfDoc.save();
    await writeFile(pdfPath, pdfBytes);
    await writeManifest();

    const verificationDoc = await PDFDocument.load(pdfBytes);
    if (verificationDoc.getPageCount() !== pages.length + 1) {
        throw new Error(`Expected ${pages.length + 1} pages, found ${verificationDoc.getPageCount()}.`);
    }

    const pdfText = String(pdfBytes.length);
    console.log(`[pdf] Rebuilt curated PDF at ${pdfPath}`);
    console.log(`[pdf] Output size: ${pdfText} bytes`);
}

main().catch((error) => {
    console.error(`[pdf] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    process.exitCode = 1;
});

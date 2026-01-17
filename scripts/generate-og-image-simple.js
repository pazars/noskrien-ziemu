import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateOGImage() {
    const width = 1200;
    const height = 630;

    // Read the logo
    const logoPath = path.join(__dirname, '../public/LOGO-NZ-PNG.png');
    const logoBuffer = fs.readFileSync(logoPath);

    // Resize logo to fit nicely (max height 140px)
    const resizedLogo = await sharp(logoBuffer)
        .resize(null, 140, { fit: 'inside' })
        .toBuffer();

    const logoMetadata = await sharp(resizedLogo).metadata();

    // Create the complete SVG with embedded fonts
    const svgImage = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="12" cy="12" r="1.5" fill="#CBD5E1"/>
                </pattern>
            </defs>

            <!-- Background -->
            <rect width="${width}" height="${height}" fill="#F8FAFC"/>
            <rect width="${width}" height="${height}" fill="url(#dots)"/>

            <!-- Text - using system fonts for reliability -->
            <text x="${width / 2}" y="360"
                  text-anchor="middle"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="80"
                  font-weight="bold"
                  fill="#1E293B"
                  letter-spacing="-2">REZULTĀTU</text>

            <text x="${width / 2}" y="470"
                  text-anchor="middle"
                  font-family="Arial, Helvetica, sans-serif"
                  font-size="80"
                  font-weight="bold"
                  fill="#1E293B"
                  letter-spacing="-2">SALĪDZINĀJUMS</text>
        </svg>
    `;

    // Generate base with dot pattern and text
    const base = await sharp(Buffer.from(svgImage))
        .png()
        .toBuffer();

    // Composite logo on top
    const final = await sharp(base)
        .composite([
            {
                input: resizedLogo,
                top: 100,
                left: Math.floor((width - logoMetadata.width) / 2)
            }
        ])
        .png()
        .toFile(path.join(__dirname, '../public/og-image.png'));

    console.log('✅ OG image generated successfully at public/og-image.png');
    console.log(`   Dimensions: ${final.width}x${final.height}px`);
}

generateOGImage().catch(console.error);

/**
 * Generates Terms of Service and Privacy Policy PDF files
 * Uses raw PDF format - no external dependencies needed
 */
const fs = require('fs');
const path = require('path');

function createPDF(title, lines) {
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 50;
    const lineHeight = 18;
    const fontSize = 11;
    const titleSize = 16;

    let y = pageHeight - margin;
    const objects = [];
    let objNum = 1;

    // Helper to add object
    const addObj = (content) => {
        objects.push({ id: objNum++, content });
        return objNum - 1;
    };

    // Build content stream
    let stream = `BT\n/F1 ${titleSize} Tf\n${margin} ${y} Td\n(${title}) Tj\n`;
    y -= lineHeight * 2;
    stream += `/F1 ${fontSize} Tf\n`;

    for (const line of lines) {
        if (y < margin + lineHeight) {
            // Simple single page - truncate if needed
            break;
        }
        const safe = line.replace(/[()\\]/g, (c) => '\\' + c);
        stream += `${margin} ${y} Td\n(${safe}) Tj\n`;
        y -= lineHeight;
        stream += `0 0 Td\n`;
    }
    stream += `ET`;

    const streamBytes = Buffer.from(stream, 'latin1');

    // Catalog
    const catalogId = addObj(`<< /Type /Catalog /Pages 2 0 R >>`);
    // Pages
    const pagesId = addObj(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
    // Page
    const pageId = addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`);
    // Content stream
    const contentId = addObj(`<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`);
    // Font
    const fontId = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);

    // Build PDF
    let pdf = '%PDF-1.4\n';
    const offsets = [];

    for (const obj of objects) {
        offsets.push(pdf.length);
        pdf += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
    }

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
        pdf += String(off).padStart(10, '0') + ' 00000 n \n';
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'latin1');
}

const docsDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir);

// Terms of Service
const termsLines = [
    'Effective Date: February 2026',
    '',
    'KissuBot is a Telegram-based dating platform that helps users meet and connect.',
    '',
    'By using KissuBot, you agree to the following:',
    '',
    '  * You must be 18 years or older',
    '  * You are responsible for your interactions with other users',
    '  * Harassment, scams, impersonation, or illegal activity are prohibited',
    '  * KissuBot may suspend accounts that violate these rules',
    '  * KissuBot does not guarantee matches or relationships',
    '  * The service is provided "as is" without warranty',
    '',
    'Account Termination:',
    '  KissuBot reserves the right to terminate accounts that violate these terms.',
    '',
    'Changes to Terms:',
    '  We may update these terms at any time. Continued use means acceptance.',
    '',
    'For support: spprtksbt@gmail.com',
    'Telegram: @kissuMatch_bot',
];

// Privacy Policy
const privacyLines = [
    'Effective Date: February 2026',
    '',
    'KissuBot collects limited information to operate the service, including:',
    '',
    '  * Telegram ID',
    '  * Username',
    '  * Profile information (name, age, location, bio, photos)',
    '  * Matching activity',
    '',
    'We use this information to:',
    '',
    '  * Provide matching services',
    '  * Improve the platform',
    '  * Maintain safety and security',
    '',
    'Data Sharing:',
    '  We do NOT sell user data to third parties.',
    '  Profile information is shared with other users as part of the matching service.',
    '',
    'Data Retention:',
    '  Users can delete their account at any time.',
    '  Upon deletion, all personal data is removed within 30 days.',
    '',
    'Security:',
    '  We use industry-standard security measures to protect your data.',
    '',
    'For support: spprtksbt@gmail.com',
    'Telegram: @kissuMatch_bot',
];

const termsPDF = createPDF('KISSUBOT TERMS OF SERVICE', termsLines);
const privacyPDF = createPDF('KISSUBOT PRIVACY POLICY', privacyLines);

fs.writeFileSync(path.join(docsDir, 'terms-of-service.pdf'), termsPDF);
fs.writeFileSync(path.join(docsDir, 'privacy-policy.pdf'), privacyPDF);

console.log('✅ PDFs created in docs/ folder');
console.log('  - docs/terms-of-service.pdf');
console.log('  - docs/privacy-policy.pdf');

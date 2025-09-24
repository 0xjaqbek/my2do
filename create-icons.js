// Skrypt do generowania ikon PWA w różnych rozmiarach
// Uruchom: node create-icons.js

const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

// Kolory i styl ikony
const colors = {
    primary: '#2196F3',
    secondary: '#FFFFFF',
    accent: '#FFC107'
};

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function createIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Tło
    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, 0, size, size);

    // Zaokrąglone rogi
    const cornerRadius = size * 0.2;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.moveTo(cornerRadius, 0);
    ctx.lineTo(size - cornerRadius, 0);
    ctx.quadraticCurveTo(size, 0, size, cornerRadius);
    ctx.lineTo(size, size - cornerRadius);
    ctx.quadraticCurveTo(size, size, size - cornerRadius, size);
    ctx.lineTo(cornerRadius, size);
    ctx.quadraticCurveTo(0, size, 0, size - cornerRadius);
    ctx.lineTo(0, cornerRadius);
    ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
    ctx.closePath();
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';

    // Ikona listy zadań
    const iconSize = size * 0.6;
    const iconX = (size - iconSize) / 2;
    const iconY = (size - iconSize) / 2;

    // Lista
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(iconX + iconSize * 0.15, iconY + iconSize * 0.1, iconSize * 0.7, iconSize * 0.8);

    // Linie tekstu
    const lineHeight = iconSize * 0.08;
    const lineWidth = iconSize * 0.5;
    const lineX = iconX + iconSize * 0.25;

    for (let i = 0; i < 6; i++) {
        const lineY = iconY + iconSize * 0.25 + (i * lineHeight * 1.5);

        // Checkbox
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = size * 0.008;
        ctx.strokeRect(lineX - lineHeight, lineY - lineHeight * 0.3, lineHeight * 0.8, lineHeight * 0.8);

        // Checkmark dla pierwszego elementu
        if (i === 0) {
            ctx.strokeStyle = colors.accent;
            ctx.lineWidth = size * 0.012;
            ctx.beginPath();
            ctx.moveTo(lineX - lineHeight * 0.6, lineY);
            ctx.lineTo(lineX - lineHeight * 0.3, lineY + lineHeight * 0.2);
            ctx.lineTo(lineX, lineY - lineHeight * 0.2);
            ctx.stroke();
        }

        // Linia tekstu
        ctx.fillStyle = colors.primary;
        const currentLineWidth = i === 0 ? lineWidth * 0.7 : lineWidth * (0.8 + Math.random() * 0.4);
        ctx.fillRect(lineX + lineHeight * 0.2, lineY - lineHeight * 0.15, currentLineWidth, lineHeight * 0.3);
    }

    return canvas;
}

// Generuj ikony w różnych rozmiarach
sizes.forEach(size => {
    const canvas = createIcon(size);
    const buffer = canvas.toBuffer('image/png');

    fs.writeFileSync(`icons/icon-${size}x${size}.png`, buffer);
    console.log(`Generated icon-${size}x${size}.png`);
});

console.log('All icons generated successfully!');
console.log('Note: This script requires the "canvas" npm package.');
console.log('Install it with: npm install canvas');
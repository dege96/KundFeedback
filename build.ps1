# Skapa mappar
New-Item -ItemType Directory -Force -Path "public"
New-Item -ItemType Directory -Force -Path "api"

# Flytta frontend-filer till public/
Move-Item -Force index.html, script.js, styles.css -Destination public/ -ErrorAction SilentlyContinue

# Flytta server-filer till api/
Move-Item -Force server.js -Destination api/screenshot.js -ErrorAction SilentlyContinue

# Skapa README.md om den inte finns
if (-not(Test-Path -Path "README.md")) {
    @"
# Feedback System

Ett visuellt feedback-system för webbplatser.

## Installation
\`\`\`bash
npm install
\`\`\`

## Användning
1. Starta systemet: \`npm start\`
2. Öppna webbläsaren på: http://localhost:3000
3. Ange URL till webbplatsen du vill ge feedback på
"@ | Out-File -FilePath "README.md" -Encoding UTF8
}

Write-Host "Build klar! Projektstruktur uppdaterad." -ForegroundColor Green 
#!/bin/bash

# My2Do - GitHub Pages Deployment Script
# This script builds and deploys the PWA to GitHub Pages

echo "🚀 Starting My2Do deployment to GitHub Pages..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: This is not a git repository. Please run 'git init' first."
    exit 1
fi

# Check if gh-pages branch exists
if git show-ref --verify --quiet refs/heads/gh-pages; then
    echo "📋 gh-pages branch exists"
else
    echo "📋 Creating gh-pages branch..."
    git checkout --orphan gh-pages
    git rm -rf .
    git commit --allow-empty -m "Initial gh-pages commit"
    git checkout main 2>/dev/null || git checkout master
fi

# Create a temporary directory for build
BUILD_DIR="temp-gh-pages"

echo "📁 Creating build directory..."
mkdir -p $BUILD_DIR

# Copy necessary files to build directory
echo "📋 Copying files..."
cp index.html $BUILD_DIR/
cp styles.css $BUILD_DIR/
cp script.js $BUILD_DIR/
cp manifest.json $BUILD_DIR/
cp sw.js $BUILD_DIR/
if [ -d "icons" ]; then
    cp -r icons/ $BUILD_DIR/
    echo "✅ PWA icons copied successfully"
else
    echo "❌ Error: Icons directory not found!"
    exit 1
fi


# Create a 404.html for SPA routing (if needed)
echo "📄 Creating 404.html for GitHub Pages..."
cat > $BUILD_DIR/404.html << 'EOF'
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My2Do - Przekierowanie</title>
    <script>
        // Redirect to index.html for SPA routing
        window.location.replace('/my2do/');
    </script>
</head>
<body>
    <p>Przekierowywanie do My2Do...</p>
    <p><a href="/my2do/">Kliknij tutaj, jeśli strona nie przekierowuje automatycznie</a></p>
</body>
</html>
EOF

# Update service worker to handle GitHub Pages subdirectory
echo "🔧 Updating service worker for GitHub Pages..."
sed 's|"/|"/my2do/|g' sw.js > $BUILD_DIR/sw.js

# Update manifest.json for GitHub Pages
echo "🔧 Updating manifest for GitHub Pages..."
sed 's|"start_url": "/"|"start_url": "/my2do/"|g' manifest.json > $BUILD_DIR/manifest.json

# Update HTML file to use relative paths for GitHub Pages
echo "🔧 Updating HTML for GitHub Pages..."
sed -e 's|href="/manifest.json"|href="./manifest.json"|g' \
    -e 's|/sw.js|./sw.js|g' \
    index.html > $BUILD_DIR/index.html

# Switch to gh-pages branch
echo "🌿 Switching to gh-pages branch..."
git checkout gh-pages

# Remove old files (keep .git)
echo "🧹 Cleaning old files..."
find . -maxdepth 1 ! -name '.git' ! -name '.' ! -name '..' -exec rm -rf {} + 2>/dev/null

# Move new files
echo "📦 Moving new files..."
mv $BUILD_DIR/* .
mv $BUILD_DIR/.[^.]* . 2>/dev/null || true

# Clean up build directory
rm -rf $BUILD_DIR

# Create CNAME file if custom domain is needed (uncomment and modify if needed)
# echo "yourdomain.com" > CNAME

# Add and commit changes
echo "📝 Committing changes..."
git add .
git commit -m "Deploy My2Do PWA $(date +'%Y-%m-%d %H:%M:%S')"

# Push to GitHub
echo "📤 Pushing to GitHub Pages..."
if git push origin gh-pages; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🎉 Your PWA is now live at:"
    echo "   https://$(git remote get-url origin | sed 's|.*github.com[:/]||' | sed 's|\.git||').github.io/my2do/"
    echo ""
    echo "📱 To install as PWA:"
    echo "   1. Open the link above on your mobile device"
    echo "   2. Add to Home Screen / Install App"
    echo ""
    echo "⚠️  Note: If icons don't appear, generate them first:"
    echo "   1. Open create-simple-icons.html in browser"
    echo "   2. Generate and download icons to icons/ folder"
    echo "   3. Run this script again"
else
    echo "❌ Error: Failed to push to GitHub Pages"
    exit 1
fi

# Switch back to main branch
echo "🌿 Switching back to main branch..."
git checkout main 2>/dev/null || git checkout master

echo "✅ Deployment complete!"
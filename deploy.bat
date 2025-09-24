@echo off
REM My2Do - GitHub Pages Deployment Script for Windows
REM This script builds and deploys the PWA to GitHub Pages

echo 🚀 Starting My2Do deployment to GitHub Pages...

REM Check if we're in a git repository
if not exist ".git" (
    echo ❌ Error: This is not a git repository. Please run 'git init' first.
    exit /b 1
)

REM Check current branch and store it
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i

REM Check if gh-pages branch exists
git show-ref --verify --quiet refs/heads/gh-pages >nul 2>&1
if errorlevel 1 (
    echo 📋 Creating gh-pages branch...
    git checkout --orphan gh-pages
    git rm -rf .
    git commit --allow-empty -m "Initial gh-pages commit"
    git checkout %CURRENT_BRANCH%
) else (
    echo 📋 gh-pages branch exists
)

REM Create a temporary directory for build
set BUILD_DIR=temp-gh-pages

echo 📁 Creating build directory...
if exist %BUILD_DIR% rmdir /s /q %BUILD_DIR%
mkdir %BUILD_DIR%

echo 📋 Copying files...
copy index.html %BUILD_DIR%\ >nul
copy styles.css %BUILD_DIR%\ >nul
copy script.js %BUILD_DIR%\ >nul
copy manifest.json %BUILD_DIR%\ >nul
copy sw.js %BUILD_DIR%\ >nul
copy create-simple-icons.html %BUILD_DIR%\ >nul

REM Copy icons directory if it exists
if exist icons\ (
    xcopy icons\ %BUILD_DIR%\icons\ /E /I /Q >nul
) else (
    echo ⚠️  Icons directory not found - generate icons first!
)

echo 📄 Creating 404.html for GitHub Pages...
(
echo ^<!DOCTYPE html^>
echo ^<html lang="pl"^>
echo ^<head^>
echo     ^<meta charset="UTF-8"^>
echo     ^<meta name="viewport" content="width=device-width, initial-scale=1.0"^>
echo     ^<title^>My2Do - Przekierowanie^</title^>
echo     ^<script^>
echo         // Redirect to index.html for SPA routing
echo         window.location.replace('/my2do/'^);
echo     ^</script^>
echo ^</head^>
echo ^<body^>
echo     ^<p^>Przekierowywanie do My2Do...^</p^>
echo     ^<p^>^<a href="/my2do/"^>Kliknij tutaj, jeśli strona nie przekierowuje automatycznie^</a^>^</p^>
echo ^</body^>
echo ^</html^>
) > %BUILD_DIR%\404.html

echo 🔧 Updating files for GitHub Pages...

REM Update service worker
powershell -Command "(Get-Content sw.js) -replace '\"/', '\"/my2do/' | Set-Content %BUILD_DIR%\sw.js"

REM Update manifest
powershell -Command "(Get-Content manifest.json) -replace '\"start_url\": \"/\"', '\"start_url\": \"/my2do/\"' | Set-Content %BUILD_DIR%\manifest.json"

REM Update HTML file
powershell -Command "(Get-Content index.html) -replace 'href=\"/manifest.json\"', 'href=\"./manifest.json\"' -replace '/sw.js', './sw.js' | Set-Content %BUILD_DIR%\index.html"

echo 🌿 Switching to gh-pages branch...
git checkout gh-pages

echo 🧹 Cleaning old files...
for /f "tokens=*" %%i in ('dir /b /a-h') do (
    if not "%%i"==".git" (
        if exist "%%i\" (
            rmdir /s /q "%%i"
        ) else (
            del /q "%%i"
        )
    )
)

echo 📦 Moving new files...
move %BUILD_DIR%\* . >nul 2>&1

REM Clean up build directory
rmdir /s /q %BUILD_DIR%

echo 📝 Committing changes...
git add .
git commit -m "Deploy My2Do PWA %date% %time%"

echo 📤 Pushing to GitHub Pages...
git push origin gh-pages

if errorlevel 0 (
    echo ✅ Deployment successful!
    echo.
    echo 🎉 Your PWA should be live at:
    for /f "tokens=*" %%i in ('git remote get-url origin') do set REPO_URL=%%i
    set REPO_URL=%REPO_URL:*github.com/=%
    set REPO_URL=%REPO_URL:.git=%
    echo    https://%REPO_URL%.github.io/my2do/
    echo.
    echo 📱 To install as PWA:
    echo    1. Open the link above on your mobile device
    echo    2. Add to Home Screen / Install App
    echo.
    echo ⚠️  Note: If icons don't appear, generate them first:
    echo    1. Open create-simple-icons.html in browser
    echo    2. Generate and download icons to icons/ folder
    echo    3. Run this script again
) else (
    echo ❌ Error: Failed to push to GitHub Pages
    git checkout %CURRENT_BRANCH%
    exit /b 1
)

echo 🌿 Switching back to %CURRENT_BRANCH% branch...
git checkout %CURRENT_BRANCH%

echo ✅ Deployment complete!
pause
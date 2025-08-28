#!/bin/bash

# Kube Tetris Setup Script
echo "🎮 Setting up Kube Tetris..."

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Git is required but not installed. Please install Git first."
    exit 1
fi

# Initialize git repository if not already done
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit: Kube Tetris game"
    echo "✅ Git repository initialized"
fi

# Check if Node.js is available for optional development tools
if command -v node &> /dev/null; then
    echo "📦 Installing development dependencies..."
    npm install
    echo "✅ Development dependencies installed"
    echo ""
    echo "🚀 You can now use the following commands:"
    echo "   npm start    - Start local development server"
    echo "   npm run dev  - Start development server with live reload"
    echo "   npm run deploy - Deploy to GitHub Pages (after setting up repository)"
else
    echo "ℹ️  Node.js not found. Development tools not available."
    echo "   You can still run the game by opening index.html in your browser"
    echo "   or using any static file server (e.g., Python's http.server)"
fi

echo ""
echo "🎯 Setup complete! Here's how to get started:"
echo ""
echo "1. 📂 Open index.html in your browser, or"
echo "2. 🌐 Start a local server:"
echo "   - Python: python3 -m http.server 8000"
echo "   - Node.js: npx serve ."
echo "   - PHP: php -S localhost:8000"
echo ""
echo "3. 🚀 To deploy to GitHub Pages:"
echo "   - Create a GitHub repository"
echo "   - Push this code to the main branch"
echo "   - Enable GitHub Pages in repository settings"
echo "   - Or use the automated GitHub Actions workflow"
echo ""
echo "🎮 Happy gaming and learning Kubernetes! 🚢"

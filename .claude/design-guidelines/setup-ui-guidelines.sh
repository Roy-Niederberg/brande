#!/bin/bash
# Setup script for UI Design Guidelines

set -e

echo "🎨 UI Design Guidelines Setup"
echo "================================"
echo ""

# Check if we're in a git repo or project directory
if [ -d ".git" ] || [ -f "package.json" ] || [ -f "Cargo.toml" ] || [ -f "go.mod" ]; then
    echo "✅ Project directory detected"
else
    echo "⚠️  Warning: This doesn't look like a project directory"
    echo "   Consider running this in your project root"
    read -p "   Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "📥 Copying UI_GUIDELINES.md to project root..."

# Copy the guidelines file
cp UI_GUIDELINES.md ./ 2>/dev/null || {
    echo "❌ Could not find UI_GUIDELINES.md in current directory"
    echo "   Please run this script from the directory containing UI_GUIDELINES.md"
    exit 1
}

echo "✅ UI_GUIDELINES.md copied successfully"
echo ""

# Offer to add to .gitignore exclusion (ensure it's tracked)
if [ -f ".gitignore" ]; then
    if grep -q "UI_GUIDELINES.md" .gitignore; then
        echo "⚠️  UI_GUIDELINES.md is in .gitignore - it won't be tracked"
        read -p "   Remove from .gitignore to track it? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sed -i.bak '/UI_GUIDELINES.md/d' .gitignore
            echo "✅ Removed from .gitignore"
        fi
    fi
fi

# Offer to create a .claude directory for additional context
read -p "📁 Create .claude/ directory for additional project context? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mkdir -p .claude
    echo "# Claude Code Project Context" > .claude/README.md
    echo "" >> .claude/README.md
    echo "This directory contains project-specific context for Claude Code." >> .claude/README.md
    echo "" >> .claude/README.md
    echo "## UI Guidelines" >> .claude/README.md
    echo "See ../UI_GUIDELINES.md for comprehensive UI design standards." >> .claude/README.md
    echo "✅ Created .claude/ directory"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📚 Next steps:"
echo ""
echo "1. Review UI_GUIDELINES.md in your project root"
echo "2. Reference it in Claude Code prompts:"
echo "   claude-code 'Create a landing page following UI_GUIDELINES.md'"
echo ""
echo "3. Customize if needed (e.g., change accent color preference)"
echo ""
echo "4. Optional: Add to your project README:"
echo "   echo '## UI Design' >> README.md"
echo "   echo 'See UI_GUIDELINES.md for design standards' >> README.md"
echo ""
echo "Happy building! 🚀"

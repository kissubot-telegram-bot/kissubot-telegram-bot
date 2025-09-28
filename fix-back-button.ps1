$path = 'c:\Users\HP\OneDrive\Desktop\botmain\kissubot-telegram-bot\bot.js'
$content = [IO.File]::ReadAllText($path)

# Fix the back button emoji
$content = $content.Replace('ðŸ"™', '🔙')

# Fix error message emoji
$content = $content.Replace('âŒ', '❌')

# Save the file with UTF-8 encoding
[IO.File]::WriteAllText($path, $content, [Text.Encoding]::UTF8)

Write-Host "Fixed back button and error message emojis in bot.js"
Write-Host "✅ 🔙→ 🔙 (Back button)"
Write-Host "✅ âŒ → ❌ (Error messages)"

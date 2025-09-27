$path = 'c:\Users\HP\OneDrive\Desktop\botmain\kissubot-telegram-bot\bot.js'
$content = Get-Content -Path $path -Raw -Encoding UTF8

# Fix the back button emoji
$content = $content -replace 'ðŸ"™', '🔙'

# Fix error message emoji  
$content = $content -replace 'âŒ', '❌'

# Save the file
Set-Content -Path $path -Value $content -Encoding UTF8

Write-Host "Fixed back button and error message emojis"

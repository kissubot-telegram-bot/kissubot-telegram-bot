$path = 'c:\Users\HP\OneDrive\Desktop\botmain\kissubot-telegram-bot\bot.js'
$content = Get-Content -Path $path -Raw -Encoding UTF8

# Remove Git merge conflict markers
$content = $content -replace '<<<<<<< HEAD\r?\n', ''
$content = $content -replace '=======\r?\n', ''
$content = $content -replace '>>>>>>> [^\r\n]*\r?\n', ''

# Save the cleaned file
Set-Content -Path $path -Value $content -Encoding UTF8

Write-Host "Removed Git merge conflict markers from bot.js"
Write-Host "File should now be syntax error free"

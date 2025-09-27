$path = 'c:\Users\HP\OneDrive\Desktop\botmain\kissubot-telegram-bot\bot.js'
$content = [IO.File]::ReadAllText($path)
# Replace known mojibake sequences with intended emoji
$content = $content.Replace('âœ…','✅')
$content = $content.Replace('âŒ','❌')
$content = $content.Replace('ðŸ”™','🔙')
[IO.File]::WriteAllText($path, $content, [Text.Encoding]::UTF8)
Write-Host 'Mojibake fixed and file saved as UTF-8.'

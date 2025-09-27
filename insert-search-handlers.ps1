$path = 'c:\Users\HP\OneDrive\Desktop\botmain\kissubot-telegram-bot\bot.js'
$content = [IO.File]::ReadAllText($path)
$anchor = "case 'premium_filters':"
$insert = @'
      // Apply age range selections
      case 'age_range_18_25':
      case 'age_range_26_35':
      case 'age_range_36_45':
      case 'age_range_46_55':
      case 'age_range_18_35':
      case 'age_range_25_45': {
        try {
          let ageMin = 18, ageMax = 35;
          switch (data) {
            case 'age_range_18_25': ageMin = 18; ageMax = 25; break;
            case 'age_range_26_35': ageMin = 26; ageMax = 35; break;
            case 'age_range_36_45': ageMin = 36; ageMax = 45; break;
            case 'age_range_46_55': ageMin = 46; ageMax = 55; break;
            case 'age_range_18_35': ageMin = 18; ageMax = 35; break;
            case 'age_range_25_45': ageMin = 25; ageMax = 45; break;
          }
          await axios.post(`${API_BASE}/search-settings/${telegramId}`, { ageMin, ageMax });
          await bot.sendMessage(chatId, `✅ Age range updated to ${ageMin}-${ageMax} years!`, {
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Search', callback_data: 'back_to_search' }]] },
            parse_mode: 'Markdown'
          });
        } catch (err) {
          console.error('Set age range error:', err.response?.data || err.message);
          bot.sendMessage(chatId, '❌ Failed to update age range. Please try again.');
        }
        break;
      }

      // Apply distance selections
      case 'distance_10':
      case 'distance_25':
      case 'distance_50':
      case 'distance_100':
      case 'distance_250':
      case 'distance_unlimited': {
        try {
          let maxDistance;
          switch (data) {
            case 'distance_10': maxDistance = 10; break;
            case 'distance_25': maxDistance = 25; break;
            case 'distance_50': maxDistance = 50; break;
            case 'distance_100': maxDistance = 100; break;
            case 'distance_250': maxDistance = 250; break;
            case 'distance_unlimited': maxDistance = 100000; break;
          }
          await axios.post(`${API_BASE}/search-settings/${telegramId}`, { maxDistance });
          const label = data === 'distance_unlimited' ? 'Unlimited' : `${maxDistance} km`;
          await bot.sendMessage(chatId, `✅ Max distance updated to ${label}!`, {
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Search', callback_data: 'back_to_search' }]] },
            parse_mode: 'Markdown'
          });
        } catch (err) {
          console.error('Set distance error:', err.response?.data || err.message);
          bot.sendMessage(chatId, '❌ Failed to update distance. Please try again.');
        }
        break;
      }

      // Apply gender preference selections
      case 'gender_male':
      case 'gender_female':
      case 'gender_any': {
        try {
          let genderPreference;
          if (data === 'gender_male') genderPreference = 'Male';
          else if (data === 'gender_female') genderPreference = 'Female';
          else genderPreference = 'Any';
          await axios.post(`${API_BASE}/search-settings/${telegramId}`, { genderPreference });
          await bot.sendMessage(chatId, `✅ Gender preference set to ${genderPreference}!`, {
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Search', callback_data: 'back_to_search' }]] },
            parse_mode: 'Markdown'
          });
        } catch (err) {
          console.error('Set gender preference error:', err.response?.data || err.message);
          bot.sendMessage(chatId, '❌ Failed to update gender preference. Please try again.');
        }
        break;
      }
'@

if ($content -notlike "*$anchor*") {
  Write-Error "Anchor not found: $anchor"; exit 1
}

$regex = [regex]::Escape($anchor)
$new = [regex]::Replace($content, $regex, $insert + $anchor, 1)
[IO.File]::WriteAllText($path, $new, [Text.Encoding]::UTF8)
Write-Host 'Inserted selection handlers before premium_filters.'

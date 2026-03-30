require('dotenv').config();
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema);

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // Find accounts that look like test/dummy accounts
  const candidates = await User.find({
    $or: [
      { name: { $regex: /^test/i } },
      { bio: { $regex: /^test/i } },
      { location: { $regex: /test.?city|test.?loc/i } }
    ]
  }).select('telegramId name age gender location bio photos isTestAccount');

  console.log(`Found ${candidates.length} candidate test account(s):\n`);
  candidates.forEach(u => {
    const marked = u.isTestAccount ? '[already marked]' : '';
    console.log(`  ${marked} ${u.name || '(no name)'}, age ${u.age || '?'}, ${u.gender || '?'} | "${u.location || ''}" | Photos: ${(u.photos || []).length} | TG: ${u.telegramId}`);
  });

  if (candidates.length === 0) {
    console.log('No test accounts found.');
    await mongoose.disconnect();
    return;
  }

  if (!confirm) {
    console.log('\n⚠️  DRY RUN — nothing changed.');
    console.log('Run with --confirm to mark these accounts as isTestAccount: true');
    console.log('  node cleanup-test-accounts.js --confirm');
    await mongoose.disconnect();
    return;
  }

  const ids = candidates.map(u => u._id);
  const result = await User.updateMany({ _id: { $in: ids } }, { $set: { isTestAccount: true } });
  console.log(`\n✅ Marked ${result.modifiedCount} account(s) as isTestAccount: true`);
  console.log('These profiles are now hidden from normal users. Use /devmode in the bot to see them.');

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });

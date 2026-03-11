const mongoose = require('mongoose');
const { User } = require('./server');
const { setupSettingsCommands } = require('./commands/settings');

// Mock bot
const callbacks = {
    texts: {},
    queries: []
};

const bot = {
    onText: (regex, cb) => {
        callbacks.texts[regex] = cb;
    },
    on: (event, cb) => {
        if (event === 'callback_query') callbacks.queries.push(cb);
    },
    sendMessage: async (chatId, text, options) => {
        console.log(`\n[BOT->USER] Chat: ${chatId}\nText: ${text}\nOptions:`, JSON.stringify(options, null, 2));
    }
};

async function runTest() {
    try {
        // 1. Connect to DB
        await mongoose.connect('mongodb://localhost:27017/kisu1bot', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');

        // 2. Clear and create a test user
        await User.deleteMany({ telegramId: '9999999' });
        const user = new User({
            telegramId: '9999999',
            username: 'testuser',
            name: 'Test',
            gender: 'Male',
            searchSettings: {
                ageMin: 18,
                ageMax: 35,
                maxDistance: 50,
                genderPreference: 'Any'
            }
        });
        await user.save();
        console.log('✅ Test user created');

        // 3. Setup settings commands
        setupSettingsCommands(bot);

        // 4. Simulate `/searchsettings`
        console.log('\n--- SIMULATING /searchsettings ---');
        const searchRegex = Object.keys(callbacks.texts).find(r => r.includes('searchsettings'));
        const searchHandler = callbacks.texts[searchRegex];

        await searchHandler({
            chat: { id: 11111 },
            from: { id: 9999999 }
        });

        // 5. Simulate clicking "18-25" Age Range Button
        console.log('\n--- SIMULATING click "age_range_18_25" ---');
        const queryHandler = callbacks.queries[0]; // The big switch statement in settings.js
        await queryHandler({
            message: { chat: { id: 11111 } },
            from: { id: 9999999 },
            data: 'age_range_18_25'
        });

        // 6. Verify DB updated
        const updatedUser = await User.findOne({ telegramId: '9999999' });
        console.log('\n--- DATABASE VERIFICATION ---');
        console.log('Age Min:', updatedUser.searchSettings.ageMin, '(Expected 18)');
        console.log('Age Max:', updatedUser.searchSettings.ageMax, '(Expected 25)');

        if (updatedUser.searchSettings.ageMax === 25) {
            console.log('✅ TEST PASSED: Database updated successfully!');
        } else {
            console.log('❌ TEST FAILED: Database did not update correctly.');
        }

    } catch (err) {
        console.error('Test error:', err);
    } finally {
        mongoose.disconnect();
        process.exit(0);
    }
}

runTest();

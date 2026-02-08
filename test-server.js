// Test script to debug server startup
try {
    console.log('Loading server.js...');
    require('./server.js');
    console.log('Server loaded successfully!');
} catch (err) {
    console.error('ERROR loading server:');
    console.error(err.stack);
}

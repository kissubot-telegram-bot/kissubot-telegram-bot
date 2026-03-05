// Profile completion checker and auto-updater
// Required: name, age, location, 1+ photo, phone number
// Optional (not required): bio
function checkAndUpdateProfileCompletion(user) {
    const isComplete = !!(
        user.termsAccepted &&
        user.name &&
        user.age &&
        user.location &&
        user.phone &&
        user.photos &&
        user.photos.length > 0
    );

    if (isComplete && !user.profileCompleted) {
        user.profileCompleted = true;
        user.onboardingStep = 'completed';
        return true; // Profile just became complete
    } else if (!isComplete && user.profileCompleted) {
        user.profileCompleted = false;
        return false;
    }

    return user.profileCompleted;
}

module.exports = { checkAndUpdateProfileCompletion };

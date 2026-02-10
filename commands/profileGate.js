// Profile completion checker and auto-updater
function checkAndUpdateProfileCompletion(user) {
    const isComplete = (
        user.termsAccepted &&
        user.name &&
        user.age &&
        user.location &&
        user.bio &&
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

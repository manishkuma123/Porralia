const cron = require("node-cron");
const User = require("./User");

cron.schedule("0 0 * * *", async () => {
    try {
        const today = new Date();
        const todayDate = today.getDate();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const users = await User.find();

        for (let user of users) {
            const joinDate = user.joinedAt.getDate();
            const lastReward = user.lastRewardAt;

            const alreadyRewarded =
                lastReward.getMonth() === currentMonth &&
                lastReward.getFullYear() === currentYear;

            if (joinDate === todayDate && !alreadyRewarded) {
                user.totalPoints += 100; 
                user.lastRewardAt = today;
                await user.save();
            }
        }

        console.log("Monthly points added successfully");
    } catch (err) {
        console.error("Cron job error:", err);
    }
});

const Notification = require('../models/Notification');

class NotificationService {
  static async notify({
    userId,
    type,
    title,
    message,
    relatedEntityType = 'ExpenseClaim',
    relatedEntityId = null,
    session = null,
  }) {
    try {
      const notification = new Notification({
        userId,
        type,
        title,
        message,
        relatedEntityType,
        relatedEntityId,
      });

      if (session) {
        await notification.save({ session });
      } else {
        await notification.save();
      }

      return notification;
    } catch (error) {
      console.error('Failed to create notification:', error.message);
      return null;
    }
  }

  static async getUserNotifications(userId, { unreadOnly = false, limit = 50, skip = 0 } = {}) {
    const filter = { userId };
    if (unreadOnly) {
      filter.readAt = null;
    }

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, readAt: null }),
    ]);

    return { items, total, unreadCount };
  }

  static async markAsRead(notificationId, userId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { readAt: new Date() },
      { new: true }
    );
  }

  static async markAllAsRead(userId) {
    return Notification.updateMany(
      { userId, readAt: null },
      { readAt: new Date() }
    );
  }
}

module.exports = NotificationService;

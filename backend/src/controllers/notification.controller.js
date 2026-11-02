const NotificationService = require('../services/notification.service');

exports.getNotifications = async (req, res, next) => {
  try {
    const { unreadOnly, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const result = await NotificationService.getUserNotifications(req.user._id, {
      unreadOnly: unreadOnly === 'true',
      limit: Number(limit),
      skip,
    });

    res.status(200).json({
      success: true,
      data: result.items,
      unreadCount: result.unreadCount,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await NotificationService.markAsRead(req.params.id, req.user._id);
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await NotificationService.markAllAsRead(req.user._id);
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

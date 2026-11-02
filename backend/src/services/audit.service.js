const AuditLog = require('../models/AuditLog');

class AuditService {
  /**
   * Safe serialization: remove sensitive fields from before/after payloads
   */
  static sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;

    const copy = JSON.parse(JSON.stringify(payload));
    const sensitiveKeys = ['password', 'passwordHash', 'token', 'storageKey'];

    const traverse = (obj) => {
      for (const key of Object.keys(obj)) {
        if (sensitiveKeys.includes(key)) {
          delete obj[key];
        } else if (obj[key] && typeof obj[key] === 'object') {
          traverse(obj[key]);
        }
      }
    };

    traverse(copy);
    return copy;
  }

  /**
   * Record an immutable audit log entry
   */
  static async log({
    actorId = null,
    action,
    entityType,
    entityId,
    before = null,
    after = null,
    reason = '',
    correlationId = null,
    session = null,
  }) {
    try {
      const sanitizedBefore = this.sanitizePayload(before);
      const sanitizedAfter = this.sanitizePayload(after);

      const logEntry = new AuditLog({
        actorId,
        action,
        entityType,
        entityId,
        before: sanitizedBefore,
        after: sanitizedAfter,
        reason,
        correlationId,
      });

      if (session) {
        await logEntry.save({ session });
      } else {
        await logEntry.save();
      }

      return logEntry;
    } catch (error) {
      // Never crash the primary transaction because of audit log failure, but log it
      console.error('AuditLog writing failed:', error.message);
      return null;
    }
  }

  static async getEntityTimeline(entityType, entityId) {
    return AuditLog.find({ entityType, entityId })
      .populate('actorId', 'name email role')
      .sort({ createdAt: 1 });
  }
}

module.exports = AuditService;

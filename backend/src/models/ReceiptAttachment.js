const mongoose = require('mongoose');

const receiptAttachmentSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseClaim',
      default: null,
      index: true,
    },
    storageKey: {
      type: String,
      required: [true, 'Storage key is required'],
      select: false, // Hide exact filesystem path/key from ordinary client APIs
    },
    originalFilename: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true,
    },
    contentType: {
      type: String,
      required: [true, 'Content type is required'],
      enum: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
    },
    size: {
      type: Number,
      required: [true, 'File size is required'],
      max: [5242880, 'Receipt file cannot exceed 5MB'],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

receiptAttachmentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.storageKey; // Never leak storage key
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('ReceiptAttachment', receiptAttachmentSchema);

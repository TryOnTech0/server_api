const mongoose = require('mongoose');

const blacklistTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // Auto-delete document after expiresAt
  }
}, { timestamps: true });

// Add index for token
blacklistTokenSchema.index({ token: 1 }, { unique: true });

// Static method to check if token is blacklisted
blacklistTokenSchema.statics.isTokenBlacklisted = async function(token) {
  const blacklistedToken = await this.findOne({ token });
  return !!blacklistedToken;
};

// Static method to blacklist a token
blacklistTokenSchema.statics.blacklistToken = async function(token, expiresIn) {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  await this.create({ token, expiresAt });
};

module.exports = mongoose.model('BlacklistToken', blacklistTokenSchema);

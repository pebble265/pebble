/**
 * State shared by the Forget Password screens. Kept in memory only (not in the
 * URL), so the reset token never shows up in navigation history.
 */
export const resetFlow = {
  email: '',
  resetToken: '',
  /** when the server allows sending another code (ms timestamp) */
  resendAt: 0,
  clear() {
    this.email = '';
    this.resetToken = '';
    this.resendAt = 0;
  },
};

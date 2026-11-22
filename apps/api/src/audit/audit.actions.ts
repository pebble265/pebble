/** Route -> audit action (short code) + what it touched. Labels for people live in the admin site. */
export const ACTIONS: Record<string, { action: string; target?: string }> = {
  // account
  'POST /auth/register': { action: 'register', target: 'user' },
  'POST /auth/login': { action: 'login', target: 'user' },
  'POST /auth/google': { action: 'login_google', target: 'user' },
  'POST /auth/apple': { action: 'login_apple', target: 'user' },
  'POST /auth/logout': { action: 'logout', target: 'user' },
  'POST /auth/password/forgot': { action: 'password_forgot', target: 'user' },
  'POST /auth/password/verify': { action: 'password_verify_code', target: 'user' },
  'POST /auth/password/reset': { action: 'password_reset', target: 'user' },
  'PATCH /users/me': { action: 'profile_update', target: 'user' },
  'POST /users/me/avatar': { action: 'avatar_update', target: 'user' },
  'DELETE /users/me/avatar': { action: 'avatar_delete', target: 'user' },
  'POST /users/me/onboarding': { action: 'onboarding', target: 'user' },
  'POST /users/me/robot-setup': { action: 'robot_setup', target: 'user' },
  'POST /users/me/password': { action: 'password_change', target: 'user' },
  'POST /users/me/terms/email': { action: 'terms_email', target: 'user' },
  // medicine
  'POST /medications': { action: 'medication_add', target: 'medication' },
  'PATCH /medications/:id': { action: 'medication_update', target: 'medication' },
  'DELETE /medications/:id': { action: 'medication_delete', target: 'medication' },
  'POST /doses/:id/take': { action: 'dose_take', target: 'dose' },
  'POST /doses/:id/skip': { action: 'dose_skip', target: 'dose' },
  'POST /robot/doses/:id/take': { action: 'dose_take_robot', target: 'dose' },
  'POST /robot/doses/:id/dispensed': { action: 'dose_dispensed', target: 'dose' },
  // mood / medical
  'POST /moods': { action: 'mood_checkin', target: 'mood' },
  'PATCH /moods/:id': { action: 'mood_note_update', target: 'mood' },
  'POST /robot/moods': { action: 'mood_checkin_robot', target: 'mood' },
  'PATCH /medical': { action: 'medical_update', target: 'medical' },
  'POST /medical/contacts': { action: 'emergency_contact_add', target: 'contact' },
  'PATCH /medical/contacts/:id': { action: 'emergency_contact_update', target: 'contact' },
  'DELETE /medical/contacts/:id': { action: 'emergency_contact_delete', target: 'contact' },
  // chat
  'POST /chat/conversations/:id/end': { action: 'chat_end', target: 'conversation' },
  'DELETE /chat/conversations': { action: 'chat_delete_all', target: 'conversation' },
  'DELETE /chat/conversations/:id': { action: 'chat_delete', target: 'conversation' },
  'DELETE /chat/memories/:id': { action: 'memory_delete', target: 'memory' },
  'POST /robot/chat/conversations/:id/end': { action: 'chat_end_robot', target: 'conversation' },
  // caretakers / privacy
  'POST /caretakers/invites': { action: 'caretaker_invite', target: 'caretaker' },
  'PATCH /caretakers/:id/permissions': { action: 'caretaker_permissions', target: 'caretaker' },
  'DELETE /caretakers/:id': { action: 'caretaker_remove', target: 'caretaker' },
  'POST /caretaking/invites/preview': { action: 'caretaker_invite_preview', target: 'caretaker' },
  'POST /caretaking/invites/accept': { action: 'caretaker_invite_accept', target: 'caretaker' },
  'POST /caretaking/invites/decline': { action: 'caretaker_invite_decline', target: 'caretaker' },
  'DELETE /caretaking/:linkId': { action: 'caretaking_leave', target: 'caretaker' },
  'POST /privacy/consents/:type/grant': { action: 'consent_grant', target: 'consent' },
  'POST /privacy/consents/:type/revoke': { action: 'consent_revoke', target: 'consent' },
  'DELETE /privacy/account': { action: 'account_delete', target: 'user' },
  // robot
  'POST /devices/pair': { action: 'robot_pair', target: 'device' },
  'POST /devices/:id/command': { action: 'robot_command', target: 'device' },
  'DELETE /devices/:id': { action: 'robot_unpair', target: 'device' },
  'PATCH /robot-settings': { action: 'robot_settings', target: 'device' },
  // alerts / push
  'POST /alerts/:id/resolve': { action: 'alert_resolve', target: 'alert' },
  'POST /caretaking-alerts/:deliveryId/ack': { action: 'alert_ack', target: 'alert' },
  'POST /push-tokens': { action: 'push_register', target: 'device' },
  'DELETE /push-tokens': { action: 'push_unregister', target: 'device' },
};

/** Too frequent or not an action by a person. */
export const SKIP = new Set([
  'POST /robot/heartbeat',
  'POST /robot/auth',
  'POST /robot/pairing-code',
  'POST /auth/refresh',
  'POST /chat/messages', // one row per chat message would drown everything else
  'POST /robot/chat/messages',
  'POST /admin/audit',
]);

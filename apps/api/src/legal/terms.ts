/**
 * pebble(a) Terms and Conditions shown in the app before an account is used.
 *
 * DRAFT written for the project. Have it reviewed (Thai law / PDPA) before a
 * public release. When the meaning changes, bump TERMS_VERSION and
 * POLICY_VERSION in users.service.ts so people are asked to agree again.
 */
export const TERMS_VERSION = '2026-11';
export const TERMS_UPDATED = '17 November 2026';
/** Fill in before release. */
export const SUPPORT_CONTACT = '[support email]';

export interface TermsSection {
  heading: string;
  body: string;
}

export const TERMS: { title: string; important: string; updated: string; sections: TermsSection[] } = {
  title: 'pebble(a) Terms and Conditions',
  important:
    'IMPORTANT\nPlease read the Terms and Conditions carefully before using pebble(a).',
  updated: TERMS_UPDATED,
  sections: [
    {
      heading: '1. Acceptance of Terms',
      body:
        'Welcome to pebble(a), an AI-powered care companion application designed to support daily well-being, medication reminders, and communication with a companion robot.\n' +
        'By accessing or using the pebble(a) application and its connected services, you agree to these Terms and Conditions. If you do not agree with these terms, please discontinue use of the application.',
    },
    {
      heading: '2. Description of Services',
      body:
        'pebble(a) provides features that may include:\n' +
        '• AI-powered text and voice conversations.\n' +
        '• Medication schedules and medication reminders.\n' +
        '• Medication confirmation and reminder history.\n' +
        '• Mood check-ins and a daily summary.\n' +
        '• Step count and heart rate read from Apple Health or Health Connect, only if you allow it.\n' +
        '• Connecting to and controlling a pebble(a) companion robot.\n' +
        '• Optional Caretakers: people you invite to receive alerts you choose to share.',
    },
    {
      heading: '3. Not a Medical or Emergency Service',
      body:
        'pebble(a) is a companion, not a doctor. It does not diagnose, treat, or prevent any illness, and it does not replace advice from a doctor, pharmacist, or mental health professional.\n' +
        'pebble(a) is not an emergency service. If you or someone else is in danger, call 1669 (emergency medical services) or the Mental Health Hotline 1323 right away.\n' +
        'pebble(a) may suggest help when a conversation sounds like a crisis, but it may not always notice, so never rely on it in an emergency.',
    },
    {
      heading: '4. Your Account',
      body:
        'You must be at least 18 years old, or have permission from a parent or guardian, to use pebble(a).\n' +
        'Please give accurate information and keep your password private. You are responsible for activity on your account. Tell us if you think someone else is using it.',
    },
    {
      heading: '5. Medication Reminders',
      body:
        'Always follow the instructions from your doctor or pharmacist. Check every medicine name, dose, and time you enter.\n' +
        'Reminders and the robot dispenser can fail, for example when your phone is off, there is no internet, notifications are disabled, or the robot has no battery. You remain responsible for taking your medicine correctly.',
    },
    {
      heading: '6. AI Conversations',
      body:
        'Replies from Pebbi are written by artificial intelligence and may be wrong, incomplete, or unsuitable. Do not treat them as professional advice.\n' +
        'To create a reply, your message is sent to our AI provider for processing. pebble(a) keeps short, encrypted summaries of conversations so Pebbi can remember context; full conversations are not kept. You can turn conversation memory off in the app.',
    },
    {
      heading: '7. Your Data and Privacy',
      body:
        'We follow Thailand\'s Personal Data Protection Act (PDPA). We collect only what the service needs: your account details, the profile you enter, medication schedules and records, mood check-ins, conversation summaries, and robot information.\n' +
        'Medicine names and conversation summaries are encrypted before they are stored. We do not sell your data and do not use your health information for advertising.\n' +
        'You can download your data or delete your account at any time in the app. Caretakers only see the information you decide to share with them.',
    },
    {
      heading: '8. Apple Health and Health Connect',
      body:
        'If you allow it, pebble(a) reads your step count and heart rate to show them in your daily summary. This data stays on your phone and is not sent to our servers, shared, or used for advertising. You can turn access off at any time in the Health app or Health Connect settings.',
    },
    {
      heading: '9. The pebble(a) Robot',
      body:
        'The robot connects to your phone over Bluetooth and to our servers over the internet. Keep it charged, dry, and out of reach of small children and pets. Check that the right medicine was dispensed before taking it.',
    },
    {
      heading: '10. Acceptable Use',
      body:
        'Do not misuse pebble(a): do not try to break into the service, interfere with other users, use it for anything illegal, or attempt to make the AI produce harmful content.',
    },
    {
      heading: '11. Changes',
      body:
        'We may update pebble(a) and these terms. When the changes are important, we will ask you to read and agree again in the app.',
    },
    {
      heading: '12. Limitation of Liability',
      body:
        'To the extent allowed by law, pebble(a) is provided "as is". We are not liable for indirect losses or for harm caused by relying on the app or the robot instead of professional care.',
    },
    {
      heading: '13. Governing Law and Contact',
      body:
        `These terms are governed by the laws of Thailand. Questions about these terms or your data: ${SUPPORT_CONTACT}.`,
    },
  ],
};

/** Plain-text version for email. */
export function termsAsText() {
  return [
    TERMS.title,
    `Last Updated: ${TERMS.updated}`,
    '',
    TERMS.important,
    '',
    ...TERMS.sections.flatMap((s) => [s.heading, s.body, '']),
  ].join('\n');
}

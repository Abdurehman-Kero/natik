/** The only SMS messages the platform sends (SRS FR-NOTIF-003). Each fits one 160-character SMS. */
export const SMS_TEMPLATES = {
  'otp.verify': (p: { code: string }) => `Natik: your code is ${p.code}. It expires in 10 minutes.`,
  'otp.reset': (p: { code: string }) =>
    `Natik: your password reset code is ${p.code}. It expires in 10 minutes.`,
  'account.created': (p: { link: string }) =>
    `Natik: an account was created for you. Set your password: ${p.link}`,
  'password.link': (p: { link: string }) => `Natik: set a new password here: ${p.link}`,
  'payment.confirmed': (p: { course: string }) =>
    `Natik: payment confirmed. "${p.course}" is now open. Happy learning!`,
  'payment.rejected': (p: { course: string; reason: string }) =>
    `Natik: we couldn't confirm your payment for "${p.course}". Reason: ${p.reason}`,
  'enrolment.approved': (p: { course: string }) =>
    `Natik: you're accepted into "${p.course}". Sign in to start learning.`,
  'enrolment.declined': (p: { course: string }) =>
    `Natik: your request to join "${p.course}" was not accepted. See the reason in My courses.`,
  'certificate.ready': (p: { course: string; number: string }) =>
    `Natik: your certificate for "${p.course}" is ready (${p.number}). Download it in My certificates.`,
  'certificate.returned': (p: { course: string }) =>
    `Natik: please check the name for your "${p.course}" certificate. See the note in My certificates.`,
  'access.expiring': (p: { course: string; date: string }) =>
    `Natik: your access to "${p.course}" ends on ${p.date}. Contact us to renew.`,
} as const;

export type SmsTemplate = keyof typeof SMS_TEMPLATES;
export type SmsParams<T extends SmsTemplate> = Parameters<(typeof SMS_TEMPLATES)[T]>[0];

export function renderSms<T extends SmsTemplate>(template: T, params: SmsParams<T>): string {
  return (SMS_TEMPLATES[template] as (p: SmsParams<T>) => string)(params);
}

import type { ComponentType, SVGProps } from 'react';
import {
  FaFacebookF,
  FaInstagram,
  FaTelegram,
  FaTiktok,
  FaWhatsapp,
  FaYoutube,
} from 'react-icons/fa6';
import { Link as LinkIcon } from 'lucide-react';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const ICONS: Record<string, Icon> = {
  Telegram: FaTelegram,
  'Telegram channel': FaTelegram,
  'Telegram chat': FaTelegram,
  WhatsApp: FaWhatsapp,
  Facebook: FaFacebookF,
  Instagram: FaInstagram,
  TikTok: FaTiktok,
  YouTube: FaYoutube,
};

/** Brand icon for a social link, looked up by its name. Decorative: the link carries the label. */
export function SocialIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? LinkIcon;
  return <Icon className={className} aria-hidden focusable="false" />;
}

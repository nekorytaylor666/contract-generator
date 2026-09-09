// Соцсети в футерах публичных страниц (лендинг, /about, /library, /plans).
// Единый источник адресов — меняйте здесь, а не в каждом футере.
export const SOCIAL_LINKS = [
  {
    label: "Telegram",
    icon: "/landing/social-telegram.svg",
    href: "https://t.me/zhebe_smart_contracts",
  },
  {
    label: "TikTok",
    icon: "/landing/social-tiktok.svg",
    href: "https://www.tiktok.com/@zhebe.docs",
  },
  {
    label: "WhatsApp",
    icon: "/landing/social-whatsapp.svg",
    href: "https://wa.me/77711017744",
  },
] as const;

export function SocialLinks() {
  return (
    <div className="flex items-center gap-2">
      {SOCIAL_LINKS.map((social) => (
        <a
          aria-label={social.label}
          className="flex size-10 items-center justify-center rounded-full bg-[#262626] transition-colors hover:bg-[#333]"
          href={social.href}
          key={social.label}
          rel="noopener noreferrer"
          target="_blank"
        >
          <img
            alt=""
            className="size-6"
            height={24}
            src={social.icon}
            width={24}
          />
        </a>
      ))}
    </div>
  );
}

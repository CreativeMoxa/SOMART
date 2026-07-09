import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";

const links = [
  { href: "/products", label: "Shop All" },
  { href: "/products?category=sunglasses", label: "Sunglasses" },
  { href: "/products?category=watches", label: "Watches" },
  { href: "/products?category=accessories", label: "Accessories" },
  { href: "/products?filter=new", label: "New" },
  { href: "/products?filter=sale", label: "Sale" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/85 backdrop-blur-md print:hidden">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex cursor-pointer items-center gap-2.5">
          <Image
            src="/logo-mark.jpeg"
            alt=""
            width={34}
            height={34}
            className="logo-adaptive rounded-full"
          />
          <Image
            src="/logo-wordmark.jpeg"
            alt="SOMART"
            width={110}
            height={26}
            className="logo-adaptive hidden sm:block"
            priority
          />
        </Link>

        <ul className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted lg:flex">
          {links.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className={`cursor-pointer transition-colors duration-200 hover:text-gold ${
                  link.label === "Sale" ? "text-red-500 hover:text-red-400" : ""
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/products"
            className="cursor-pointer rounded-full bg-foreground px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity duration-200 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold lg:hidden"
          >
            Shop
          </Link>
        </div>
      </nav>
    </header>
  );
}

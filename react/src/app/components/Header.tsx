'use client';

import { usePathname } from 'next/navigation';
import UserMenu from './UserMenu';

export default function Header() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  
  return (
    <header className={`fixed top-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-40 ${!isHomePage ? 'hidden md:block' : ''}`}>
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex-1" />
        <div className="flex items-center">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}


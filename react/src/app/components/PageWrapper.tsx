'use client';

import { usePathname } from 'next/navigation';

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  
  return (
    <div className={isHomePage ? 'pt-14' : 'pt-0 md:pt-14'}>
      {children}
    </div>
  );
}


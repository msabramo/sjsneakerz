'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const USERS = ['Zach', 'Adi', 'Marc', 'Nicole'];

export default function UserMenu() {
  const { user, signIn, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleUserSelect = (userName: string) => {
    signIn(userName);
    setIsMenuOpen(false);
  };

  const handleSignOut = () => {
    signOut();
    setIsMenuOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      {user ? (
        // Signed in: Show username with dropdown
        <div>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center space-x-2 bg-white dark:bg-gray-800 px-3 py-1 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
              {user.name[0].toUpperCase()}
            </div>
            <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
              {user.name}
            </span>
            <svg
              className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${
                isMenuOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50">
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      ) : (
        // Not signed in: Show "Sign in" button with user list
        <div>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-1.5 rounded-lg shadow-md hover:shadow-lg transition-all text-sm"
          >
            Sign In
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50">
              <div className="px-4 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                Select User
              </div>
              {USERS.map((userName) => (
                <button
                  key={userName}
                  onClick={() => handleUserSelect(userName)}
                  className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                    {userName[0].toUpperCase()}
                  </div>
                  <span>{userName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


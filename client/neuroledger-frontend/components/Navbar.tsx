'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-hover rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">N</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              NeuroLedger
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link href="/app" className="text-secondary hover:text-primary transition-colors">
              App
            </Link>
            <Link href="/docs" className="text-secondary hover:text-primary transition-colors">
              Docs
            </Link>
            <Link href="/hackathon" className="text-secondary hover:text-primary transition-colors">
              Hackathon
            </Link>
            <Link href="/admin" className="text-secondary hover:text-primary transition-colors">
              Admin
            </Link>
            <ConnectButton />
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-secondary hover:text-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-4">
            <Link
              href="/app"
              className="block text-secondary hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              App
            </Link>
            <Link
              href="/docs"
              className="block text-secondary hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Docs
            </Link>
            <Link
              href="/hackathon"
              className="block text-secondary hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Hackathon
            </Link>
            <Link
              href="/admin"
              className="block text-secondary hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Admin
            </Link>
            <div className="pt-4">
              <ConnectButton />
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

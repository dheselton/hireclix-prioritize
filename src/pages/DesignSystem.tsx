import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

const colorTokens = [
  { name: "Primary", value: "hsl(209 75% 19%)", var: "--primary" },
  { name: "Primary Hover", value: "hsl(209 75% 15%)", var: "--primary-hover" },
  { name: "Primary Foreground", value: "hsl(0 0% 100%)", var: "--primary-foreground" },
  { name: "Accent", value: "hsl(209 61% 58%)", var: "--accent" },
  { name: "Accent Hover", value: "hsl(209 61% 50%)", var: "--accent-hover" },
  { name: "Success", value: "hsl(39 96% 54%)", var: "--success" },
  { name: "Background", value: "hsl(0 0% 100%)", var: "--background" },
  { name: "Foreground", value: "hsl(0 0% 13%)", var: "--foreground" },
  { name: "Muted Foreground", value: "hsl(210 9% 46%)", var: "--muted-foreground" },
  { name: "Border", value: "hsl(210 9% 79%)", var: "--border" },
];

const gradients = [
  { name: "Primary", class: "bg-gradient-primary" },
  { name: "Accent", class: "bg-gradient-accent" },
  { name: "Card", class: "bg-gradient-card" },
  { name: "Hero", class: "bg-gradient-hero" },
  { name: "Glass", class: "bg-gradient-glass backdrop-blur-sm" },
];

const shadows = [
  { name: "Card", class: "shadow-card" },
  { name: "Modal", class: "shadow-modal" },
  { name: "Large", class: "shadow-lg" },
  { name: "Glass", class: "shadow-glass" },
];

export default function DesignSystem() {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(text);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl mb-2">Design System</h1>
        <p className="text-muted-foreground">
          HireClix design tokens, Client-First methodology, and brand guidelines
        </p>
      </div>

      {/* Client-First Overview */}
      <Card className="glass-card p-6">
        <h2 className="text-2xl mb-3">Client-First Overview</h2>
        <p className="text-muted-foreground mb-4">
          Client-First is a design and development methodology that prioritizes semantic naming,
          component reusability, and scalable architecture for web projects. It emphasizes
          creating maintainable systems with clear hierarchies and consistent patterns.
        </p>
        <Button variant="outline" className="hover:border-accent hover:text-accent">
          <a href="https://docs.google.com/document/d/client-first-quickstart" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
            Learn More About Client-First
          </a>
        </Button>
      </Card>

      {/* Typography */}
      <Card className="glass-card p-6">
        <h2 className="text-2xl mb-4">Typography</h2>
        <div className="space-y-4">
          <div>
            <Badge variant="secondary" className="mb-2">Headings</Badge>
            <p className="text-muted-foreground mb-2">Font: Unbounded (700)</p>
            <div className="space-y-2">
              <h1 className="text-4xl">Heading 1 - The quick brown fox</h1>
              <h2 className="text-3xl">Heading 2 - The quick brown fox</h2>
              <h3 className="text-2xl">Heading 3 - The quick brown fox</h3>
            </div>
          </div>
          <div>
            <Badge variant="secondary" className="mb-2">Body</Badge>
            <p className="text-muted-foreground mb-2">Font: Roboto (400/500)</p>
            <div className="space-y-2">
              <p className="text-base">Regular - The quick brown fox jumps over the lazy dog</p>
              <p className="text-base font-medium">Medium - The quick brown fox jumps over the lazy dog</p>
              <p className="text-sm">Small - The quick brown fox jumps over the lazy dog</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Color Tokens */}
      <Card className="glass-card p-6">
        <h2 className="text-2xl mb-4">Color Tokens</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {colorTokens.map((token) => (
            <div
              key={token.var}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-accent transition-colors"
            >
              <div
                className="w-12 h-12 rounded-lg border border-border flex-shrink-0"
                style={{ background: token.value }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{token.name}</p>
                <code className="text-xs text-muted-foreground">{token.var}</code>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 h-8 w-8"
                onClick={() => copyToClipboard(`var(${token.var})`)}
              >
                {copiedToken === `var(${token.var})` ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Gradients */}
      <Card className="glass-card p-6">
        <h2 className="text-2xl mb-4">Gradients</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gradients.map((gradient) => (
            <div key={gradient.name} className="space-y-2">
              <div className={`h-24 rounded-lg border border-border ${gradient.class}`} />
              <div className="flex items-center justify-between">
                <code className="text-sm">.{gradient.class}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(gradient.class)}
                >
                  {copiedToken === gradient.class ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Shadows */}
      <Card className="glass-card p-6">
        <h2 className="text-2xl mb-4">Shadows</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {shadows.map((shadow) => (
            <div key={shadow.name} className="space-y-2">
              <div className={`h-24 rounded-lg bg-card ${shadow.class} flex items-center justify-center`}>
                <span className="text-sm font-medium">{shadow.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <code className="text-sm">.{shadow.class}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(shadow.class)}
                >
                  {copiedToken === shadow.class ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Border Radius */}
      <Card className="glass-card p-6">
        <h2 className="text-2xl mb-4">Border Radius</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="h-20 bg-primary rounded-sm" />
            <code className="text-sm">rounded-sm</code>
          </div>
          <div className="space-y-2">
            <div className="h-20 bg-primary rounded-lg" />
            <code className="text-sm">rounded-lg (base)</code>
          </div>
          <div className="space-y-2">
            <div className="h-20 bg-primary rounded-xl" />
            <code className="text-sm">rounded-xl</code>
          </div>
          <div className="space-y-2">
            <div className="h-20 bg-primary rounded-2xl" />
            <code className="text-sm">rounded-2xl (cards)</code>
          </div>
        </div>
      </Card>

      {/* Accessibility */}
      <Card className="glass-card p-6">
        <h2 className="text-2xl mb-4">Accessibility (WCAG AA)</h2>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span>Color contrast ratios meet WCAG AA standards</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span>Semantic HTML with proper headings hierarchy</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span>Keyboard navigation supported throughout</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span>Clear focus states on interactive elements</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span>ARIA attributes for screen reader compatibility</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

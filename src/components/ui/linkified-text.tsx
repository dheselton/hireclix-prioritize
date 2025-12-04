import * as React from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// Map of known domains to friendly labels
const DOMAIN_LABELS: Record<string, string> = {
  'docs.google.com': 'Google Docs',
  'drive.google.com': 'Google Drive',
  'sheets.google.com': 'Google Sheets',
  'slides.google.com': 'Google Slides',
  'figma.com': 'Figma',
  'www.figma.com': 'Figma',
  'miro.com': 'Miro',
  'notion.so': 'Notion',
  'www.notion.so': 'Notion',
  'github.com': 'GitHub',
  'www.github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'www.gitlab.com': 'GitLab',
  'slack.com': 'Slack',
  'app.slack.com': 'Slack',
  'trello.com': 'Trello',
  'www.trello.com': 'Trello',
  'asana.com': 'Asana',
  'app.asana.com': 'Asana',
  'linear.app': 'Linear',
  'clickup.com': 'ClickUp',
  'app.clickup.com': 'ClickUp',
  'jira.atlassian.com': 'Jira',
  'confluence.atlassian.com': 'Confluence',
  'webflow.com': 'Webflow',
  'www.webflow.com': 'Webflow',
  'loom.com': 'Loom',
  'www.loom.com': 'Loom',
  'youtube.com': 'YouTube',
  'www.youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'vimeo.com': 'Vimeo',
  'www.vimeo.com': 'Vimeo',
  'airtable.com': 'Airtable',
  'www.airtable.com': 'Airtable',
  'dropbox.com': 'Dropbox',
  'www.dropbox.com': 'Dropbox',
  'canva.com': 'Canva',
  'www.canva.com': 'Canva',
  'zeplin.io': 'Zeplin',
  'app.zeplin.io': 'Zeplin',
  'invisionapp.com': 'InVision',
  'www.invisionapp.com': 'InVision',
  'sketch.cloud': 'Sketch',
  'www.sketch.cloud': 'Sketch',
};

// URL regex pattern
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;

function getFriendlyLabel(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Check for known domains
    if (DOMAIN_LABELS[hostname]) {
      return DOMAIN_LABELS[hostname];
    }
    
    // Remove www. prefix for cleaner display
    const cleanHost = hostname.replace(/^www\./, '');
    
    // Get the domain name without TLD for very long URLs
    const domainParts = cleanHost.split('.');
    if (domainParts.length >= 2) {
      // Capitalize first letter
      const name = domainParts[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    
    return cleanHost;
  } catch {
    // If URL parsing fails, return a truncated version
    return url.length > 30 ? url.substring(0, 27) + '...' : url;
  }
}

interface LinkifiedTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

export function LinkifiedText({ text, className, linkClassName }: LinkifiedTextProps) {
  if (!text) return null;

  const parts = text.split(URL_REGEX);
  
  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {parts.map((part, index) => {
        if (URL_REGEX.test(part)) {
          // Reset regex lastIndex after test
          URL_REGEX.lastIndex = 0;
          const label = getFriendlyLabel(part);
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-1 text-primary hover:underline font-medium",
                linkClassName
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {label}
              <ExternalLink className="h-3 w-3 inline-flex shrink-0" />
            </a>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
}

// Utility function to check if text contains URLs
export function containsUrl(text: string): boolean {
  if (!text) return false;
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text);
}

// Utility to extract all URLs from text
export function extractUrls(text: string): string[] {
  if (!text) return [];
  URL_REGEX.lastIndex = 0;
  return text.match(URL_REGEX) || [];
}

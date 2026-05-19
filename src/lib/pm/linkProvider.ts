export interface LinkProvider {
  label: string;
  initial: string;
  bg: string;   // hex
  fg: string;   // hex
}

export function getLinkProvider(url: string): LinkProvider {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { host = url; }

  if (host.includes("figma.com"))                       return { label: "Figma",   initial: "F", bg: "#F24E1E", fg: "#FFFFFF" };
  if (host.includes("github.com"))                      return { label: "GitHub",  initial: "G", bg: "#24292F", fg: "#FFFFFF" };
  if (host.includes("loom.com"))                        return { label: "Loom",    initial: "L", bg: "#625DF5", fg: "#FFFFFF" };
  if (host.includes("notion.so") || host.includes("notion.site")) return { label: "Notion", initial: "N", bg: "#000000", fg: "#FFFFFF" };
  if (host.includes("docs.google.com"))                 return { label: "Docs",    initial: "D", bg: "#4285F4", fg: "#FFFFFF" };
  if (host.includes("drive.google.com"))                return { label: "Drive",   initial: "D", bg: "#1FA463", fg: "#FFFFFF" };
  if (host.includes("dropbox.com"))                     return { label: "Dropbox", initial: "D", bg: "#0061FF", fg: "#FFFFFF" };
  if (host.includes("slack.com"))                       return { label: "Slack",   initial: "S", bg: "#4A154B", fg: "#FFFFFF" };
  if (host.includes("youtube.com") || host.includes("youtu.be")) return { label: "YouTube", initial: "Y", bg: "#FF0000", fg: "#FFFFFF" };
  if (host.includes("linear.app"))                      return { label: "Linear",  initial: "L", bg: "#5E6AD2", fg: "#FFFFFF" };
  if (host.includes("vercel.app") || host.includes("vercel.com")) return { label: "Vercel", initial: "V", bg: "#000000", fg: "#FFFFFF" };

  const initial = (host[0] || "?").toUpperCase();
  return { label: host, initial, bg: "#64748B", fg: "#FFFFFF" };
}

export function hostnameOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

import type { Metadata } from "next";
import { Montserrat, Mr_De_Haviland, Orbitron, IBM_Plex_Mono, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import MusicPlayer from "./components/MusicPlayer";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

const mrDeHaviland = Mr_De_Haviland({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-mr-de-haviland",
  display: "swap",
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech-mono",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ronald Hoang — Software Engineer",
  description: "Portfolio of Ronald Hoang, Software Engineer specialising in AI-native systems, multi-agent pipelines, and backend infrastructure on AWS and GCP.",
  openGraph: {
    title: "Ronald Hoang — Software Engineer",
    description: "AI-native systems · Multi-Agent Pipelines · Backend Infrastructure",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ronald Hoang — Software Engineer",
    description: "AI-native systems · Multi-Agent Pipelines · Backend Infrastructure",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${mrDeHaviland.variable} ${orbitron.variable} ${ibmPlexMono.variable} ${shareTechMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <MusicPlayer />
      </body>
    </html>
  );
}

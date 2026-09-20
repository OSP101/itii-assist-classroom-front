import { Fira_Code as FontMono, Kanit } from "next/font/google";

// 4 weights, not all 9 Kanit ships — every one of these is a separate font
// file per subset (latin + thai = 2 files/weight), so 9 weights meant 18
// font files on the very first paint of every page, including the student
// check-in page a 1000-person burst hits hardest (plan.md ระยะ 3). Picked
// by actual usage: 400/500/600/700 cover the overwhelming majority of
// font-normal/font-medium/font-semibold/font-bold across the app; the rare
// font-light/font-black spots fall back to the browser's synthesized
// weight, which is a fine tradeoff for cutting the common-path payload in
// half.
export const fontSans = Kanit({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
});
